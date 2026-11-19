import React, { useEffect, useMemo, useState } from 'react';
import { getExportDates, exportCsvUrl } from '../../api/client';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const keyOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return { y, m: m - 1, d };
};
const labelOf = (k) => {
  if (!k) return '';
  const { y, m, d } = parseKey(k);
  return new Date(Date.UTC(y, m, d)).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  });
};
const addDaysKey = (k, n) => {
  const { y, m, d } = parseKey(k);
  const dt = new Date(Date.UTC(y, m, d + n));
  return keyOf(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
};

export default function ExportCsvModal({ question, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [today, setToday] = useState('');
  const [dates, setDates] = useState([]); // [{date,label,count}] — only days WITH answers
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [view, setView] = useState(null); // {y, m}

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    getExportDates(question.id)
      .then((data) => {
        if (!alive) return;
        setToday(data.today);
        setDates(data.dates || []);
        const { y, m } = parseKey(data.today);
        setView({ y, m });
        // Default: today selected if it has data, else the latest day with data
        const latest = (data.dates || [])[data.dates.length - 1];
        if (latest) {
          setFrom(latest.date);
          setTo(latest.date);
          const p = parseKey(latest.date);
          setView({ y: p.y, m: p.m });
        }
      })
      .catch((err) => { if (alive) setError(err.message || 'Could not load dates'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [question.id]);

  const countByDate = useMemo(() => new Map(dates.map((d) => [d.date, d.count])), [dates]);
  const firstDataKey = dates[0]?.date || null;
  const lastDataKey = dates[dates.length - 1]?.date || null;

  const selectedCount = useMemo(() => {
    if (!from || !to) return 0;
    let sum = 0;
    for (const d of dates) if (d.date >= from && d.date <= to) sum += d.count;
    return sum;
  }, [dates, from, to]);

  if (!question) return null;

  const pick = (key) => {
    if (!from || (from && to)) {
      setFrom(key); setTo(null);
    } else if (key < from) {
      setTo(from); setFrom(key);
    } else {
      setTo(key);
    }
  };

  const applyPreset = (preset) => {
    if (!lastDataKey) return;
    if (preset === 'today') {
      if (countByDate.has(today)) { setFrom(today); setTo(today); }
      else { setFrom(lastDataKey); setTo(lastDataKey); }
    } else if (preset === '7' || preset === '30') {
      const start = addDaysKey(lastDataKey, -(Number(preset) - 1));
      setFrom(start < firstDataKey ? firstDataKey : start);
      setTo(lastDataKey);
    } else if (preset === 'all') {
      setFrom(firstDataKey); setTo(lastDataKey);
    }
    const anchor = parseKey(lastDataKey);
    setView({ y: anchor.y, m: anchor.m });
  };

  // Calendar grid for `view` month
  let cells = [];
  let canPrev = false, canNext = false;
  if (view && today) {
    const firstDow = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    const viewKey = keyOf(view.y, view.m, 1);
    const todayParts = parseKey(today);
    const todayMonthKey = keyOf(todayParts.y, todayParts.m, 1);
    canNext = viewKey < todayMonthKey; // never navigate into the future
    canPrev = firstDataKey ? viewKey > keyOf(parseKey(firstDataKey).y, parseKey(firstDataKey).m, 1) : viewKey > '2000-01-01';

    cells = [
      ...Array.from({ length: firstDow }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => keyOf(view.y, view.m, i + 1))
    ];
  }

  const shiftMonth = (delta) => {
    setView((v) => {
      const dt = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() };
    });
  };

  const cellState = (key) => {
    const isFuture = key > today;
    const count = countByDate.get(key) || 0;
    const hasData = count > 0;
    const inRange = from && to && key >= from && key <= to;
    const inPendingRange = from && !to && key === from;
    const isEdge = key === from || key === to;
    return { isFuture, count, hasData, inRange, inPendingRange, isEdge, disabled: isFuture || !hasData };
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ width: 'min(460px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '20px' }}>Export CSV</h2>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '13.5px' }}>
              “{question.text}” — pick the dates to download.
            </p>
          </div>
          <button className="btn small ghost" onClick={onClose} title="Close (Esc)" style={{ fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>

        {loading ? (
          <p className="muted" style={{ padding: '28px 0', textAlign: 'center' }}>Loading available dates…</p>
        ) : error ? (
          <p style={{ color: 'var(--bad)', padding: '20px 0' }}>{error}</p>
        ) : dates.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>📭</div>
            <p style={{ margin: 0, fontWeight: 700 }}>No answers yet</p>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '13.5px' }}>
              There is no data to export for this question on any date.
            </p>
          </div>
        ) : (
          <>
            {/* Presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '16px 0 12px' }}>
              {[
                ['today', countByDate.has(today) ? 'Today' : 'Latest day'],
                ['7', 'Last 7 days'],
                ['30', 'Last 30 days'],
                ['all', 'All data']
              ].map(([id, label]) => (
                <button key={id} className="btn small" onClick={() => applyPreset(id)}>{label}</button>
              ))}
              {(from || to) && (
                <button className="btn small ghost" onClick={() => { setFrom(null); setTo(null); }}>Clear</button>
              )}
            </div>

            {/* Month header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <button className="btn small" disabled={!canPrev} onClick={() => shiftMonth(-1)} title="Previous month">‹</button>
              <b style={{ fontFamily: 'var(--display)', fontSize: '15px' }}>
                {view ? `${MONTHS[view.m]} ${view.y}` : ''}
              </b>
              <button className="btn small" disabled={!canNext} onClick={() => shiftMonth(1)} title="Next month">›</button>
            </div>

            {/* Weekday header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
              {DOW.map((d) => (
                <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--muted)', padding: '4px 0' }}>{d}</div>
              ))}
            </div>

            {/* Days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {cells.map((key, i) => {
                if (!key) return <div key={`blank-${i}`} />;
                const s = cellState(key);
                const dayNum = parseKey(key).d;
                return (
                  <button
                    key={key}
                    disabled={s.disabled}
                    onClick={() => pick(key)}
                    title={
                      s.isFuture ? 'Future date — no data yet'
                        : !s.hasData ? 'No answers on this date'
                        : `${labelOf(key)} · ${s.count} answer${s.count === 1 ? '' : 's'}`
                    }
                    style={{
                      position: 'relative',
                      padding: '7px 2px 6px',
                      borderRadius: '10px',
                      border: s.isEdge ? '1px solid var(--accent)' : '1px solid transparent',
                      background: s.isEdge ? 'var(--accent)' : s.inRange || s.inPendingRange ? 'var(--accent-soft)' : 'transparent',
                      color: s.isEdge ? '#fff' : s.disabled ? 'var(--muted)' : 'var(--ink)',
                      opacity: s.disabled ? 0.32 : 1,
                      cursor: s.disabled ? 'not-allowed' : 'pointer',
                      fontWeight: s.isEdge || s.hasData ? 800 : 500,
                      fontSize: '13.5px',
                      lineHeight: 1.1
                    }}
                  >
                    {dayNum}
                    {s.hasData && (
                      <span style={{
                        display: 'block', fontSize: '9.5px', fontWeight: 700, marginTop: '2px',
                        color: s.isEdge ? 'rgba(255,255,255,.85)' : 'var(--accent)'
                      }}>
                        ● {s.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="muted" style={{ fontSize: '12px', margin: '10px 0 0' }}>
              Only dates with answers can be selected — future dates and empty dates are greyed out.
              Click a start date, then an end date.
            </p>

            {/* Selection summary + download */}
            <div style={{
              marginTop: '16px', padding: '12px 14px', borderRadius: '12px',
              background: 'var(--bg)', border: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap'
            }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700 }}>
                {from && to
                  ? <>{labelOf(from)}{from !== to ? ` → ${labelOf(to)}` : ''}<span className="muted" style={{ fontWeight: 600 }}> · {selectedCount} answer{selectedCount === 1 ? '' : 's'}</span></>
                  : from
                    ? <>{labelOf(from)} <span className="muted" style={{ fontWeight: 600 }}>· now pick an end date</span></>
                    : <span className="muted">No dates selected</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn" onClick={onClose}>Cancel</button>
              <a
                className={`btn primary ${!from || !to || selectedCount === 0 ? 'disabled' : ''}`}
                href={from && to ? exportCsvUrl(question.id, from, to) : undefined}
                onClick={(e) => {
                  if (!from || !to || selectedCount === 0) { e.preventDefault(); return; }
                  setTimeout(onClose, 300);
                }}
                style={!from || !to || selectedCount === 0 ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
              >
                ⬇ Download CSV{selectedCount ? ` (${selectedCount})` : ''}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
