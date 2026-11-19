import React from 'react';

export default function QuestionCard({
  question,
  onShowQr,
  onEdit,
  onToggleOpen,
  onToggleResults,
  onClear,
  onDelete,
  onHideWord,
  onUnhideWord,
  onCopy
}) {
  const isMap = question.type === 'map';
  const isPoll = question.type === 'poll';

  const statsText = isPoll
    ? `${question.participants} vote${question.participants === 1 ? '' : 's'}`
    : isMap
    ? `${question.participants} ${question.participants === 1 ? 'person' : 'people'} · ${question.top?.length || 0} cit${question.top?.length === 1 ? 'y' : 'ies'} · ${question.countries || 0} countr${question.countries === 1 ? 'y' : 'ies'}`
    : `${question.total} answer${question.total === 1 ? '' : 's'} · ${question.participants} ${question.participants === 1 ? 'person' : 'people'}${question.blocked ? ` · ${question.blocked} filtered` : ''}`;

  return (
    <div className="card q" style={{
      padding: '18px',
      marginBottom: '16px',
      display: 'grid',
      gridTemplateColumns: '132px 1fr',
      gap: '18px'
    }}>
      {/* QR Thumbnail */}
      <div
        className="qr-thumb"
        onClick={() => onShowQr(question)}
        title="Show QR full screen"
        style={{
          width: '132px',
          height: '132px',
          borderRadius: '12px',
          border: '1px solid var(--line)',
          padding: '6px',
          background: '#fff',
          cursor: 'zoom-in'
        }}
      >
        <img
          alt="QR code"
          src={`/api/questions/${question.id}/qr.svg`}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      {/* Main Content */}
      <div style={{ minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--muted)' }}>
          <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
            {isMap ? '📍 Map' : isPoll ? '📊 Poll' : '☁️ Word cloud'}
          </span>
          <span className={`pill ${question.open ? 'open' : 'closed'}`}>
            <span className="dot" />
            {question.open ? (isPoll ? 'Voting open' : 'Accepting answers') : 'Closed'}
          </span>
          <span>{statsText}</span>
        </div>

        {/* Title */}
        <h3 style={{ fontSize: '20px', margin: '6px 0 10px', lineHeight: 1.25 }}>
          {question.text}
        </h3>

        {/* Links */}
        <div style={{ display: 'grid', gap: '6px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', minWidth: 0 }}>
            <span style={{ width: '78px', flex: 'none', color: 'var(--muted)', fontWeight: 600 }}>Answer link</span>
            <code style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              padding: '4px 8px',
              borderRadius: '7px',
              fontSize: '12.5px'
            }}>
              {question.links?.answer}
            </code>
            <button className="btn small" onClick={() => onCopy(question.links?.answer)}>
              Copy
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', minWidth: 0 }}>
            <span style={{ width: '78px', flex: 'none', color: 'var(--muted)', fontWeight: 600 }}>Live view</span>
            <code style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              padding: '4px 8px',
              borderRadius: '7px',
              fontSize: '12.5px'
            }}>
              {question.links?.live}
            </code>
            <button className="btn small" onClick={() => onCopy(question.links?.live)}>
              Copy
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <a
            className="btn primary"
            href={question.links?.live}
            target="_blank"
            rel="noopener noreferrer"
          >
            {isMap ? 'Open live map ↗' : isPoll ? 'Open live results ↗' : 'Open live cloud ↗'}
          </a>
          <a
            className="btn"
            href={question.links?.answer}
            target="_blank"
            rel="noopener noreferrer"
          >
            Answer page ↗
          </a>
          <button className="btn" onClick={() => onShowQr(question)}>
            Show QR
          </button>
          <a
            className="btn"
            href={`/api/questions/${question.id}/qr.png?size=1200&download=1`}
          >
            Download QR
          </a>
          <button className="btn" onClick={() => onToggleOpen(question)}>
            {question.open
              ? (isPoll ? 'Close voting' : 'Close answers')
              : (isPoll ? 'Reopen voting' : 'Reopen answers')}
          </button>
          {isPoll && (
            <button className="btn" onClick={() => onToggleResults(question)}>
              {question.showResults ? 'Hide results on screen' : '✨ Reveal results'}
            </button>
          )}
          <button className="btn" onClick={() => onEdit(question)}>
            Edit
          </button>
          <a className="btn" href={`/api/questions/${question.id}/export.csv`}>
            Export CSV
          </a>
          <button className="btn danger" onClick={() => onClear(question)}>
            Reset &amp; restart
          </button>
          <button className="btn danger" onClick={() => onDelete(question)}>
            Delete
          </button>
        </div>

        {/* Chips or Poll Bars */}
        <div style={{ marginTop: '14px' }}>
          {isPoll ? (
            <div style={{ display: 'grid', gap: '7px', maxWidth: '620px' }}>
              {(question.top || []).map((o, i) => (
                <div
                  key={o.key || i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '2px 10px',
                    fontSize: '13.5px',
                    fontWeight: 600
                  }}
                >
                  <span style={{ color: o.leader && question.total ? '#5b3df5' : 'inherit' }}>
                    {String.fromCharCode(65 + i)}. {o.text} {o.leader && question.total ? '👑' : ''}
                  </span>
                  <b>{o.count} · {Math.round(o.pct)}%</b>
                  <div style={{
                    gridColumn: '1 / -1',
                    height: '7px',
                    borderRadius: '5px',
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${o.pct}%`,
                      background: o.leader && question.total ? 'linear-gradient(90deg, #5b3df5, #e8417a)' : 'var(--accent)',
                      borderRadius: '5px',
                      transition: 'width .5s'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(question.top || []).map((w) => (
                <span
                  key={w.key}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--accent-soft)',
                    color: '#3a23c4',
                    padding: '4px 6px 4px 10px',
                    borderRadius: '999px',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  {w.text} <b style={{ fontWeight: 800, opacity: .7, fontSize: '12px' }}>{w.count}</b>
                  <button
                    onClick={() => onHideWord(question, w.key)}
                    title="Hide from cloud"
                    style={{
                      border: 0,
                      background: 'rgba(58,35,196,.12)',
                      color: 'inherit',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      fontSize: '13px',
                      lineHeight: 1,
                      padding: 0
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}

              {(question.hiddenList || []).map((h) => (
                <span
                  key={h.key}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#efeef0',
                    color: 'var(--muted)',
                    textDecoration: 'line-through',
                    padding: '4px 6px 4px 10px',
                    borderRadius: '999px',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  {h.text}
                  <button
                    onClick={() => onUnhideWord(question, h.key)}
                    title="Show again"
                    style={{
                      border: 0,
                      background: 'rgba(0,0,0,.07)',
                      color: 'inherit',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      fontSize: '13px',
                      lineHeight: 1,
                      padding: 0,
                      textDecoration: 'none'
                    }}
                  >
                    ↺
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Subtitle */}
        <div className="muted" style={{ fontSize: '12px', marginTop: '10px' }}>
          {isPoll
            ? `${question.multi ? 'Multiple choice' : 'Single choice'} · one vote per person · results ${question.showResults ? 'shown live on screen' : 'hidden on screen until revealed'}`
            : isMap
            ? `One city per person · ${question.venue ? 'event city: ' + question.venue.label : 'no event city set'} · click × on a city to hide it`
            : `${question.mode === 'words' ? 'Counts individual words' : 'Counts whole answers'} · up to ${question.maxPerPerson} answers per person · click × on a word to hide it`}
        </div>
      </div>
    </div>
  );
}
