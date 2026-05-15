import { useState, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import UserNav from '../components/UserNav.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api';

export default function Login() {
  const { user, loginUser } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const dlgRef = useRef(null);

  if (user) return <Navigate to="/home" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await loginUser(identifier, password);
      nav('/home');
    } catch (err) {
      setError(err.status === 401 ? 'Invalid credentials.' : 'Sign in failed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <UserNav />
      <main className="container narrow">
        <h1>Sign in</h1>
        {error && <div className="notice error">{error}</div>}
        <form onSubmit={onSubmit} className="card">
          <label>
            Email or mobile
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
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
              required
            />
          </label>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="muted">
          <button type="button" className="link-button" onClick={() => dlgRef.current?.showModal()}>
            Forgot password?
          </button>{' '}
          · Don't have an account? <Link to="/register-request">Request access</Link>
        </p>

        <ForgotDialog dlgRef={dlgRef} />
      </main>
    </>
  );
}

function ForgotDialog({ dlgRef }) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('Sending…');
    try {
      const data = await api.post('/api/auth/forgot-password', { email });
      setMsg(data.message || 'Done.');
    } catch {
      setMsg('Network error.');
    }
  };
  return (
    <dialog ref={dlgRef}>
      <form onSubmit={onSubmit} className="card">
        <h3>Reset password</h3>
        <p className="muted">Enter your account email and we'll send a reset link.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {msg && <div className="muted">{msg}</div>}
        <menu>
          <button type="button" className="btn" onClick={() => dlgRef.current?.close()}>Cancel</button>
          <button type="submit" className="btn primary">Send link</button>
        </menu>
      </form>
    </dialog>
  );
}
