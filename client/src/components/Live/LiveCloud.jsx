import React, { useEffect, useRef } from 'react';
import WordCloud from 'wordcloud';

const DARK = ['#ffd166', '#ff6b9a', '#7cc8ff', '#9d8bff', '#5fe3b4', '#ffa36c', '#f9f871', '#c4b5ff', '#ff8fab', '#8ee3f5'];
const LIGHT = ['#5b3df5', '#e8417a', '#0b8aa8', '#d9480f', '#11865b', '#7b2cbf', '#c2255c', '#1c7ed6', '#e67700', '#2b8a3e'];

export default function LiveCloud({ data, showQr, theme }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const words = data?.words || [];
  const top = words.slice(0, 3);
  const answerUrl = `${window.location.origin}/q/${data?.id}`;
  const displayUrl = answerUrl.replace(/^https?:\/\//, '');

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const box = containerRef.current.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));

    if (!words.length) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const max = words[0].count;
    const min = words[words.length - 1].count;
    const longest = Math.max(...words.slice(0, 3).map(w => w.text.length), 3);
    const maxPx = Math.min(box.height * 0.28, (box.width * 0.9) / (longest * 0.58));
    const minPx = Math.max(14, Math.min(maxPx * 0.16, 34));
    const few = words.length < 6;
    const sizeOf = c => (max === min ? (few ? maxPx * 0.75 : maxPx * 0.45) : minPx + (maxPx - minPx) * Math.pow((c - min) / (max - min), 0.7));
    const palette = theme === 'light' ? LIGHT : DARK;
    const rankOf = new Map(words.map((w, i) => [w.text, i]));

    try {
      WordCloud.stop && WordCloud.stop();
      WordCloud(canvas, {
        list: words.map(w => [w.text, w.count]),
        weightFactor: c => sizeOf(c) * dpr,
        fontFamily: "'Bricolage Grotesque', 'Plus Jakarta Sans', sans-serif",
        fontWeight: (word, weight) => (weight >= max * 0.6 ? 800 : weight >= max * 0.3 ? 700 : 500),
        color: (word, weight) => {
          const r = rankOf.get(word) ?? 9;
          if (r === 0) return palette[0];
          const a = weight >= max * 0.3 ? 1 : 0.78;
          const c = palette[1 + (r % (palette.length - 1))];
          return a === 1 ? c : c + 'c8';
        },
        backgroundColor: 'rgba(0,0,0,0)',
        gridSize: Math.round(8 * dpr),
        rotateRatio: 0,
        shuffle: false,
        shrinkToFit: true,
        drawOutOfBound: false,
        origin: [canvas.width / 2, canvas.height / 2],
        ellipticity: Math.min(1, box.height / box.width * 1.25),
        wait: 0,
        clearCanvas: true
      });
    } catch (e) {
      console.error('WordCloud render error', e);
    }
  }, [words, theme]);

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

      {/* Cloud Box */}
      <div ref={containerRef} style={{ position: 'relative', minHeight: 0 }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

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
