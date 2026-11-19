import React, { useState } from 'react';

export default function CloudAnswer({ question, mine, onSendAnswer, onAddAnother, showingDone }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const maxPerPerson = question.maxPerPerson || 3;
  const answersLeft = Math.max(0, maxPerPerson - mine.length);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setErrorMsg('Type an answer first.');
      return;
    }

    setIsSending(true);
    setErrorMsg('');
    try {
      await onSendAnswer(trimmed);
      setText('');
    } catch (err) {
      setErrorMsg(err.message || 'Could not send. Try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (showingDone || answersLeft === 0) {
    return (
      <div style={{ textAlign: 'center', margin: 'auto 0', padding: '30px 0' }}>
        <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '14px' }}>✨</div>
        <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Thank you!</h2>
        <p style={{ color: 'rgba(255,255,255,.7)', margin: 0 }}>
          {answersLeft === 0
            ? 'Your answers are on the screen. Watch the cloud grow!'
            : `Your answer is on the screen. You can add ${answersLeft} more.`}
        </p>
        {answersLeft > 0 && (
          <button
            className="btn"
            onClick={onAddAnother}
            style={{
              marginTop: '20px',
              background: 'rgba(255,255,255,.12)',
              border: 0,
              color: '#fff',
              padding: '12px 18px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '15px'
            }}
          >
            Add another answer
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }} autoComplete="off">
      <div style={{ position: 'relative' }}>
        <input
          className="ans"
          value={text}
          onChange={(e) => { setText(e.target.value); setErrorMsg(''); }}
          maxLength={question.maxLength || 40}
          placeholder="Type a few words…"
          autoComplete="off"
          autoFocus
          style={{
            width: '100%',
            fontSize: '20px',
            padding: '16px 18px',
            borderRadius: '16px',
            border: '2px solid rgba(255,255,255,.18)',
            background: 'rgba(255,255,255,.08)',
            color: '#fff',
            outline: 'none'
          }}
        />
        <span style={{
          position: 'absolute',
          right: '14px',
          bottom: '-22px',
          fontSize: '12px',
          color: 'rgba(255,255,255,.5)'
        }}>
          {text.length ? `${text.length}/${question.maxLength || 40}` : ''}
        </span>
      </div>

      <button
        type="submit"
        disabled={isSending || !text.trim()}
        style={{
          marginTop: '18px',
          fontSize: '18px',
          padding: '15px',
          borderRadius: '16px',
          border: 0,
          background: 'linear-gradient(135deg, #7c5cff, #e8417a)',
          color: '#fff',
          fontWeight: 700,
          cursor: isSending || !text.trim() ? 'not-allowed' : 'pointer',
          opacity: isSending || !text.trim() ? 0.6 : 1
        }}
      >
        {isSending ? 'Sending…' : 'Send answer'}
      </button>

      <div style={{ fontSize: '14px', color: 'rgba(255,255,255,.65)', marginTop: '4px' }}>
        {maxPerPerson > 1
          ? `You can send up to ${maxPerPerson} answers · ${answersLeft} left`
          : 'Keep it short — one to three words works best.'}
      </div>

      {errorMsg && (
        <div style={{ fontSize: '15px', color: '#ffb3c0', minHeight: '1.4em' }}>
          {errorMsg}
        </div>
      )}
    </form>
  );
}
