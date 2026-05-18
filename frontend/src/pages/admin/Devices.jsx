import { useEffect, useState, useRef } from 'react';
import AdminNav from '../../components/AdminNav.jsx';
import { SkeletonRow } from '../../components/Skeleton.jsx';
import { api } from '../../api';

export default function AdminDevices() {
  const [devices, setDevices] = useState(null);
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [assigning, setAssigning] = useState(null);

  const load = async () => {
    setDevices(null);
    try {
      const d = await api.get('/api/admin/devices');
      setDevices(d.devices || []);
    } catch {
      setDevices([]);
    }
  };
  useEffect(() => { load(); }, []);

  const onSync = async () => {
    setSyncing(true); setError(null); setSuccess(null);
    try {
      const r = await api.post('/api/admin/devices/sync');
      setSuccess(`Synced ${r.synced} device${r.synced === 1 ? '' : 's'} from MindLabs.`);
      await load();
    } catch (err) {
      setError(err.data?.message || 'Sync failed. Check MINDLABS_API_KEY on the server.');
    } finally {
      setSyncing(false);
    }
  };

  const onUnassign = async (id) => {
    if (!confirm('Unassign this device from its user?')) return;
    await api.del(`/api/admin/devices/${id}/assign`);
    load();
  };

  const needle = q.trim().toLowerCase();
  const filtered = needle && devices
    ? devices.filter((d) =>
        [d.id, d.asset_name, d.personal_reference, d.user_name, d.user_email, d.type]
          .some((v) => (v || '').toLowerCase().includes(needle))
      )
    : devices;

  return (
    <>
      <AdminNav />
      <main className="container">
        <div className="row-between anim-in-down" style={{ marginBottom: '1rem' }}>
          <div>
            <h1 className="page-title">Devices</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              {devices === null ? '—' : `${devices.length} total · ${devices.filter((d) => d.user_id).length} assigned`}
            </p>
          </div>
          <div className="row">
            <input
              type="text"
              placeholder="Search id, asset, user…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="search-input"
            />
            <button className="btn primary" onClick={onSync} disabled={syncing}>
              {syncing ? <><span className="spin" /> Syncing…</> : '↻ Sync from MindLabs'}
            </button>
          </div>
        </div>

        {error && <div className="notice error">{error}</div>}
        {success && <div className="notice success">{success}</div>}

        <div className="card anim-in anim-d1" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Asset / Reference</th>
                <th>Last seen</th>
                <th>Battery</th>
                <th>Temp / Hum</th>
                <th>Assigned to</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices === null ? (
                <>
                  <SkeletonRow cols={8} />
                  <SkeletonRow cols={8} />
                  <SkeletonRow cols={8} />
                </>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="muted" style={{ padding: '2rem', textAlign: 'center' }}>
                  {needle ? 'No matches.' : 'No devices yet — click "Sync from MindLabs" to pull the catalog.'}
                </td></tr>
              ) : filtered.map((d, i) => (
                <tr key={d.id} className="anim-in" style={{ animationDelay: `${Math.min(i * 25, 280)}ms` }}>
                  <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}>{d.id}</td>
                  <td>{d.type || '—'}</td>
                  <td>
                    <div>{d.asset_name || '—'}</div>
                    {d.personal_reference && (
                      <div className="muted" style={{ fontSize: '0.78rem' }}>{d.personal_reference}</div>
                    )}
                  </td>
                  <td>{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '—'}</td>
                  <td>{d.last_battery != null ? `${d.last_battery}%` : '—'}</td>
                  <td>
                    {d.last_temp_i != null ? `${d.last_temp_i}°C` : '—'}
                    {d.last_humid_i != null && <span className="muted"> · {d.last_humid_i}%</span>}
                  </td>
                  <td>
                    {d.user_id ? (
                      <>
                        <div style={{ fontWeight: 500 }}>{d.user_name || '—'}</div>
                        <div className="muted" style={{ fontSize: '0.78rem' }}>{d.user_email}</div>
                      </>
                    ) : (
                      <span className="badge disabled">unassigned</span>
                    )}
                  </td>
                  <td className="actions">
                    <button onClick={() => setAssigning(d)}>
                      {d.user_id ? 'Reassign' : 'Assign'}
                    </button>
                    {d.user_id && (
                      <button className="danger" onClick={() => onUnassign(d.id)}>Unassign</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {assigning && (
        <AssignDialog
          device={assigning}
          onClose={() => setAssigning(null)}
          onDone={() => { setAssigning(null); load(); }}
        />
      )}
    </>
  );
}

function AssignDialog({ device, onClose, onDone }) {
  const dlgRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState(device.user_id || '');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    dlgRef.current?.showModal();
    api.get('/api/admin/users').then((d) => setUsers(d.users || [])).catch(() => setUsers([]));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!userId) return setError('Pick a user.');
    setPending(true); setError(null);
    try {
      await api.put(`/api/admin/devices/${device.id}/assign`, { user_id: userId });
      onDone();
    } catch (err) {
      setError(err.data?.error || 'Failed to assign.');
    } finally {
      setPending(false);
    }
  };

  return (
    <dialog ref={dlgRef} onClose={onClose}>
      <form onSubmit={onSubmit} className="card" style={{ gap: '0.85rem', minWidth: 380 }}>
        <h3 style={{ margin: 0 }}>Assign device {device.id}</h3>
        <p className="muted" style={{ margin: 0 }}>
          {device.user_id ? 'Currently assigned. Pick a new user to reassign.' : 'Pick a user to give them access.'}
        </p>
        <label>User
          <select value={userId} onChange={(e) => setUserId(e.target.value)} required>
            <option value="">— select user —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.full_name || '—')} · {u.email}
              </option>
            ))}
          </select>
        </label>
        {error && <div className="notice error">{error}</div>}
        <menu>
          <button type="button" className="btn" onClick={() => dlgRef.current?.close()}>Cancel</button>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? <><span className="spin" /> Saving…</> : 'Assign'}
          </button>
        </menu>
      </form>
    </dialog>
  );
}
