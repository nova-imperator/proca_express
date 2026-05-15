import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminNav from '../../components/AdminNav.jsx';
import { api } from '../../api';

export default function EditUser() {
  const { id } = useParams();
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/users/${id}`)
      .then((d) => setUser(d.user))
      .catch((err) => { if (err.status === 404) setNotFound(true); });
  }, [id]);

  if (notFound) {
    return (
      <>
        <AdminNav />
        <main className="container narrow">
          <h1 className="page-title">User not found</h1>
          <p className="page-sub">The user you were looking for has been removed or never existed.</p>
          <Link className="btn" to="/admin/users">← Back to users</Link>
        </main>
      </>
    );
  }
  if (!user) return null;

  const onChange = (k) => (e) =>
    setUser((u) => ({ ...u, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null); setPending(true);
    try {
      await api.put(`/api/admin/users/${id}`, user);
      nav('/admin/users');
    } catch (err) {
      setError(err.data?.error === 'duplicate_email_or_mobile'
        ? 'Another user already uses that email or mobile.'
        : 'Save failed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <AdminNav />
      <main className="container narrow">
        <h1 className="page-title">Edit user</h1>
        <p className="page-sub">User #{user.id} · created {new Date(user.created_at).toLocaleDateString()}</p>
        {error && <div className="notice error">{error}</div>}
        <form onSubmit={onSubmit} className="card">
          <label>Email
            <input type="email" value={user.email || ''} onChange={onChange('email')} required />
          </label>
          <label>Mobile
            <input type="tel" value={user.mobile || ''} onChange={onChange('mobile')} required />
          </label>
          <label>Full name
            <input type="text" value={user.full_name || ''} onChange={onChange('full_name')} />
          </label>
          <label>Designation
            <input type="text" value={user.designation || ''} onChange={onChange('designation')} />
          </label>
          <label>Company name
            <input type="text" value={user.company_name || ''} onChange={onChange('company_name')} />
          </label>
          <label>Company GST
            <input type="text" value={user.company_gst || ''} onChange={onChange('company_gst')} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={!!user.is_active} onChange={onChange('is_active')} />
            Account active
          </label>
          <div className="row">
            <button className="btn primary" type="submit" disabled={pending}>
              {pending ? <><span className="spin" /> Saving…</> : 'Save changes'}
            </button>
            <Link className="btn" to="/admin/users">Cancel</Link>
          </div>
        </form>
      </main>
    </>
  );
}
