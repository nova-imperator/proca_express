import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../../components/AdminNav.jsx';
import { SkeletonRow } from '../../components/Skeleton.jsx';
import { api } from '../../api';

export default function AdminUsers() {
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');

  const load = async () => {
    setUsers(null);
    try {
      const d = await api.get('/api/admin/users');
      setUsers(d.users || []);
    } catch {
      setUsers([]);
    }
  };
  useEffect(() => { load(); }, []);

  const onDelete = async (id) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    await api.del(`/api/admin/users/${id}`);
    load();
  };

  const needle = q.trim().toLowerCase();
  const filtered = needle && users
    ? users.filter((u) =>
        [u.full_name, u.email, u.mobile].some((v) => (v || '').toLowerCase().includes(needle))
      )
    : users;

  return (
    <>
      <AdminNav />
      <main className="container">
        <div className="row-between anim-in-down" style={{ marginBottom: '1rem' }}>
          <div>
            <h1 className="page-title">Users</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              {users === null ? '—' : `${users.length} total`}
            </p>
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

        <div className="card anim-in anim-d1" style={{ padding: 0 }}>
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
              {users === null ? (
                <>
                  <SkeletonRow cols={5} />
                  <SkeletonRow cols={5} />
                  <SkeletonRow cols={5} />
                  <SkeletonRow cols={5} />
                </>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ padding: '2rem', textAlign: 'center' }}>
                  {needle ? 'No matches.' : 'No users yet — click "Add user" to create the first one.'}
                </td></tr>
              ) : filtered.map((u, i) => (
                <tr key={u.id} className="anim-in" style={{ animationDelay: `${Math.min(i * 25, 280)}ms` }}>
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
