import React, { useState, useEffect } from 'react';
import CityAutocomplete from './CityAutocomplete';

export default function EditModal({ question, onClose, onSave }) {
  const [text, setText] = useState(question.text || '');
  const [mode, setMode] = useState(question.mode || 'phrase');
  const [maxPerPerson, setMaxPerPerson] = useState(question.maxPerPerson || 3);
  const [venue, setVenue] = useState(question.venue || null);
  const [options, setOptions] = useState(question.options?.map(o => ({ ...o })) || [{ text: '' }, { text: '' }]);
  const [multi, setMulti] = useState(!!question.multi);
  const [showResults, setShowResults] = useState(question.showResults !== false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleAddOption = () => {
    if (options.length >= 8) return;
    setOptions([...options, { text: '' }]);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index, val) => {
    const updated = [...options];
    updated[index].text = val;
    setOptions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    let payload = { text: text.trim() };
    if (question.type === 'cloud') {
      payload.mode = mode;
      payload.maxPerPerson = Number(maxPerPerson);
    } else if (question.type === 'map') {
      payload.venueId = venue ? venue.id : null;
    } else if (question.type === 'poll') {
      const cleaned = options.map(o => ({ id: o.id, text: o.text.trim() })).filter(o => o.text);
      if (cleaned.length < 2) return;
      payload.options = cleaned;
      payload.multi = multi;
      payload.showResults = showResults;
    }

    setIsSubmitting(true);
    try {
      await onSave(question.id, payload);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>
          Edit {question.type === 'map' ? 'map question' : question.type === 'poll' ? 'poll' : 'question'}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          <label className="field">
            Question
            <input
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              required
            />
          </label>

          {question.type === 'cloud' && (
            <>
              <label className="field">
                Cloud counts
                <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="phrase">Whole answers</option>
                  <option value="words">Individual words</option>
                </select>
              </label>
              <label className="field">
                Answers per person
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="10"
                  value={maxPerPerson}
                  onChange={(e) => setMaxPerPerson(e.target.value)}
                />
              </label>
            </>
          )}

          {question.type === 'map' && (
            <label className="field">
              Event city (optional)
              <CityAutocomplete
                value={venue}
                onChange={setVenue}
                placeholder="e.g. Jaipur"
              />
              <span className="muted" style={{ fontSize: '12px', fontWeight: 500 }}>
                With an event city, the live map draws travel lines and calculates total distance.
              </span>
            </label>
          )}

          {question.type === 'poll' && (
            <div className="field">
              <span>Options</span>
              <div style={{ display: 'grid', gap: '8px', marginTop: '6px' }}>
                {options.map((opt, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 36px', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'var(--accent-soft)',
                      color: '#3a23c4',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      fontSize: '13px'
                    }}>
                      {String.fromCharCode(65 + i)}
                    </div>
                    <input
                      className="input"
                      value={opt.text}
                      onChange={(e) => handleOptionChange(i, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      maxLength={80}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && i === options.length - 1 && opt.text.trim()) {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn danger small"
                      onClick={() => handleRemoveOption(i)}
                      disabled={options.length <= 2}
                      style={{ height: '36px', padding: 0 }}
                      title="Remove option"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn small"
                  onClick={handleAddOption}
                  disabled={options.length >= 8}
                >
                  + Add option
                </button>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px', fontSize: '13.5px', fontWeight: 600 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={multi}
                    onChange={(e) => setMulti(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', width: '16px', height: '16px' }}
                  />
                  Allow multiple answers
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showResults}
                    onChange={(e) => setShowResults(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', width: '16px', height: '16px' }}
                  />
                  Show results live on screen
                </label>
              </div>
            </div>
          )}

          <p className="muted" style={{ margin: 0, fontSize: '12.5px' }}>
            The QR code and answer links stay the same after editing.
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
            <button type="button" className="btn" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
