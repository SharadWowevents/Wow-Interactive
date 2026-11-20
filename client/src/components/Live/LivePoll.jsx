import React from 'react';
import QrImage from '../Common/QrImage';

const COLORS = ['#7cc8ff', '#ff6b9a', '#5fe3b4', '#9d8bff', '#ffa36c', '#f9f871', '#ff8fab', '#8ee3f5'];

export default function LivePoll({ data, showQr }) {
  const options = data?.options || [];
  const hiddenResults = !data?.showResults;
  const anyVotes = (data?.total || 0) > 0;
  const answerUrl = `${window.location.origin}/q/${data?.id}`;
  const displayUrl = answerUrl.replace(/^https?:\/\//, '');

  const n = options.length || 1;
  const per = Math.max(48, Math.min(100, 600 / n));
  // Long options (long words / unbroken strings) shrink the type a step,
  // so they stay on screen instead of pushing the % column off the edge.
  const longestOption = options.reduce((acc, o) => Math.max(acc, (o.text || '').length), 0);
  const textScale = longestOption > 80 ? 0.55 : longestOption > 56 ? 0.68 : longestOption > 38 ? 0.8 : longestOption > 26 ? 0.9 : 1;
  const fs = Math.max(14, Math.min(per * 0.32, 38) * textScale);
  const bh = Math.max(12, Math.min(per * 0.28, 42));
  const gap = Math.max(10, Math.min(per * 0.24, 36));

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      maxWidth: '100vw',
      boxSizing: 'border-box',
      display: 'grid',
      gridTemplateColumns: showQr ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      gap: '3vh 3vw',
      padding: '3.4vh 3.4vw',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <header style={{
        gridColumn: '1 / -1',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '2vw'
      }}>
        <h1 style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: 'clamp(26px, 4vw, 64px)',
          lineHeight: 1.08,
          letterSpacing: '-0.025em',
          margin: 0,
          maxWidth: '88%',
          minWidth: 0,
          overflowWrap: 'anywhere'
        }}>
          {data?.question}
        </h1>
        <span style={{
          flex: 'none',
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
          <span>{data?.open ? 'Live' : 'Voting closed'}</span>
        </span>
      </header>

      {/* Bars Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: `${gap}px`,
        minHeight: 0,
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden'
      }}>
        {options.map((o, i) => {
          const c = COLORS[i % COLORS.length];
          const isLeader = !hiddenResults && !!o.leader && anyVotes;
          const isDim = !hiddenResults && anyVotes && !o.leader && options.length > 2 && !data?.open;

          return (
            <div
              key={o.id || i}
              style={{
                position: 'relative',
                opacity: isDim ? 0.55 : 1,
                transition: 'opacity .4s',
                minWidth: 0,
                maxWidth: '100%'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '2vw',
                marginBottom: `${gap * 0.3}px`,
                minWidth: 0,
                maxWidth: '100%'
              }}>
                <div style={{
                  fontWeight: 800,
                  fontSize: `${fs}px`,
                  lineHeight: 1.15,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '.5em',
                  flex: '1 1 auto',
                  minWidth: 0
                }}>
                  <span style={{
                    flex: 'none',
                    width: '1.6em',
                    height: '1.6em',
                    borderRadius: '.45em',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '.72em',
                    background: c,
                    color: '#120e26',
                    fontWeight: 800
                  }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {/* Long / unbroken option text wraps in place (max 2 lines,
                      breaks anywhere) — it can never push the % off screen */}
                  <span
                    title={o.text}
                    style={{
                      flex: '1 1 auto',
                      minWidth: 0,
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word'
                    }}
                  >
                    {o.text}
                  </span>
                  {isLeader && <span style={{ flex: 'none' }}>👑</span>}
                </div>

                {!hiddenResults && (
                  <div style={{
                    fontFamily: 'var(--display)',
                    fontWeight: 800,
                    fontSize: `${fs * 1.25}px`,
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                    flex: '0 0 auto'
                  }}>
                    <span>{Math.round(o.pct || 0)}%</span>
                    <small style={{
                      fontFamily: 'var(--font)',
                      fontSize: '.5em',
                      color: 'var(--fg2)',
                      fontWeight: 700,
                      marginLeft: '.5em'
                    }}>
                      {o.count || 0} vote{o.count === 1 ? '' : 's'}
                    </small>
                  </div>
                )}
              </div>

              {!hiddenResults && (
                <div style={{
                  height: `${bh}px`,
                  borderRadius: `${bh / 2}px`,
                  background: 'var(--track)',
                  overflow: 'hidden',
                  width: '100%',
                  minWidth: 0,
                  maxWidth: '100%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${o.pct || 0}%`,
                    borderRadius: 'inherit',
                    background: isLeader ? `linear-gradient(90deg, ${c}, #ffd166)` : c,
                    transition: 'width .9s cubic-bezier(.2,.8,.2,1)',
                    boxShadow: `0 0 24px color-mix(in srgb, ${c} 45%, transparent)`
                  }} />
                </div>
              )}
            </div>
          );
        })}

        {hiddenResults && (
          <div style={{
            alignSelf: 'flex-start',
            fontWeight: 800,
            color: 'var(--fg2)',
            fontSize: 'clamp(16px, 1.6vw, 26px)',
            marginTop: '1vh'
          }}>
            Voting is open · results will be revealed soon
          </div>
        )}
      </div>

      {/* Aside with QR and Total */}
      <aside style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2vh',
        minWidth: 0,
        width: showQr ? 'clamp(200px, 24vw, 420px)' : 'auto'
      }}>
        {showQr && (
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--panel-line)',
            borderRadius: '26px',
            padding: '22px',
            textAlign: 'center',
            width: '100%'
          }}>
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '10px',
              aspectRatio: '1',
              maxWidth: '300px',
              margin: '0 auto'
            }}>
              <QrImage qid={data?.id} />
            </div>
            <h2 style={{ fontSize: 'clamp(20px, 1.9vw, 32px)', marginTop: '16px' }}>
              Scan to vote
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--fg2)', fontWeight: 600, fontSize: 'clamp(12px, 1vw, 16px)', wordBreak: 'break-all' }}>
              {displayUrl}
            </p>
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <b style={{
            display: 'block',
            fontFamily: 'var(--display)',
            fontWeight: 800,
            fontSize: 'clamp(40px, 5vw, 84px)',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums'
          }}>
            {(data?.total || 0).toLocaleString('en-IN')}
          </b>
          <span style={{ color: 'var(--fg2)', fontWeight: 700, fontSize: 'clamp(13px, 1.2vw, 20px)' }}>
            {data?.multi ? `voter${data?.total === 1 ? '' : 's'} · multiple choice` : `vote${data?.total === 1 ? '' : 's'}`}
          </span>
        </div>
      </aside>
    </div>
  );
}
