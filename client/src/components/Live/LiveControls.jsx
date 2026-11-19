import React, { useEffect, useState } from 'react';

export default function LiveControls({
  showQr,
  onToggleQr,
  theme,
  onToggleTheme,
  onToggleFullscreen,
  onFitCenter,
  isMap = false,
  isReconnecting = false
}) {
  const [isMouseActive, setIsMouseActive] = useState(false);

  useEffect(() => {
    let timer;
    const handleMouseMove = () => {
      setIsMouseActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setIsMouseActive(false), 2500);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          display: 'flex',
          gap: '6px',
          opacity: isMouseActive ? 1 : 0,
          transition: 'opacity .3s',
          zIndex: 700
        }}
      >
        <button
          onClick={onToggleQr}
          title="Show / hide QR (Q)"
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--panel-line)',
            color: 'var(--fg)',
            padding: '7px 11px',
            borderRadius: '9px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)'
          }}
        >
          QR
        </button>
        <button
          onClick={onToggleTheme}
          title="Light / dark (T)"
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--panel-line)',
            color: 'var(--fg)',
            padding: '7px 11px',
            borderRadius: '9px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)'
          }}
        >
          Theme
        </button>
        {isMap && onFitCenter && (
          <button
            onClick={onFitCenter}
            title="Re-centre (C)"
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--panel-line)',
              color: 'var(--fg)',
              padding: '7px 11px',
              borderRadius: '9px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              backdropFilter: 'blur(6px)'
            }}
          >
            Re-centre
          </button>
        )}
        <button
          onClick={onToggleFullscreen}
          title="Full screen (F)"
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--panel-line)',
            color: 'var(--fg)',
            padding: '7px 11px',
            borderRadius: '9px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)'
          }}
        >
          Full screen
        </button>
      </div>

      {isReconnecting && (
        <div style={{
          position: 'fixed',
          left: '50%',
          top: '10px',
          transform: 'translateX(-50%)',
          background: '#c62d42',
          color: '#fff',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 700,
          zIndex: 800
        }}>
          Reconnecting…
        </div>
      )}
    </>
  );
}
