import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../../components/AdminNav.jsx';
import { api } from '../../api';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if (!confirm('Delete this user?')) return;
    await api.del(`/api/admin/users/${id}`);
    load();
  };

  return (
    <>
      <AdminNav />
      <main className="container">
        <div className="row-between">
          <h1>Users</h1>
          <Link className="btn primary" to="/admin/add-user">Add user</Link>
        </div>

        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="muted">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="muted">No users yet.</td></tr>
              ) : users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name || '—'}</td>
                  <td>{u.email}</td>
                  <td>{u.mobile}</td>
                  <td>{u.is_active ? 'Active' : 'Disabled'}</td>
                  <td className="actions">
                    <Link to={`/admin/edit-user/${u.id}`}>Edit</Link>
                    <Link to={`/admin/edit-user/${u.id}`}>Manage</Link>
                    <button className="link-button danger" onClick={() => onDelete(u.id)}>
                      Delete
                    </button>
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
