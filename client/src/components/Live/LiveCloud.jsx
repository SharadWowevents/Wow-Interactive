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
  // Re-measure once the display font has actually loaded, otherwise the
  // first layout is computed with fallback-font widths.
  const [fontTick, setFontTick] = useState(0);
  useEffect(() => {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => setFontTick((t) => t + 1)).catch(() => {});
    }
  }, []);

  const colorOf = (word, index) => {
    if (index === 0) return palette[0];
    const base = palette[1 + (index % (palette.length - 1))];
    return word.count >= max * 0.3 ? base : `${base}c8`;
  };

  // Dense packed cloud:
  //  - every word is measured with real canvas text metrics
  //  - the biggest answer is placed first, in the centre, on the top layer
  //  - the others spiral outward from it (random start angle per word, so it
  //    still looks organic) and sit as close as possible without touching
  //  - a global scale is binary-searched, so the cloud grows to FILL the
  //    available area: few answers = huge text, many answers = still readable
  const placements = useMemo(() => {
    const W = box.width;
    const H = box.height;
    if (!W || !H || !sorted.length) return [];

    const FONT = "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif";
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const widthCache = new Map();
    const widthAt100 = (text, weight) => {
      const key = `${weight}|${text}`;
      if (!widthCache.has(key)) {
        ctx.font = `${weight} 100px ${FONT}`;
        widthCache.set(key, ctx.measureText(text).width);
      }
      return widthCache.get(key);
    };

    const MIN_REL = 0.46; // smallest answer is never below 46% of the biggest
    const items = sorted.map((word, index) => {
      const rel = max === min ? 1 : MIN_REL + (1 - MIN_REL) * Math.pow((word.count - min) / (max - min), 0.6);
      const weight = word.count >= max * 0.6 ? 800 : word.count >= max * 0.3 ? 700 : 600;
      return { word, index, rel, weight, w100: widthAt100(word.text || '', weight) };
    });

    const GAP = 7; // px gap between words (kept small on purpose)
    const EDGE = 10;
    const aspect = Math.min(2.6, Math.max(1, W / H));

    const pack = (scale) => {
      const placed = [];
      const out = [];
      for (const it of items) {
        let fontSize = scale * it.rel;
        let w = (it.w100 * fontSize) / 100;
        // A very long phrase is shrunk on its own so it still fits in one line.
        if (w > W - EDGE * 2) {
          fontSize *= (W - EDGE * 2) / w;
          w = W - EDGE * 2;
        }
        const h = fontSize * 1.02;
        const rng = seededRandom(it.word.text || String(it.index));
        const cx = W / 2;
        const cy = it.index === 0 ? H * 0.46 : H / 2;
        let a = it.index === 0 ? 0 : rng() * Math.PI * 2;
        let found = null;

        for (let step = 0; step < 6000; step++) {
          a += 0.22;
          const r = it.index === 0 ? 0 : 1.5 * a;
          const x = cx + r * Math.cos(a) * aspect;
          const y = cy + r * Math.sin(a);
          const left = x - w / 2;
          const right = x + w / 2;
          const topY = y - h / 2;
          const bottom = y + h / 2;
          if (left < EDGE || right > W - EDGE || topY < EDGE * 0.5 || bottom > H - EDGE * 0.5) {
            if (it.index === 0) break;
            if (r > Math.max(W, H) * aspect) break;
            continue;
          }
          let hit = false;
          for (const p of placed) {
            if (left < p.right + GAP && right > p.left - GAP && topY < p.bottom + GAP * 0.6 && bottom > p.top - GAP * 0.6) {
              hit = true;
              break;
            }
          }
          if (!hit) {
            found = { left, right, top: topY, bottom, x, y };
            break;
          }
          if (it.index === 0) break;
        }

        if (!found) return null;
        placed.push(found);
        out.push({ it, fontSize, x: found.x, y: found.y });
      }
      return out;
    };

    // Binary search for the biggest scale where everything fits.
    const hiScale = Math.max(40, Math.min(H * 0.34, 175));
    const loScale = 12;
    let best = pack(loScale);
    if (best) {
      let lo = loScale;
      let hi = hiScale;
      const topFit = pack(hi);
      if (topFit) {
        best = topFit;
      } else {
        for (let i = 0; i < 14; i++) {
          const mid = (lo + hi) / 2;
          const res = pack(mid);
          if (res) {
            best = res;
            lo = mid;
          } else {
            hi = mid;
          }
        }
      }
    } else {
      // Extreme case (hundreds of long phrases): fall back to a tiny scale and
      // tolerate overlap rather than dropping answers.
      best = items.map((it, i) => ({
        it,
        fontSize: 12 * it.rel,
        x: W * (0.1 + ((i * 0.37) % 0.8)),
        y: H * (0.08 + ((i * 0.23) % 0.84)),
      }));
    }

    return best.map(({ it, fontSize, x, y }) => ({
      word: it.word,
      index: it.index,
      fontSize,
      rotation: 0,
      xPct: (x / W) * 100,
      yPct: (y / H) * 100,
      // Most-repeated = front layer
      zIndex: 100 + (sorted.length - it.index) * 10,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted.map((w) => `${w.text}:${w.count}`).join('|'), box.width, box.height, fontTick]);

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
                  fontWeight: word.count >= max * 0.6 ? 800 : word.count >= max * 0.3 ? 700 : 600,
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
