import React, { useEffect, useMemo, useRef, useState } from 'react';
import QrImage from '../Common/QrImage';

// Stable per-word random source: positions look random, but the same
// answer always gets the same spots, so the cloud doesn't jump around
// on every live update — only its size / layer changes with its count.
function seededRandom(text) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DARK = ['#ffd166', '#ff6b9a', '#7cc8ff', '#9d8bff', '#5fe3b4', '#ffa36c', '#f9f871', '#c4b5ff', '#ff8fab', '#8ee3f5'];
const LIGHT = ['#5b3df5', '#e8417a', '#0b8aa8', '#d9480f', '#11865b', '#7b2cbf', '#c2255c', '#1c7ed6', '#e67700', '#2b8a3e'];

export default function LiveCloud({ data, showQr, theme }) {
  const containerRef = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const words = data?.words || [];
  const top = words.slice(0, 3);
  const answerUrl = `${window.location.origin}/q/${data?.id}`;
  const displayUrl = answerUrl.replace(/^https?:\/\//, '');

  // Measure the cloud area (the old canvas word-cloud guessed word sizes
  // before the display font loaded, so words landed on top of each other —
  // e.g. "Divya" + "Kumar" in the same spot, and "Kumar" drifting away
  // from "Deepak Kumar"). Placement below is computed in the browser with
  // real sizes: scattered randomly, biggest answers placed first, and
  // every answer stays on one line.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setBox({ width: rect.width, height: rect.height });
    };
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (observer) observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const palette = theme === 'light' ? LIGHT : DARK;
  const sorted = [...words].sort((a, b) => b.count - a.count);
  const max = sorted.length ? sorted[0].count : 0;
  const min = sorted.length ? sorted[sorted.length - 1].count : 0;
  // Longest answer overall decides the cap, so a long full name
  // ("Deepak Kumar") always fits on one line instead of being split.
  const longest = sorted.reduce((acc, w) => Math.max(acc, (w.text || '').length), 3);
  const fitPx = box.width > 0 ? (box.width * 0.94) / (longest * 0.6) : 120;
  const heightPx = box.height > 0 ? box.height * (sorted.length <= 3 ? 0.3 : 0.24) : 120;
  const maxPx = Math.max(28, Math.min(fitPx, heightPx, 170));
  const minPx = Math.max(13, Math.min(maxPx * 0.2, 30));
  const crowdScale = sorted.length <= 3 ? 1 : sorted.length <= 6 ? 0.85 : sorted.length <= 10 ? 0.7 : sorted.length <= 20 ? 0.55 : 0.42;
  const sizeOf = (count) => {
    if (max === min) return maxPx * (sorted.length < 6 ? 0.72 : 0.45) * crowdScale;
    return (minPx + (maxPx - minPx) * Math.pow((count - min) / (max - min), 0.7)) * crowdScale;
  };
  const colorOf = (word, index) => {
    if (index === 0) return palette[0];
    const base = palette[1 + (index % (palette.length - 1))];
    return word.count >= max * 0.3 ? base : `${base}c8`;
  };

  // Random scattered placement (biggest answers are placed first).
  // Most-repeated answers get the top/centre of the screen and the
  // highest z-index, so they always render in front of the rest.
  const placements = useMemo(() => {
    const W = Math.max(box.width, 640);
    const H = Math.max(box.height, 360);
    const placed = [];
    return sorted.map((word, index) => {
      let fontSize = sizeOf(word.count);
      let estW = Math.max(24, (word.text || '').length * fontSize * 0.58);
      if (estW > W * 0.94) {
        fontSize *= (W * 0.94) / estW;
        estW = W * 0.94;
      }
      const estH = fontSize * 1.1;
      const rng = seededRandom(word.text || String(index));
      const rotation = index < 2 ? 0 : Math.round((rng() * 8 - 4) * 10) / 10;

      // Preferred spot: #1 sits top-centre, next ranks near the centre,
      // everyone else gets their own random target across the screen.
      const prefX = index === 0 ? W * 0.5 : index < 3 ? W * (0.32 + rng() * 0.36) : W * (0.14 + rng() * 0.72);
      const prefY = index === 0 ? H * 0.36 : index < 3 ? H * (0.26 + rng() * 0.3) : H * (0.12 + rng() * 0.72);

      let best = null;
      for (let attempt = 0; attempt < 180; attempt++) {
        const left = 8 + rng() * Math.max(1, W - estW - 16);
        const topEdge = 6 + rng() * Math.max(1, H - estH - 12);
        const rect = { left, top: topEdge, right: left + estW, bottom: topEdge + estH };
        let overlap = 0;
        for (const other of placed) {
          const ox = Math.max(0, Math.min(rect.right, other.right + 10) - Math.max(rect.left, other.left - 10));
          const oy = Math.max(0, Math.min(rect.bottom, other.bottom + 6) - Math.max(rect.top, other.top - 6));
          overlap += ox * oy;
        }
        const dx = (left + estW / 2 - prefX) / W;
        const dy = (topEdge + estH / 2 - prefY) / H;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const score = overlap * 20 + dist * (index === 0 ? 9000 : index < 3 ? 3500 : 900);
        if (!best || score < best.score) best = { ...rect, score, overlap };
        // Lower ranks: settle for the first roomy random spot (keeps the scatter)
        if (overlap === 0 && attempt >= 28 && index >= 3) {
          best = { ...rect, score, overlap };
          break;
        }
        if (overlap === 0 && dist < 0.16 && index < 3) break;
      }

      placed.push(best);
      return {
        word,
        index,
        fontSize,
        rotation,
        xPct: ((best.left + estW / 2) / W) * 100,
        yPct: ((best.top + estH / 2) / H) * 100,
        // Most-repeated = front layer (higher count / rank renders on top)
        zIndex: 100 + (sorted.length - index) * 10,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted.map((w) => `${w.text}:${w.count}`).join('|'), box.width, box.height]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'grid',
      gridTemplateRows: 'auto 1fr auto',
      padding: '3.2vh 3.2vw 2.6vh',
      gap: '1.6vh',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '2vw' }}>
        <h1 style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 'clamp(24px, 4.2vw, 64px)',
          lineHeight: 1.08,
          letterSpacing: '-0.025em',
          margin: 0,
          maxWidth: '85%',
          minWidth: 0,
          overflowWrap: 'anywhere'
        }}>
          {data?.question}
        </h1>
        <div style={{ flex: 'none' }}>
          <span className={`live-pill ${!data?.open ? 'closed' : ''}`} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 700,
            fontSize: 'clamp(12px, 1.1vw, 16px)',
            padding: '7px 14px',
            borderRadius: '999px',
            background: 'var(--panel)',
            border: '1px solid var(--panel-line)'
          }}>
            <span className="dot" style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: data?.open ? '#ff4d6d' : '#999',
              boxShadow: data?.open ? '0 0 0 4px rgba(255,77,109,.2)' : 'none'
            }} />
            <span>{data?.open ? 'Live' : 'Answers closed'}</span>
          </span>
        </div>
      </header>

      {/* Cloud Box — randomly scattered across the screen (stable per word).
          Multi-word answers (whiteSpace: nowrap) always stay together, and
          the most-repeated answers are biggest, top-centre and frontmost. */}
      <div ref={containerRef} style={{ position: 'relative', minHeight: 0 }}>
        {words.length > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              fontFamily: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif",
            }}
          >
            {placements.map(({ word, index, fontSize, rotation, xPct, yPct, zIndex }) => (
              <span
                key={word.key || word.text}
                title={`${word.text} · ${word.count}`}
                style={{
                  position: 'absolute',
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                  zIndex,
                  whiteSpace: 'nowrap',
                  lineHeight: 1.02,
                  letterSpacing: '-0.02em',
                  fontSize: `${fontSize}px`,
                  fontWeight: word.count >= max * 0.6 ? 800 : word.count >= max * 0.3 ? 700 : 500,
                  color: colorOf(word, index),
                  textShadow: index < 3 ? '0 6px 28px rgba(0,0,0,0.45)' : 'none',
                  transition: 'left 0.6s ease, top 0.6s ease, font-size 0.45s ease, color 0.45s ease',
                  willChange: 'left, top, font-size',
                }}
              >
                {word.text}
              </span>
            ))}
          </div>
        )}

        {words.length === 0 && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center'
          }}>
            <div>
              <div style={{
                width: 'min(46vh, 40vw)',
                aspectRatio: '1',
                background: '#fff',
                borderRadius: '22px',
                padding: '14px',
                boxShadow: '0 20px 60px rgba(0,0,0,.35)',
                margin: '0 auto'
              }}>
                <QrImage qid={data?.id} />
              </div>
              <h2 style={{ fontSize: 'clamp(22px, 2.6vw, 40px)', marginTop: '3vh' }}>
                Scan to answer
              </h2>
              <p style={{ color: 'var(--fg2)', margin: '8px 0 0', fontSize: 'clamp(14px, 1.4vw, 22px)', fontWeight: 600 }}>
                {displayUrl}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ display: 'flex', alignItems: 'center', gap: '2vw', minHeight: 0 }}>
        {showQr && words.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2vw' }}>
            <div style={{
              width: 'clamp(84px, 11vh, 150px)',
              aspectRatio: '1',
              background: '#fff',
              borderRadius: '12px',
              padding: '6px',
              flex: 'none'
            }}>
              <QrImage qid={data?.id} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontFamily: 'var(--display)', fontSize: 'clamp(16px, 1.7vw, 28px)' }}>
                Scan to answer
              </div>
              <div style={{ color: 'var(--fg2)', fontWeight: 600, fontSize: 'clamp(12px, 1.2vw, 19px)', wordBreak: 'break-all' }}>
                {displayUrl}
              </div>
            </div>
          </div>
        )}

        {top.length > 0 && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'flex-end'
          }}>
            <span style={{
              color: 'var(--fg2)',
              fontSize: 'clamp(11px, 1vw, 15px)',
              fontWeight: 700,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              marginRight: '4px'
            }}>
              Top
            </span>
            {top.map((w, i) => (
              <span
                key={w.key || i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px 6px 6px',
                  borderRadius: '999px',
                  background: 'var(--panel)',
                  border: '1px solid var(--panel-line)',
                  fontWeight: 700,
                  fontSize: 'clamp(13px, 1.25vw, 20px)'
                }}
              >
                <i style={{
                  fontStyle: 'normal',
                  width: '1.7em',
                  height: '1.7em',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '.8em',
                  color: '#17151f',
                  background: i === 0 ? '#ffd166' : i === 1 ? '#d9dce3' : '#f0a86b'
                }}>
                  {i + 1}
                </i>
                <span>{w.text}</span>
                <span style={{ color: 'var(--fg2)', fontWeight: 600 }}>{w.count}</span>
              </span>
            ))}
          </div>
        )}

        <div style={{
          color: 'var(--fg2)',
          fontWeight: 700,
          fontSize: 'clamp(12px, 1.15vw, 18px)',
          whiteSpace: 'nowrap'
        }}>
          <b style={{ color: 'var(--fg)', fontSize: '1.35em', fontFamily: 'var(--display)' }}>{data?.total || 0}</b> answer{data?.total === 1 ? '' : 's'} ·{' '}
          <b style={{ color: 'var(--fg)', fontSize: '1.35em', fontFamily: 'var(--display)' }}>{data?.participants || 0}</b> {data?.participants === 1 ? 'person' : 'people'}
        </div>
      </footer>
    </div>
  );
}
