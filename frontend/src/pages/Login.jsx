import { useState, useRef, useCallback, useMemo } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api';
import BrandMark from '../components/BrandMark.jsx';
import Captcha from '../components/Captcha.jsx';

// A small pool of logistics/tracking-themed photos from Lorem Picsum. The
// seed makes each one stable so caching kicks in, and we pick one per session
// so the page doesn't change image on every keystroke.
const HERO_IMAGES = [
  'https://picsum.photos/seed/proca-logistics-1/1200/1500',
  'https://picsum.photos/seed/proca-logistics-2/1200/1500',
  'https://picsum.photos/seed/proca-logistics-3/1200/1500',
  'https://picsum.photos/seed/proca-logistics-4/1200/1500',
  'https://picsum.photos/seed/proca-logistics-5/1200/1500',
];

export default function Login() {
  const { user, loginUser } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState({ token: '', answer: '' });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const dlgRef = useRef(null);
  const captchaRef = useRef(null);

  const heroImg = useMemo(
    () => HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)],
    []
  );

  const onCaptchaChange = useCallback((c) => setCaptcha(c), []);

  if (user) return <Navigate to="/home" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!captcha.answer) return setError('Please solve the captcha.');
    setPending(true);
    try {
      await loginUser(identifier, password, captcha.token, captcha.answer);
      nav('/home');
    } catch (err) {
      const c = err.data?.error;
      const msg =
        c === 'invalid_credentials' ? 'Invalid email/mobile or password.'
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

  const passwordReset = params.get('reset') === 'ok';

  return (
    <div className="login-split">
      {/* Left pane — sign-in form */}
      <section className="login-form-pane">
        <div className="auth-card">
          <div className="brand-mark anim-in-down">
            <BrandMark />
            <span className="brand-name">Cargoverse</span>
          </div>
          <h1 className="anim-in anim-d1">Welcome back</h1>
          <p className="auth-sub anim-in anim-d2">Sign in with your email or mobile number.</p>

          {passwordReset && <div className="notice success anim-fade">Password updated — please sign in.</div>}
          {error && <div className="notice error anim-fade">{error}</div>}

          <form onSubmit={onSubmit} className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
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

            <Captcha ref={captchaRef} onChange={onCaptchaChange} />

            <button type="submit" className="btn primary full" disabled={pending}>
              {pending ? <><span className="spin" /> Signing in…</> : 'Sign in'}
            </button>
          </form>

          <div className="divider anim-fade anim-d5" />
          <div className="row-between anim-in anim-d6">
            <button type="button" className="link-button" onClick={() => dlgRef.current?.showModal()}>
              Forgot password?
            </button>
            <Link to="/register-request" className="inline-link">Request access →</Link>
          </div>

          <ForgotDialog dlgRef={dlgRef} />
        </div>
      </section>

      {/* Right pane — hero imagery + marketing copy */}
      <aside className="login-hero-pane" aria-hidden="true">
        <div
          className="login-hero-img"
          style={{ backgroundImage: `url('${heroImg}')` }}
        />
        <div className="login-hero-overlay" />
        <div className="login-hero-content">
          <div className="brand-mark">
            <BrandMark />
            <span className="brand-name">Cargoverse</span>
          </div>

          <div className="login-hero-body">
            <h2>Every device, every mile, on one screen.</h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Track your
              entire fleet in real time, with live status, location history, and
              instant alerts the moment anything goes wrong.
            </p>
            <ul className="login-hero-bullets">
              <li><CheckIcon /> Live status across your full inventory</li>
              <li><CheckIcon /> Single-tap export for compliance reports</li>
              <li><CheckIcon /> Role-based access for ops, finance, and leadership</li>
              <li><CheckIcon /> Audit log of every action, retained 90 days</li>
            </ul>
          </div>

          <div className="login-hero-foot">
            © {new Date().getFullYear()} Cargoverse · tracking.cargover.se
          </div>
        </div>
      </aside>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
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
