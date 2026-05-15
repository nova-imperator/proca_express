import { useState, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import BrandMark from '../../components/BrandMark.jsx';
import Recaptcha from '../../components/Recaptcha.jsx';

export default function AdminLogin() {
  const { admin, loginAdmin, config } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const onCaptchaChange = useCallback((tok) => setCaptchaToken(tok), []);

  if (admin) return <Navigate to="/admin/home" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (config.recaptcha_site_key && !captchaToken) {
      return setError('Please complete the captcha.');
    }
    setPending(true);
    try {
      await loginAdmin(email, password, captchaToken);
      nav('/admin/home');
    } catch (err) {
      const c = err.data?.error;
      setError(
        c === 'invalid_credentials' ? 'Invalid email or password.'
        : c === 'captcha_failed' ? 'Captcha check failed — try again.'
        : 'Sign in failed.'
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-mark">
          <BrandMark />
          <span className="brand-name">Proca Express · Admin</span>
        </div>
        <h1>Admin sign in</h1>
        <p className="auth-sub">Authorised personnel only.</p>

        {error && <div className="notice error">{error}</div>}

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <label>Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="username" placeholder="admin@…" required />
          </label>
          <label>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" placeholder="••••••••" required />
          </label>

          <Recaptcha siteKey={config.recaptcha_site_key} onChange={onCaptchaChange} />

          <button className="btn primary full" type="submit" disabled={pending}>
            {pending ? <><span className="spin" /> Signing in…</> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
