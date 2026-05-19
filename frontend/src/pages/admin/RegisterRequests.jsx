import { useEffect, useState, useRef } from 'react';
import AdminNav from '../../components/AdminNav.jsx';
import { SkeletonRow } from '../../components/Skeleton.jsx';
import PasswordInput from '../../components/PasswordInput.jsx';
import { api } from '../../api';

const STATUS_TABS = [
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all',      label: 'All'      },
];

export default function RegisterRequests() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null); // request row being approved
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.get(`/api/admin/register-requests?status=${status}`);
      setRows(d.register_requests || []);
    } catch {
      setError('Failed to load requests.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [status]);

  const onReject = async (id) => {
    if (!confirm('Reject this request?')) return;
    try {
      await api.post(`/api/admin/register-requests/${id}/reject`);
      load();
    } catch {
      alert('Failed to reject — refresh and try again.');
    }
  };

  return (
    <>
      <AdminNav />
      <main className="container">
        <div className="row-between anim-in-down" style={{ marginBottom: '1rem' }}>
          <div>
            <h1 className="page-title">Register requests</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              People who submitted the register form. Approve to provision them as users.
            </p>
          </div>
          <div className="row" style={{ gap: '0.4rem' }}>
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                className={`btn ${status === t.key ? 'primary' : ''}`}
                onClick={() => setStatus(t.key)}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="notice error">{error}</div>}

        <div className="card anim-in anim-d1" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Company</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow cols={7} />
                  <SkeletonRow cols={7} />
                  <SkeletonRow cols={7} />
                </>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="muted" style={{ padding: '2rem', textAlign: 'center' }}>
                  No {status === 'all' ? '' : status} requests.
                </td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="anim-in" style={{ animationDelay: `${Math.min(i * 25, 280)}ms` }}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={{ fontWeight: 500 }}>{r.full_name || '—'}</td>
                  <td>{r.email}</td>
                  <td>{r.mobile}</td>
                  <td>{r.company_name || '—'}</td>
                  <td>
                    <span className={`badge ${r.status === 'approved' ? 'active' : r.status === 'rejected' ? 'disabled' : 'disabled'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="actions">
                    {r.status === 'pending' ? (
                      <>
                        <button onClick={() => setApproving(r)}>Approve</button>
                        <button className="danger" onClick={() => onReject(r.id)}>Reject</button>
                      </>
                    ) : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {approving && (
        <ApproveDialog
          request={approving}
          onClose={() => setApproving(null)}
          onDone={() => { setApproving(null); load(); }}
        />
      )}
    </>
  );
}

function ApproveDialog({ request, onClose, onDone }) {
  const dlgRef = useRef(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  useEffect(() => { dlgRef.current?.showModal(); }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords must match.');
    setPending(true);
    try {
      await api.post(`/api/admin/register-requests/${request.id}/approve`, { password });
      onDone();
    } catch (err) {
      setError(err.data?.error === 'duplicate_email_or_mobile'
        ? 'A user with this email or mobile already exists.'
        : 'Approval failed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <dialog ref={dlgRef} onClose={onClose}>
      <form onSubmit={onSubmit} className="card" style={{ gap: '0.85rem' }}>
        <h3 style={{ margin: 0 }}>Approve & create user</h3>
        <p className="muted" style={{ margin: 0 }}>
          A new user account will be created for <strong>{request.email}</strong>. Share the password with them via a secure channel.
        </p>
        <label>New user password
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus />
        </label>
        <label>Confirm password
          <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
        </label>
        {error && <div className="notice error">{error}</div>}
        <menu>
          <button type="button" className="btn" onClick={() => dlgRef.current?.close()}>Cancel</button>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? <><span className="spin" /> Approving…</> : 'Approve & create'}
          </button>
        </menu>
      </form>
    </dialog>
  );
}
