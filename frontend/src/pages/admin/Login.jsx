import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function AdminLogin() {
  const { admin, loginAdmin } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  if (admin) return <Navigate to="/admin/home" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null); setPending(true);
    try {
      await loginAdmin(email, password);
      nav('/admin/home');
    } catch (err) {
      setError(err.status === 401 ? 'Invalid credentials.' : 'Sign in failed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="container narrow">
      <h1>Admin sign in</h1>
      {error && <div className="notice error">{error}</div>}
      <form onSubmit={onSubmit} className="card">
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
