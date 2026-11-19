import React, { useState, useEffect, useRef } from 'react';
import { searchCities } from '../../api/client';

export default function CityAutocomplete({ value, onChange, placeholder = 'e.g. Jaipur', className = '' }) {
  const [query, setQuery] = useState(value?.label || value?.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    setQuery(value?.label || value?.name || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(null); // Clear picked object when typed manually

    clearTimeout(timerRef.current);
    if (val.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      const results = await searchCities(val.trim());
      setSuggestions(results);
      setIsOpen(results.length > 0);
    }, 150);
  };

  const handleSelect = (city) => {
    setQuery(city.label);
    onChange(city);
    setIsOpen(false);
  };

  return (
    <div className={`citybox ${className}`} ref={containerRef} style={{ position: 'relative' }}>
      <input
        className="input"
        value={query}
        onChange={handleInputChange}
        onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isOpen && (
        <div
          className="city-sugg"
          style={{
            position: 'absolute',
            zIndex: 100,
            left: 0,
            right: 0,
            top: 'calc(100% + 4px)',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow)',
            maxHeight: '240px',
            overflowY: 'auto'
          }}
        >
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 0,
                background: 'none',
                padding: '10px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--ink)',
                borderBottom: '1px solid var(--line)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-soft)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              <span>{c.name}</span>
              <small style={{ color: 'var(--muted)', fontWeight: 500, marginLeft: '6px' }}>
                {[c.state && c.state !== c.name ? c.state : '', c.country].filter(Boolean).join(', ')}
              </small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
