import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicQuestion, submitAnswer } from '../api/client';
import { socket, joinQuestionRoom, leaveQuestionRoom } from '../api/socket';
import CloudAnswer from '../components/Answer/CloudAnswer';
import PollAnswer from '../components/Answer/PollAnswer';
import MapAnswer from '../components/Answer/MapAnswer';

function getOrCreatePid() {
  try {
    let pid = localStorage.getItem('wc_pid');
    if (!pid) {
      pid = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('wc_pid', pid);
    }
    return pid;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2);
  }
}

export default function AnswerPage() {
  const { id } = useParams();
  const [pid] = useState(getOrCreatePid);
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [mine, setMine] = useState([]);
  const [selectedChoices, setSelectedChoices] = useState([]);
  const [showingDone, setShowingDone] = useState(false);

  const mineKey = useCallback((resetAt = 0) => `wc_mine_${id}_${resetAt}`, [id]);
  const choiceKey = useCallback((resetAt = 0) => `wc_choice_${id}_${resetAt}`, [id]);

  const loadQuestion = useCallback(async (isFirst = false) => {
    try {
      const q = await getPublicQuestion(id);
      setQuestion(prev => {
        if (prev && q.resetAt !== prev.resetAt) {
          setShowingDone(false);
          setMine([]);
          setSelectedChoices([]);
        }
        return q;
      });

      // Load participant's stored answers for this version of the question
      try {
        const stored = JSON.parse(localStorage.getItem(mineKey(q.resetAt)) || '[]');
        setMine(stored);
        if (q.type === 'poll') {
          const storedChoices = JSON.parse(localStorage.getItem(choiceKey(q.resetAt)) || '[]');
          setSelectedChoices(storedChoices);
        }
        if (stored.length > 0) {
          setShowingDone(true);
        }
      } catch (_) {}

      setMissing(false);
    } catch (err) {
      if (isFirst) setMissing(true);
    } finally {
      if (isFirst) setLoading(false);
    }
  }, [id, mineKey, choiceKey]);

  useEffect(() => {
    loadQuestion(true);

    // Join room for real-time push events from admin
    joinQuestionRoom(id);

    const handleMeta = (meta) => {
      if (!meta) return;
      setQuestion(prev => {
        if (!prev) return prev;
        const resetChanged = meta.resetAt && meta.resetAt !== prev.resetAt;
        if (resetChanged) {
          setShowingDone(false);
          setMine([]);
          setSelectedChoices([]);
        }
        return {
          ...prev,
          open: meta.open !== undefined ? meta.open : prev.open,
          showResults: meta.showResults !== undefined ? meta.showResults : prev.showResults,
          resetAt: meta.resetAt !== undefined ? meta.resetAt : prev.resetAt,
          text: meta.text || prev.text,
          options: meta.options || prev.options
        };
      });
    };

    const handleDeleted = () => {
      setMissing(true);
    };

    socket.on('meta', handleMeta);
    socket.on('deleted', handleDeleted);
    socket.on('connect', () => joinQuestionRoom(id));

    // Backup polling at 15s interval
    const interval = setInterval(() => loadQuestion(false), 15000);

    return () => {
      socket.off('meta', handleMeta);
      socket.off('deleted', handleDeleted);
      socket.off('connect');
      leaveQuestionRoom(id);
      clearInterval(interval);
    };
  }, [id, loadQuestion]);

  const handleSendCloudAnswer = async (text) => {
    const res = await submitAnswer(id, { text, pid });
    const nextMine = [...mine, text];
    setMine(nextMine);
    try {
      localStorage.setItem(mineKey(question.resetAt), JSON.stringify(nextMine));
    } catch (_) {}
    setShowingDone(true);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const handleSendPollVote = async (choices) => {
    const res = await submitAnswer(id, { choices, pid });
    const optionMap = new Map((question.options || []).map(o => [o.id, o.text]));
    const nextMine = [choices.map(c => optionMap.get(c) || c).join(', ')];
    setMine(nextMine);
    setSelectedChoices(choices);
    try {
      localStorage.setItem(mineKey(question.resetAt), JSON.stringify(nextMine));
      localStorage.setItem(choiceKey(question.resetAt), JSON.stringify(choices));
    } catch (_) {}
    setShowingDone(true);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const handleSendCity = async (cityId) => {
    const res = await submitAnswer(id, { cityId, pid });
    const nextMine = [res.city.label];
    setMine(nextMine);
    try {
      localStorage.setItem(mineKey(question.resetAt), JSON.stringify(nextMine));
    } catch (_) {}
    setShowingDone(true);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100svh',
        background: 'radial-gradient(120% 80% at 10% 0%, #3b1f8f 0%, #17122e 55%, #0d0b1a 100%)',
        color: '#fff',
        display: 'grid',
        placeItems: 'center'
      }}>
        <p style={{ opacity: 0.7 }}>Loading…</p>
      </div>
    );
  }

  if (missing) {
    return (
      <div style={{
        minHeight: '100svh',
        background: 'radial-gradient(120% 80% at 10% 0%, #3b1f8f 0%, #17122e 55%, #0d0b1a 100%)',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ fontSize: '64px', marginBottom: '14px' }}>🤔</div>
          <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Question not found</h2>
          <p style={{ opacity: 0.7, margin: 0 }}>This QR code is no longer active.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100svh',
      background: 'radial-gradient(120% 80% at 10% 0%, #3b1f8f 0%, #17122e 55%, #0d0b1a 100%)',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        margin: '0 auto',
        padding: '32px 20px 48px',
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          fontSize: '12px',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: '#b9aaff'
        }}>
          {question.type === 'poll' ? 'Live poll' : question.type === 'map' ? 'Where are you from?' : 'Live question'}
        </div>

        <h1 style={{
          fontSize: 'clamp(26px, 7.5vw, 36px)',
          lineHeight: 1.15,
          margin: '10px 0 26px',
          fontWeight: 800
        }}>
          {question.text}
        </h1>

        {!question.open ? (
          <div style={{ textAlign: 'center', margin: 'auto 0', padding: '30px 0' }}>
            <div style={{ fontSize: '64px', marginBottom: '14px' }}>⏸</div>
            <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>
              {question.type === 'poll' ? 'Voting is closed' : 'Answers are closed'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,.7)', margin: 0 }}>
              Keep an eye on the screen for the next question.
            </p>
          </div>
        ) : (
          <>
            {question.type === 'cloud' && (
              <CloudAnswer
                question={question}
                mine={mine}
                onSendAnswer={handleSendCloudAnswer}
                onAddAnother={() => setShowingDone(false)}
                showingDone={showingDone}
              />
            )}

            {question.type === 'poll' && (
              <PollAnswer
                question={question}
                mine={mine}
                selectedChoices={selectedChoices}
                onVote={handleSendPollVote}
                onChangeVote={() => setShowingDone(false)}
                showingDone={showingDone}
              />
            )}

            {question.type === 'map' && (
              <MapAnswer
                question={question}
                mine={mine}
                onSendCity={handleSendCity}
                onChangeCity={() => setShowingDone(false)}
                showingDone={showingDone}
              />
            )}
          </>
        )}

        {/* Previously submitted answers list for Cloud */}
        {question.type === 'cloud' && mine.length > 0 && !showingDone && (
          <div style={{ marginTop: '28px' }}>
            <h2 style={{
              fontSize: '13px',
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,.55)',
              fontWeight: 700,
              marginBottom: '10px'
            }}>
              Your answers
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {mine.map((m, idx) => (
                <li key={idx} style={{ background: 'rgba(255,255,255,.1)', padding: '8px 14px', borderRadius: '999px', fontWeight: 600 }}>
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer style={{ marginTop: 'auto', paddingTop: '30px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,.35)' }}>
          Wow Interactive · answers are anonymous
        </footer>
      </div>
    </div>
  );
}
