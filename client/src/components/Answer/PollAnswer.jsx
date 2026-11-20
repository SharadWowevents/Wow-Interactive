import React, { useState, useEffect } from 'react';
import { getCloudData } from '../../api/client';
import { socket } from '../../api/socket';

export default function PollAnswer({ question, mine, selectedChoices, onVote, onChangeVote, showingDone }) {
  const [selected, setSelected] = useState(new Set(selectedChoices || []));
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState(null);

  const options = question.options || [];

  const handleToggle = (id) => {
    if (question.multi) {
      const next = new Set(selected);
      next.has(id) ? next.delete(id) : next.add(id);
      setSelected(next);
    } else {
      setSelected(new Set([id]));
    }
    setErrorMsg('');
  };

  const handleVoteSubmit = async (e) => {
    e.preventDefault();
    if (!selected.size) {
      setErrorMsg('Pick an option first.');
      return;
    }

    setIsSending(true);
    setErrorMsg('');
    try {
      await onVote([...selected]);
    } catch (err) {
      setErrorMsg(err.message || 'Could not send vote.');
    } finally {
      setIsSending(false);
    }
  };

  // Real-time live results when in done state and showResults is enabled
  useEffect(() => {
    if (showingDone && question.showResults) {
      let active = true;
      const loadResults = async () => {
        try {
          const d = await getCloudData(question.id);
          if (active && d?.options) {
            setResults(d);
          }
        } catch (_) {}
      };

      loadResults();

      // Listen for instantaneous WebSocket updates
      const handleLiveWs = (d) => {
        if (active && d?.options) {
          setResults(d);
        }
      };

      socket.on('update', handleLiveWs);
      const interval = setInterval(loadResults, 12000);

      return () => {
        active = false;
        socket.off('update', handleLiveWs);
        clearInterval(interval);
      };
    }
  }, [showingDone, question.id, question.showResults]);

  if (showingDone) {
    return (
      <div style={{ textAlign: 'center', margin: 'auto 0', padding: '30px 0' }}>
        <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '14px' }}>🗳️</div>
        <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Vote received!</h2>
        <p style={{ color: 'rgba(255,255,255,.7)', margin: 0 }}>
          You voted: <strong style={{ color: '#8ff0c9' }}>{mine.join('; ')}</strong>
        </p>

        <button
          className="btn"
          onClick={onChangeVote}
          style={{
            marginTop: '20px',
            background: 'rgba(255,255,255,.12)',
            border: 0,
            color: '#fff',
            padding: '12px 18px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          Change my vote
        </button>

        {/* Live results for voter */}
        <div style={{ width: '100%', textAlign: 'left', marginTop: '26px', display: 'grid', gap: '12px' }}>
          {question.showResults ? (
            results?.options ? (
              <>
                {results.options.map((o) => {
                  const isMine = selected.has(o.id) || selectedChoices?.includes(o.id);
                  return (
                    <div key={o.id} style={{ display: 'grid', gap: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: '15px', gap: '10px', minWidth: 0 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                          {o.text}
                          {isMine && (
                            <span style={{ color: '#8ff0c9', fontSize: '12px', fontWeight: 800, background: 'rgba(95,227,180,.15)', padding: '2px 8px', borderRadius: '6px' }}>
                              your vote
                            </span>
                          )}
                        </span>
                        <b style={{ fontWeight: 800 }}>{Math.round(o.pct || 0)}%</b>
                      </div>
                      <div style={{ height: '10px', borderRadius: '6px', background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${o.pct || 0}%`,
                          borderRadius: '6px',
                          background: isMine ? 'linear-gradient(90deg, #5fe3b4, #7c5cff)' : 'linear-gradient(90deg, #7c5cff, #e8417a)',
                          transition: 'width .8s'
                        }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '13px', textAlign: 'center', marginTop: '6px' }}>
                  {results.total} vote{results.total === 1 ? '' : 's'} so far · updates live
                </div>
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '13px', textAlign: 'center' }}>
                Loading live results…
              </div>
            )
          ) : (
            <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '13px', textAlign: 'center' }}>
              Results will be revealed on the screen.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleVoteSubmit} style={{ display: 'grid', gap: '12px' }}>
      <div style={{ display: 'grid', gap: '10px' }}>
        {options.map((o) => {
          const isChecked = selected.has(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => handleToggle(o.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                textAlign: 'left',
                padding: '15px 16px',
                borderRadius: '16px',
                border: isChecked ? '2px solid #9d8bff' : '2px solid rgba(255,255,255,.16)',
                background: isChecked ? 'rgba(124,92,255,.28)' : 'rgba(255,255,255,.07)',
                color: '#fff',
                fontSize: '18px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background .15s, border-color .15s'
              }}
            >
              <span style={{
                flex: 'none',
                width: '26px',
                height: '26px',
                borderRadius: question.multi ? '8px' : '50%',
                border: isChecked ? '2px solid #9d8bff' : '2px solid rgba(255,255,255,.45)',
                background: isChecked ? '#9d8bff' : 'transparent',
                display: 'grid',
                placeItems: 'center',
                color: '#120e26',
                fontWeight: 900,
                fontSize: '15px'
              }}>
                {isChecked ? '✓' : ''}
              </span>
              <span style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{o.text}</span>
            </button>
          );
        })}
      </div>

      <button
        type="submit"
        disabled={isSending || selected.size === 0}
        style={{
          marginTop: '18px',
          fontSize: '18px',
          padding: '15px',
          borderRadius: '16px',
          border: 0,
          background: 'linear-gradient(135deg, #7c5cff, #e8417a)',
          color: '#fff',
          fontWeight: 700,
          cursor: isSending || selected.size === 0 ? 'not-allowed' : 'pointer',
          opacity: isSending || selected.size === 0 ? 0.6 : 1
        }}
      >
        {isSending ? 'Sending…' : mine.length ? 'Update my vote' : 'Vote'}
      </button>

      <div style={{ fontSize: '14px', color: 'rgba(255,255,255,.65)', marginTop: '4px' }}>
        {question.multi ? 'Choose all that apply.' : 'Choose one option.'}
      </div>

      {errorMsg && (
        <div style={{ fontSize: '15px', color: '#ffb3c0', minHeight: '1.4em' }}>
          {errorMsg}
        </div>
      )}
    </form>
  );
}
