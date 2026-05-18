import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../../components/AdminNav.jsx';
import { SkeletonRow } from '../../components/Skeleton.jsx';
import ConfirmDangerDialog from '../../components/ConfirmDangerDialog.jsx';
import { api } from '../../api';

export default function AdminDevices() {
  const [devices, setDevices] = useState(null);
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [unassigning, setUnassigning] = useState(null);
  const [pendingUnassign, setPendingUnassign] = useState(false);

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

  const confirmUnassign = async () => {
    if (!unassigning) return;
    setPendingUnassign(true);
    try {
      await api.del(`/api/admin/devices/${unassigning.id}/assign`);
      setUnassigning(null);
      load();
    } finally {
      setPendingUnassign(false);
    }
  };

  const needle = q.trim().toLowerCase();
  const filtered = needle && devices
    ? devices.filter((d) =>
        [d.id, d.asset_name, d.personal_reference, d.user_name, d.user_email, d.type]
          .some((v) => (v || '').toLowerCase().includes(needle))
      )
    : devices;

  const assignedCount = devices ? devices.filter((d) => d.user_id).length : 0;

  return (
    <>
      <AdminNav />
      <main className="container">
        <div className="row-between anim-in-down" style={{ marginBottom: '1rem' }}>
          <div>
            <h1 className="page-title">Devices</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              {devices === null
                ? '—'
                : <>
                    <strong>{devices.length}</strong> total
                    <span className="muted"> · </span>
                    <strong>{assignedCount}</strong> assigned
                    <span className="muted"> · </span>
                    <strong>{devices.length - assignedCount}</strong> unassigned
                  </>}
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
            <button className="btn" onClick={onSync} disabled={syncing} title="Refresh from MindLabs">
              {syncing ? <><span className="spin" /> Syncing…</> : <><RefreshIcon /> Sync</>}
            </button>
          </div>
        </div>

        {error && <div className="notice error">{error}</div>}
        {success && <div className="notice success">{success}</div>}

        <div className="card anim-in anim-d1" style={{ padding: 0 }}>
          <table className="data-table devices-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Last seen</th>
                <th>Assigned to</th>
                <th style={{ width: 1, whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices === null ? (
                <>
                  <SkeletonRow cols={4} />
                  <SkeletonRow cols={4} />
                  <SkeletonRow cols={4} />
                </>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="muted" style={{ padding: '2rem', textAlign: 'center' }}>
                  {needle ? 'No matches.' : 'No devices yet — click "Sync" to pull the catalog.'}
                </td></tr>
              ) : filtered.map((d, i) => {
                const fresh = d.last_seen_at &&
                  (Date.now() - new Date(d.last_seen_at).getTime() < 24 * 3600 * 1000);
                return (
                  <tr key={d.id} className="anim-in" style={{ animationDelay: `${Math.min(i * 18, 220)}ms` }}>
                    <td>
                      <div className="device-id-cell">
                        <span
                          className={`status-dot ${fresh ? 'live' : 'stale'}`}
                          title={fresh ? 'Reported in last 24h' : 'No recent report'}
                        />
                        <div>
                          <div className="device-id-mono">{d.id}</div>
                          {(d.asset_name || d.personal_reference) && (
                            <div className="muted device-sub">
                              {d.asset_name || d.personal_reference}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span title={d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : ''}>
                        {timeAgo(d.last_seen_at)}
                      </span>
                    </td>
                    <td>
                      {d.user_id ? (
                        <div className="user-cell">
                          <div className="avatar" style={{ background: avatarColor(d.user_email) }}>
                            {initials(d.user_name || d.user_email)}
                          </div>
                          <div>
                            <div className="user-name">{d.user_name || '—'}</div>
                            <div className="user-email muted">{d.user_email}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="chip-unassigned">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link to={`/admin/devices/${d.id}`} className="icon-btn" title="View all data" aria-label="View all data">
                          <EyeIcon />
                        </Link>
                        <button onClick={() => setAssigning(d)} className="icon-btn" title={d.user_id ? 'Reassign' : 'Assign'} aria-label={d.user_id ? 'Reassign' : 'Assign'}>
                          {d.user_id ? <SwapIcon /> : <UserPlusIcon />}
                        </button>
                        {d.user_id && (
                          <button onClick={() => setUnassigning(d)} className="icon-btn danger" title="Unassign" aria-label="Unassign">
                            <UserMinusIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      <ConfirmDangerDialog
        open={!!unassigning}
        title="Unassign device"
        description={
          <>
            Remove <strong>{unassigning?.id}</strong> from{' '}
            <strong>{unassigning?.user_name || unassigning?.user_email}</strong>.
            They'll stop seeing it on their dashboard. Sensor history is kept and
            the device can be reassigned anytime.
          </>
        }
        confirmWord="unassign"
        actionLabel="Unassign"
        pending={pendingUnassign}
        onConfirm={confirmUnassign}
        onClose={() => !pendingUnassign && setUnassigning(null)}
      />
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

// ---------- helpers ----------

function timeAgo(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'in the future';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name) {
  if (!name) return '?';
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic colour from a string — same input always renders the same hue
// so a user gets the same avatar background across the table.
function avatarColor(seed) {
  if (!seed) return '#94a3b8';
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}deg 55% 48%)`;
}

// ---------- icons ----------

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function UserPlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}
function UserMinusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}
function SwapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4l-4 4 4 4" />
      <path d="M3 8h13a4 4 0 0 1 4 4v0" />
      <path d="M17 20l4-4-4-4" />
      <path d="M21 16H8a4 4 0 0 1-4-4v0" />
    </svg>
  );
}
