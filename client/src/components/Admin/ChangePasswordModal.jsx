import React, { useState, useEffect } from 'react';
import { changePassword } from '../../api/client';

export default function ChangePasswordModal({ onClose, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentPassword) {
      setErrorMsg('Please enter your current password');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      onSuccess('Password changed successfully');
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: '440px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>
          Change admin password
        </h2>
        <p className="muted" style={{ margin: '0 0 16px', fontSize: '13px' }}>
          Update the password used to sign in to this admin dashboard.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          <label className="field">
            Current password
            <input
              className="input"
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setErrorMsg(''); }}
              placeholder="Enter current password"
              autoComplete="current-password"
              required
              autoFocus
            />
          </label>

          <label className="field">
            New password
            <input
              className="input"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setErrorMsg(''); }}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
            />
          </label>

          <label className="field">
            Confirm new password
            <input
              className="input"
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              required
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', cursor: 'pointer' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Show passwords
            </label>
          </div>

          {errorMsg && (
            <div style={{ color: 'var(--bad)', fontSize: '13.5px', background: 'rgba(198,45,66,.08)', padding: '8px 12px', borderRadius: '8px' }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" className="btn" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={isSubmitting}>
              {isSubmitting ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
