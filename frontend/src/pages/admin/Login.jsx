import { useState, useCallback, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import BrandMark from '../../components/BrandMark.jsx';
import Captcha from '../../components/Captcha.jsx';

export default function AdminLogin() {
  const { admin, loginAdmin } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState({ token: '', answer: '' });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const captchaRef = useRef(null);

  const onCaptchaChange = useCallback((c) => setCaptcha(c), []);

  if (admin) return <Navigate to="/admin/home" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!captcha.answer) return setError('Please solve the captcha.');
    setPending(true);
    try {
      await loginAdmin(email, password, captcha.token, captcha.answer);
      nav('/admin/home');
    } catch (err) {
      const c = err.data?.error;
      const msg =
        c === 'invalid_credentials' ? 'Invalid email or password.'
        : c === 'captcha_wrong'   ? 'Captcha answer is wrong — try again.'
        : c === 'captcha_expired' ? 'Captcha expired — refreshed for you.'
        : c === 'captcha_invalid' || c === 'captcha_missing' ? 'Captcha check failed — try again.'
        : c === 'too_many_attempts' ? 'Too many attempts — wait a few minutes.'
        : 'Sign in failed.';
      setError(msg);
      captchaRef.current?.refresh();
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

          <Captcha ref={captchaRef} onChange={onCaptchaChange} />

          <button className="btn primary full" type="submit" disabled={pending}>
            {pending ? <><span className="spin" /> Signing in…</> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
