import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import BrandMark from '../components/BrandMark.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="brand-mark"><BrandMark /><span className="brand-name">Proca Express</span></div>
          <h1>Invalid link</h1>
          <p className="muted">Reset token missing or malformed.</p>
        </div>
      </div>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError('Passwords must match.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setPending(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      nav('/?reset=ok');
    } catch (err) {
      setError(err.data?.error === 'invalid_or_expired_token'
        ? 'This reset link is invalid or expired.'
        : 'Reset failed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-mark"><BrandMark /><span className="brand-name">Proca Express</span></div>
        <h1>Reset password</h1>
        <p className="auth-sub">Pick a new password (8+ characters).</p>
        {error && <div className="notice error">{error}</div>}
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <label>New password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password" required minLength={8} />
          </label>
          <label>Confirm password
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password" required minLength={8} />
          </label>
          <button className="btn primary full" type="submit" disabled={pending}>
            {pending ? <><span className="spin" /> Updating…</> : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
