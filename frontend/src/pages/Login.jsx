import { useState, useRef, useCallback } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api';
import BrandMark from '../components/BrandMark.jsx';
import Recaptcha from '../components/Recaptcha.jsx';

export default function Login() {
  const { user, loginUser, config } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const dlgRef = useRef(null);

  const onCaptchaChange = useCallback((tok) => setCaptchaToken(tok), []);

  if (user) return <Navigate to="/home" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (config.recaptcha_site_key && !captchaToken) {
      return setError('Please complete the captcha.');
    }
    setPending(true);
    try {
      await loginUser(identifier, password, captchaToken);
      nav('/home');
    } catch (err) {
      const c = err.data?.error;
      setError(
        c === 'invalid_credentials' ? 'Invalid email/mobile or password.'
        : c === 'captcha_failed' ? 'Captcha check failed — try again.'
        : 'Sign in failed.'
      );
    } finally {
      setPending(false);
    }
  };

  const passwordReset = params.get('reset') === 'ok';

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-mark">
          <BrandMark />
          <span className="brand-name">Proca Express</span>
        </div>
        <h1>Welcome back</h1>
        <p className="auth-sub">Sign in with your email or mobile number.</p>

        {passwordReset && <div className="notice success">Password updated — please sign in.</div>}
        {error && <div className="notice error">{error}</div>}

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <label>
            Email or mobile
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              placeholder="you@company.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </label>

          <Recaptcha siteKey={config.recaptcha_site_key} onChange={onCaptchaChange} />

          <button type="submit" className="btn primary full" disabled={pending}>
            {pending ? <><span className="spin" /> Signing in…</> : 'Sign in'}
          </button>
        </form>

        <div className="divider" />
        <div className="row-between">
          <button type="button" className="link-button" onClick={() => dlgRef.current?.showModal()}>
            Forgot password?
          </button>
          <Link to="/register-request" className="inline-link">Request access →</Link>
        </div>

        <ForgotDialog dlgRef={dlgRef} />
      </div>
    </div>
  );
}

function ForgotDialog({ dlgRef }) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg(''); setPending(true);
    try {
      const data = await api.post('/api/auth/forgot-password', { email });
      setMsg(data.message || 'Done.');
    } catch {
      setMsg('Network error.');
    } finally {
      setPending(false);
    }
  };

  return (
    <dialog ref={dlgRef}>
      <form onSubmit={onSubmit} className="card" style={{ gap: '0.85rem' }}>
        <h3 style={{ margin: 0 }}>Reset password</h3>
        <p className="muted" style={{ margin: 0 }}>
          Enter your account email — we'll send a reset link if it matches an account.
        </p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {msg && <div className="notice info">{msg}</div>}
        <menu>
          <button type="button" className="btn" onClick={() => dlgRef.current?.close()}>Cancel</button>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? 'Sending…' : 'Send link'}
          </button>
        </menu>
      </form>
    </dialog>
  );
}
