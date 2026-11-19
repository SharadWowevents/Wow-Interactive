import React, { useState, useEffect, useCallback } from 'react';
import {
  getQuestions,
  createQuestion,
  updateQuestion,
  clearQuestion,
  deleteQuestion,
  login,
  logout,
  checkAuth
} from '../api/client';
import { socket, joinAdminRoom, leaveAdminRoom } from '../api/socket';
import CreateQuestionForm from '../components/Admin/CreateQuestionForm';
import QuestionCard from '../components/Admin/QuestionCard';
import QrModal from '../components/Admin/QrModal';
import EditModal from '../components/Admin/EditModal';
import ChangePasswordModal from '../components/Admin/ChangePasswordModal';
import Toast from '../components/Common/Toast';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [questions, setQuestions] = useState([]);
  const [activeQrQuestion, setActiveQrQuestion] = useState(null);
  const [activeEditQuestion, setActiveEditQuestion] = useState(null);
  const [isChangePwOpen, setIsChangePwOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2400);
  }, []);

  const fetchQuestions = useCallback(async () => {
    try {
      const data = await getQuestions();
      setQuestions(data.questions || []);
    } catch (err) {
      if (err.message === 'AUTH_REQUIRED') {
        setIsAuthenticated(false);
      }
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    let mounted = true;
    checkAuth().then((auth) => {
      if (!mounted) return;
      setIsAuthenticated(auth);
      if (auth) fetchQuestions();
      setIsLoading(false);
    });
    return () => { mounted = false; };
  }, [fetchQuestions]);

  // Real-time WebSockets update subscription for admin
  useEffect(() => {
    if (!isAuthenticated) return;

    joinAdminRoom();

    const handleAdminUpdate = () => {
      fetchQuestions();
    };

    socket.on('admin_update', handleAdminUpdate);
    socket.on('connect', joinAdminRoom);

    // Backup polling at relaxed 15s interval
    const interval = setInterval(fetchQuestions, 15000);

    return () => {
      socket.off('admin_update', handleAdminUpdate);
      socket.off('connect', joinAdminRoom);
      leaveAdminRoom();
      clearInterval(interval);
    };
  }, [isAuthenticated, fetchQuestions]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginErr('');
    try {
      await login(password);
      setPassword('');
      setIsAuthenticated(true);
      fetchQuestions();
      showToast('Signed in successfully');
    } catch (err) {
      setLoginErr(err.message || 'Sign in failed');
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
    setQuestions([]);
    showToast('Signed out');
  };

  const handleCreate = async (payload) => {
    try {
      await createQuestion(payload);
      showToast(payload.type === 'map' ? 'Map question created' : payload.type === 'poll' ? 'Poll created' : 'Question created');
      fetchQuestions();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleEditSave = async (id, payload) => {
    try {
      await updateQuestion(id, payload);
      showToast('Changes saved');
      fetchQuestions();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleToggleOpen = async (q) => {
    try {
      await updateQuestion(q.id, { open: !q.open });
      showToast(q.open ? 'Answers closed' : 'Answers reopened');
      fetchQuestions();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleToggleResults = async (q) => {
    try {
      await updateQuestion(q.id, { showResults: !q.showResults });
      showToast(q.showResults ? 'Results hidden on screen' : 'Results revealed!');
      fetchQuestions();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleClear = async (q) => {
    if (window.confirm(`Reset “${q.text}”?\n\nAll ${q.total} answers will be deleted. The question reopens with the same QR code.`)) {
      try {
        await clearQuestion(q.id);
        showToast('Reset — ready for a fresh audience');
        fetchQuestions();
      } catch (err) {
        showToast(err.message);
      }
    }
  };

  const handleDelete = async (q) => {
    if (window.confirm(`Delete “${q.text}” and all its answers? Its QR code will stop working.`)) {
      try {
        await deleteQuestion(q.id);
        showToast('Question deleted');
        fetchQuestions();
      } catch (err) {
        showToast(err.message);
      }
    }
  };

  const handleHideWord = async (q, key) => {
    try {
      await updateQuestion(q.id, { hidden: [...q.hidden, key] });
      showToast('Hidden from cloud');
      fetchQuestions();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleUnhideWord = async (q, key) => {
    try {
      await updateQuestion(q.id, { hidden: q.hidden.filter(h => h !== key) });
      showToast('Restored to cloud');
      fetchQuestions();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleCopyLink = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Link copied to clipboard');
    } catch {
      showToast('Failed to copy');
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
        Loading…
      </div>
    );
  }

  // Login View
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '20px' }}>
        <div className="card login" style={{ maxWidth: '380px', width: '100%', padding: '28px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '11px',
            background: 'linear-gradient(135deg, #5b3df5, #e8417a 70%, #ffb547)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            fontFamily: 'var(--display)',
            fontWeight: 800
          }}>
            W
          </div>
          <h1 style={{ fontSize: '24px', margin: '14px 0 6px' }}>Admin sign in</h1>
          <p className="muted" style={{ margin: 0, fontSize: '14px' }}>
            Enter the admin password to manage interactive sessions.
          </p>
          <form onSubmit={handleLoginSubmit} style={{ display: 'grid', gap: '12px', marginTop: '18px' }}>
            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
            <button className="btn primary" type="submit" style={{ height: '42px', fontWeight: 700 }}>
              Sign in
            </button>
            {loginErr && (
              <div style={{ color: 'var(--bad)', fontSize: '13.5px', marginTop: '4px' }}>
                {loginErr}
              </div>
            )}
          </form>
        </div>
        <Toast message={toastMsg} />
      </div>
    );
  }

  // Admin Dashboard View
  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '28px 20px 80px' }}>
      {/* Top Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '11px',
            background: 'linear-gradient(135deg, #5b3df5, #e8417a 70%, #ffb547)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            fontFamily: 'var(--display)',
            fontWeight: 800
          }}>
            W
          </div>
          <div>
            <h1 style={{ fontSize: '22px' }}>Wow Interactive</h1>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              MERN live word clouds, interactive maps &amp; polls
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn small" onClick={() => setIsChangePwOpen(true)}>
            🔒 Change password
          </button>
          <button className="btn ghost" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      {/* Create Form */}
      <CreateQuestionForm onCreate={handleCreate} />

      {/* Questions Section */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 2px 12px' }}>
        <h2 style={{ fontSize: '17px' }}>Your questions</h2>
        <span className="muted" style={{ fontSize: '13px' }}>
          {questions.length ? `${questions.length} question${questions.length > 1 ? 's' : ''}` : ''}
        </span>
      </div>

      <div>
        {questions.length === 0 ? (
          <div className="card empty" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>
            No questions yet. Create your first one above.
          </div>
        ) : (
          questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              onShowQr={setActiveQrQuestion}
              onEdit={setActiveEditQuestion}
              onToggleOpen={handleToggleOpen}
              onToggleResults={handleToggleResults}
              onClear={handleClear}
              onDelete={handleDelete}
              onHideWord={handleHideWord}
              onUnhideWord={handleUnhideWord}
              onCopy={handleCopyLink}
            />
          ))
        )}
      </div>

      {/* Modals */}
      {activeQrQuestion && (
        <QrModal question={activeQrQuestion} onClose={() => setActiveQrQuestion(null)} />
      )}
      {activeEditQuestion && (
        <EditModal
          question={activeEditQuestion}
          onClose={() => setActiveEditQuestion(null)}
          onSave={handleEditSave}
        />
      )}
      {isChangePwOpen && (
        <ChangePasswordModal
          onClose={() => setIsChangePwOpen(false)}
          onSuccess={(msg) => showToast(msg)}
        />
      )}

      {/* Toast Notification */}
      <Toast message={toastMsg} />
    </div>
  );
}
