import React, { useState, useRef } from 'react';
import { searchCities } from '../../api/client';

export default function MapAnswer({ question, mine, onSendCity, onChangeCity, showingDone }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef(null);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setErrorMsg('');
    if (picked && val !== picked.name) setPicked(null);

    clearTimeout(timerRef.current);
    if (val.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      const results = await searchCities(val.trim());
      setSuggestions(results);
    }, 140);
  };

  const handleSelectCity = (c) => {
    setPicked(c);
    setQuery(c.name);
    setSuggestions([]);
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!picked) {
      if (suggestions.length > 0) {
        setPicked(suggestions[0]);
        await sendCityPayload(suggestions[0].id);
      } else {
        setErrorMsg('Tap your city in the list.');
      }
      return;
    }
    await sendCityPayload(picked.id);
  };

  const sendCityPayload = async (cityId) => {
    setIsSending(true);
    setErrorMsg('');
    try {
      await onSendCity(cityId);
      setQuery('');
      setPicked(null);
    } catch (err) {
      setErrorMsg(err.message || 'Could not put you on the map.');
    } finally {
      setIsSending(false);
    }
  };

  if (showingDone) {
    return (
      <div style={{ textAlign: 'center', margin: 'auto 0', padding: '30px 0' }}>
        <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '14px' }}>📍</div>
        <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>You're on the map!</h2>
        <p style={{ color: 'rgba(255,255,255,.7)', margin: 0 }}>
          {mine[mine.length - 1] || 'Your city has been added.'}
        </p>

        <button
          className="btn"
          onClick={onChangeCity}
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
          Change my city
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }} autoComplete="off">
      <div style={{ position: 'relative' }}>
        <input
          className="ans"
          value={query}
          onChange={handleInputChange}
          placeholder="Start typing your city…"
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
      </div>

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && !picked && (
        <div style={{
          borderRadius: '16px',
          background: 'rgba(20,16,40,.96)',
          border: '1px solid rgba(255,255,255,.14)',
          overflow: 'hidden'
        }}>
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelectCity(c)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 0,
                borderTop: '1px solid rgba(255,255,255,.08)',
                color: '#fff',
                padding: '13px 16px',
                fontSize: '17px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <span>{c.name}</span>
              <small style={{ display: 'block', fontWeight: 500, fontSize: '13.5px', color: 'rgba(255,255,255,.6)', marginTop: '2px' }}>
                {[c.state && c.state !== c.name ? c.state : '', c.country].filter(Boolean).join(', ')}
              </small>
            </button>
          ))}
        </div>
      )}

      {picked && (
        <div style={{ marginTop: '4px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(95,227,180,.16)',
            color: '#8ff0c9',
            padding: '6px 12px',
            borderRadius: '999px',
            fontSize: '14px',
            fontWeight: 700
          }}>
            📍 {picked.label}
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={isSending || (!picked && !suggestions.length)}
        style={{
          marginTop: '18px',
          fontSize: '18px',
          padding: '15px',
          borderRadius: '16px',
          border: 0,
          background: 'linear-gradient(135deg, #7c5cff, #e8417a)',
          color: '#fff',
          fontWeight: 700,
          cursor: isSending || (!picked && !suggestions.length) ? 'not-allowed' : 'pointer',
          opacity: isSending || (!picked && !suggestions.length) ? 0.6 : 1
        }}
      >
        {isSending ? 'Sending…' : 'Put me on the map'}
      </button>

      <div style={{ fontSize: '14px', color: 'rgba(255,255,255,.65)', marginTop: '4px' }}>
        {mine.length ? `Currently: ${mine[mine.length - 1]}` : 'Type the first few letters, then tap your city.'}
      </div>

      {errorMsg && (
        <div style={{ fontSize: '15px', color: '#ffb3c0', minHeight: '1.4em' }}>
          {errorMsg}
        </div>
      )}
    </form>
  );
}
