import React, { useState } from 'react';
import CityAutocomplete from './CityAutocomplete';

const MAP_DEFAULT = 'Where are you joining us from?';

export default function CreateQuestionForm({ onCreate }) {
  const [type, setType] = useState('cloud');
  const [text, setText] = useState('');
  const [mode, setMode] = useState('phrase');
  const [maxPerPerson, setMaxPerPerson] = useState(3);
  const [venue, setVenue] = useState(null);
  const [options, setOptions] = useState([{ text: '' }, { text: '' }]);
  const [multi, setMulti] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTabChange = (t) => {
    setType(t);
    if (t === 'map' && !text) setText(MAP_DEFAULT);
    if (t === 'cloud' && text === MAP_DEFAULT) setText('');
  };

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

    let payload = { type, text: text.trim() };
    if (type === 'cloud') {
      payload.mode = mode;
      payload.maxPerPerson = Number(maxPerPerson);
    } else if (type === 'map') {
      payload.venueId = venue ? venue.id : null;
    } else if (type === 'poll') {
      const cleaned = options.map(o => ({ text: o.text.trim() })).filter(o => o.text);
      if (cleaned.length < 2) {
        alert('A poll needs at least 2 options');
        return;
      }
      payload.options = cleaned;
      payload.multi = multi;
      payload.showResults = showResults;
    }

    setIsSubmitting(true);
    try {
      await onCreate(payload);
      setText(type === 'map' ? MAP_DEFAULT : '');
      setVenue(null);
      if (type === 'poll') {
        setOptions([{ text: '' }, { text: '' }]);
        setMulti(false);
        setShowResults(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="card create" onSubmit={handleSubmit} style={{ padding: '20px', marginBottom: '28px' }}>
      {/* Tabs */}
      <div style={{
        display: 'inline-flex',
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: '12px',
        padding: '4px',
        gap: '4px',
        marginBottom: '16px'
      }}>
        <button
          type="button"
          onClick={() => handleTabChange('cloud')}
          style={{
            border: 0,
            background: type === 'cloud' ? 'var(--surface)' : 'none',
            color: type === 'cloud' ? 'var(--ink)' : 'var(--muted)',
            boxShadow: type === 'cloud' ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            padding: '8px 14px',
            borderRadius: '9px',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          ☁️ Word cloud
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('map')}
          style={{
            border: 0,
            background: type === 'map' ? 'var(--surface)' : 'none',
            color: type === 'map' ? 'var(--ink)' : 'var(--muted)',
            boxShadow: type === 'map' ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            padding: '8px 14px',
            borderRadius: '9px',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          📍 Map: where are you from?
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('poll')}
          style={{
            border: 0,
            background: type === 'poll' ? 'var(--surface)' : 'none',
            color: type === 'poll' ? 'var(--ink)' : 'var(--muted)',
            boxShadow: type === 'poll' ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            padding: '8px 14px',
            borderRadius: '9px',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          📊 Poll
        </button>
      </div>

      {/* Grid Inputs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: type === 'map' ? '1fr 300px auto' : type === 'poll' ? '1fr auto' : '1fr 170px 150px auto',
        gap: '12px',
        alignItems: 'end'
      }}>
        <label className="field" style={{ minWidth: 0 }}>
          Question
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            placeholder={type === 'map' ? MAP_DEFAULT : type === 'poll' ? 'e.g. Which session did you enjoy most?' : "e.g. Describe today's event in one word"}
            required
          />
        </label>

        {type === 'map' && (
          <label className="field" title="Draws travel lines and shows distances on the live map">
            Event city · optional
            <CityAutocomplete
              value={venue}
              onChange={setVenue}
              placeholder="e.g. Jaipur"
            />
          </label>
        )}

        {type === 'cloud' && (
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
              <select className="input" value={maxPerPerson} onChange={(e) => setMaxPerPerson(Number(e.target.value))}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </label>
          </>
        )}

        <button
          className="btn primary"
          type="submit"
          disabled={isSubmitting}
          style={{ height: '44px', fontWeight: 700 }}
        >
          {type === 'poll' ? 'Create poll' : 'Create question'}
        </button>

        {type === 'poll' && (
          <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>Options</span>
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
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
              <button
                type="button"
                className="btn small"
                onClick={handleAddOption}
                disabled={options.length >= 8}
              >
                + Add option
              </button>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '14px', fontWeight: 600 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={multi}
                    onChange={(e) => setMulti(e.target.checked)}
                    style={{ width: '17px', height: '17px', accentColor: 'var(--accent)' }}
                  />
                  Allow multiple answers
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showResults}
                    onChange={(e) => setShowResults(e.target.checked)}
                    style={{ width: '17px', height: '17px', accentColor: 'var(--accent)' }}
                  />
                  Show results live on screen
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
