import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../../components/AdminNav.jsx';
import { api } from '../../api';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/admin/users');
      setUsers(d.users || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const onDelete = async (id) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    await api.del(`/api/admin/users/${id}`);
    load();
  };

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? users.filter((u) =>
        [u.full_name, u.email, u.mobile].some((v) => (v || '').toLowerCase().includes(needle))
      )
    : users;

  return (
    <>
      <AdminNav />
      <main className="container">
        <div className="row-between" style={{ marginBottom: '1rem' }}>
          <div>
            <h1 className="page-title">Users</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>{users.length} total</p>
          </div>
          <div className="row">
            <input
              type="text"
              placeholder="Search name, email, mobile…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 260 }}
            />
            <Link className="btn primary" to="/admin/add-user">+ Add user</Link>
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="muted" style={{ padding: '1.5rem' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ padding: '2rem', textAlign: 'center' }}>
                  {needle ? 'No matches.' : 'No users yet — click "Add user" to create the first one.'}
                </td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.full_name || '—'}</td>
                  <td>{u.email}</td>
                  <td>{u.mobile}</td>
                  <td>
                    <span className={`badge ${u.is_active ? 'active' : 'disabled'}`}>
                      {u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="actions">
                    <Link to={`/admin/edit-user/${u.id}`}>Edit</Link>
                    <Link to={`/admin/edit-user/${u.id}`}>Manage</Link>
                    <button className="danger" onClick={() => onDelete(u.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
