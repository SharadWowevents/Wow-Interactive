import React, { useEffect } from 'react';

export default function QrModal({ question, onClose }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!question) return null;

  const answerUrl = question.links?.answer || '';
  const displayUrl = answerUrl.replace(/^https?:\/\//, '');

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box qr">
        <h2 style={{ fontSize: 'clamp(22px, 3.4vw, 36px)', marginBottom: '18px' }}>
          {question.text}
        </h2>
        <div style={{ maxWidth: '420px', margin: '0 auto', background: '#fff', borderRadius: '18px', padding: '16px', boxShadow: '0 8px 30px rgba(0,0,0,.08)' }}>
          <img
            alt="QR code"
            src={`/api/questions/${question.id}/qr.svg`}
            style={{ width: '100%', aspectRatio: '1', display: 'block' }}
          />
        </div>
        <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '16px', wordBreak: 'break-all', color: 'var(--ink)' }}>
          {displayUrl}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '24px', flexWrap: 'wrap' }}>
          <a
            className="btn"
            href={`/api/questions/${question.id}/qr.png?size=1200&download=1`}
          >
            Download PNG
          </a>
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
