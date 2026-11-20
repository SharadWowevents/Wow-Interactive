import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getCloudData } from '../api/client';
import { socket, joinQuestionRoom, leaveQuestionRoom } from '../api/socket';
import LiveCloud from '../components/Live/LiveCloud';
import LivePoll from '../components/Live/LivePoll';
import LiveMap from '../components/Live/LiveMap';
import LiveControls from '../components/Live/LiveControls';

export default function LivePage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const initialTheme = searchParams.get('theme') || localStorage.getItem('wc_theme') || 'dark';
  const initialQr = searchParams.get('qr') !== '0' && localStorage.getItem('wc_qr') !== '0';

  const [theme, setTheme] = useState(initialTheme);
  const [showQr, setShowQr] = useState(initialQr);

  // Toggle Theme
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('wc_theme', next);
      return next;
    });
  }, []);

  // Toggle QR
  const toggleQr = useCallback(() => {
    setShowQr(prev => {
      const next = !prev;
      localStorage.setItem('wc_qr', next ? '1' : '0');
      return next;
    });
  }, []);

  // Toggle Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  // Keyboard Shortcuts: Q, T, F, C
  useEffect(() => {
    const handleKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'q') toggleQr();
      if (k === 't') toggleTheme();
      if (k === 'f') toggleFullscreen();
      if (k === 'c') window.dispatchEvent(new CustomEvent('livemap:fit'));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleQr, toggleTheme, toggleFullscreen]);

  // Day-wise rollover: if this screen stays on overnight, refetch exactly
  // at midnight so it starts the new day fresh (server also pushes an
  // update then — this is the belt-and-braces fallback).
  useEffect(() => {
    if (!data?.nextDayStart) return;
    const delay = Math.max(1000, data.nextDayStart - Date.now() + 800);
    const timer = setTimeout(async () => {
      try {
        setData(await getCloudData(id));
      } catch (_) {}
    }, delay);
    return () => clearTimeout(timer);
  }, [data?.nextDayStart, id]);

  // Real-Time WebSockets & Fallback SSE Stream Setup
  useEffect(() => {
    let es = null;
    let failTimer = null;
    let pollInterval = null;

    const initialFetch = async () => {
      try {
        const d = await getCloudData(id);
        setData(d);
        setMissing(false);
      } catch (err) {
        setMissing(true);
      }
    };

    initialFetch();

    // 1. WebSockets Real-time connection
    joinQuestionRoom(id);

    const handleWsUpdate = (updatedData) => {
      if (updatedData) {
        setData(updatedData);
        setMissing(false);
        setIsReconnecting(false);
      }
    };

    const handleWsDeleted = () => {
      setMissing(true);
    };

    const handleWsConnect = () => {
      setIsReconnecting(false);
      joinQuestionRoom(id);
    };

    const handleWsDisconnect = () => {
      setIsReconnecting(true);
    };

    socket.on('update', handleWsUpdate);
    socket.on('deleted', handleWsDeleted);
    socket.on('connect', handleWsConnect);
    socket.on('disconnect', handleWsDisconnect);

    // 2. Setup SSE as fallback
    try {
      es = new EventSource(`/api/public/questions/${id}/stream`);

      es.onmessage = (e) => {
        clearTimeout(failTimer);
        setIsReconnecting(false);
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        try {
          const d = JSON.parse(e.data);
          if (d.deleted) {
            setMissing(true);
            es.close();
          } else {
            setData(d);
          }
        } catch (_) {}
      };

      es.onerror = () => {
        clearTimeout(failTimer);
        failTimer = setTimeout(() => {
          if (!socket.connected) {
            setIsReconnecting(true);
          }
          if (!pollInterval && !socket.connected) {
            pollInterval = setInterval(async () => {
              try {
                const d = await getCloudData(id);
                setData(d);
                setIsReconnecting(false);
              } catch (_) {}
            }, 4000);
          }
        }, 3500);
      };
    } catch (_) {}

    return () => {
      socket.off('update', handleWsUpdate);
      socket.off('deleted', handleWsDeleted);
      socket.off('connect', handleWsConnect);
      socket.off('disconnect', handleWsDisconnect);
      leaveQuestionRoom(id);

      clearTimeout(failTimer);
      if (pollInterval) clearInterval(pollInterval);
      if (es) es.close();
    };
  }, [id]);

  if (missing) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        background: theme === 'light' ? '#f7f5f0' : '#08070f',
        color: theme === 'light' ? '#17151f' : '#fff'
      }}>
        <div>
          <h2>Question not found</h2>
          <p style={{ opacity: 0.7 }}>It may have been deleted.</p>
        </div>
      </div>
    );
  }

  const isLight = theme === 'light';

  return (
    <div
      className={isLight ? 'light' : ''}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: isLight
          ? '#f7f5f0'
          : 'radial-gradient(90% 70% at 15% 0%, #2c1874 0%, #120e26 55%, #08070f 100%)',
        color: isLight ? '#17151f' : '#fff',
        ['--fg']: isLight ? '#17151f' : '#fff',
        ['--fg2']: isLight ? '#5d5a6b' : 'rgba(255,255,255,.62)',
        ['--panel']: isLight ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.07)',
        ['--panel-line']: isLight ? '#e6e3dc' : 'rgba(255,255,255,.12)',
        ['--track']: isLight ? '#eeebe4' : 'rgba(255,255,255,.07)',
        ['--sea']: isLight ? '#dfe7ef' : '#0a0918',
        ['--land']: isLight ? '#ffffff' : '#1d1940',
        ['--land-hot']: isLight ? '#ece7ff' : '#2f2672',
        ['--border']: isLight ? '#c9cfda' : '#3a3470',
        ['--arc']: isLight ? '#5b3df5' : '#ffd166',
        ['--dot']: isLight ? '#e8417a' : '#ff5c8a',
        ['--top']: isLight ? '#5b3df5' : '#ffd166'
      }}
    >
      {data?.dayLabel && (
        <div
          title={`Showing only today's answers (${data.timezone || 'Asia/Kolkata'}). Resets at midnight.`}
          style={{
            position: 'fixed',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 650,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '6px 13px',
            borderRadius: '999px',
            background: 'var(--panel)',
            border: '1px solid var(--panel-line)',
            color: 'var(--fg2)',
            fontWeight: 700,
            fontSize: 'clamp(11px, 1vw, 14px)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            backdropFilter: 'blur(6px)'
          }}
        >
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#5fe3b4', flex: 'none' }} />
          Today · {data.dayLabel}
        </div>
      )}

      <LiveControls
        showQr={showQr}
        onToggleQr={toggleQr}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleFullscreen={toggleFullscreen}
        onFitCenter={() => window.dispatchEvent(new CustomEvent('livemap:fit'))}
        isMap={data?.type === 'map'}
        isReconnecting={isReconnecting}
      />

      {data?.type === 'map' ? (
        <LiveMap data={data} showQr={showQr} theme={theme} />
      ) : data?.type === 'poll' ? (
        <LivePoll data={data} showQr={showQr} />
      ) : (
        <LiveCloud data={data} showQr={showQr} theme={theme} />
      )}
    </div>
  );
}
