import React, { useEffect, useRef, useState } from 'react';

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
  // from "Deepak Kumar"). The cloud below is laid out with normal flow,
  // which can never overlap, and every answer stays on one line.
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
          maxWidth: '85%'
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

      {/* Cloud Box — flow layout: words can never overlap, and multi-word
          answers (whiteSpace: nowrap) always stay together on one line */}
      <div ref={containerRef} style={{ position: 'relative', minHeight: 0 }}>
        {words.length > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              alignContent: 'center',
              justifyContent: 'center',
              gap: '0.12em 0.38em',
              padding: '1vh 1vw',
              overflow: 'hidden',
              fontFamily: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif",
              textAlign: 'center',
            }}
          >
            {sorted.map((word, index) => (
              <span
                key={word.key || word.text}
                title={`${word.text} · ${word.count}`}
                style={{
                  flex: 'none',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.02,
                  letterSpacing: '-0.02em',
                  fontSize: `${sizeOf(word.count)}px`,
                  fontWeight: word.count >= max * 0.6 ? 800 : word.count >= max * 0.3 ? 700 : 500,
                  color: colorOf(word, index),
                  transition: 'font-size 0.45s ease, color 0.45s ease',
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
                <img
                  src={`/api/questions/${data?.id}/qr.svg`}
                  alt="QR code"
                  style={{ width: '100%', height: '100%', display: 'block' }}
                />
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
              <img
                src={`/api/questions/${data?.id}/qr.svg`}
                alt="QR code"
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
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
