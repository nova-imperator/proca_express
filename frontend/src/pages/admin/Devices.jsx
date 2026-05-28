import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../../components/AdminNav.jsx';
import { SkeletonRow } from '../../components/Skeleton.jsx';
import { deviceLabel } from '../../lib/deviceLabel.js';
import { api } from '../../api';

export default function AdminDevices() {
  const [devices, setDevices] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [managing, setManaging] = useState(null);   // device whose assignments are being managed
  const [renaming, setRenaming] = useState(null);    // device being renamed

  const load = async () => {
    setDevices(null);
    try {
      const d = await api.get('/api/admin/devices');
      setDevices(d.devices || []);
    } catch {
      setDevices([]);
    }
  };
  useEffect(() => {
    load();
    api.get('/api/admin/users').then((d) => setAllUsers(d.users || [])).catch(() => setAllUsers([]));
  }, []);

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

  const needle = q.trim().toLowerCase();
  const filtered = needle && devices
    ? devices.filter((d) => {
        const userText = (d.users || []).map((u) => `${u.name || ''} ${u.email || ''}`).join(' ').toLowerCase();
        return [d.id, d.name, d.asset_name, d.personal_reference, d.type, userText]
          .some((v) => (v || '').toLowerCase().includes(needle));
      })
    : devices;

  const assignedCount = devices ? devices.filter((d) => (d.users || []).length > 0).length : 0;

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
                <th>Shipment name</th>
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
                        <span className={`status-dot ${fresh ? 'live' : 'stale'}`}
                              title={fresh ? 'Reported in last 24h' : 'No recent report'} />
                        <div>
                          <div className="device-name">{deviceLabel(d)}</div>
                          <div className="muted device-sub device-id-ref">{d.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span title={d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : ''}>
                        {timeAgo(d.last_seen_at)}
                      </span>
                    </td>
                    <td>
                      <AssignedUsersCell users={d.users || []} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link to={`/admin/devices/${d.id}`} className="icon-btn"
                              title="View all data" aria-label="View all data">
                          <EyeIcon />
                        </Link>
                        <button onClick={() => setRenaming(d)} className="icon-btn"
                                title="Rename device" aria-label="Rename device">
                          <PencilIcon />
                        </button>
                        <button onClick={() => setManaging(d)} className="icon-btn"
                                title="Manage assignments" aria-label="Manage assignments">
                          <UsersIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {managing && (
        <ManageAssignmentsDialog
          device={managing}
          allUsers={allUsers}
          onClose={() => setManaging(null)}
          onChanged={() => load()}
        />
      )}

      {renaming && (
        <RenameDialog
          device={renaming}
          onClose={() => setRenaming(null)}
          onDone={() => { setRenaming(null); load(); }}
        />
      )}
    </>
  );
}

function RenameDialog({ device, onClose, onDone }) {
  const dlgRef = useRef(null);
  const [name, setName] = useState(device.name || '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { dlgRef.current?.showModal(); }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setPending(true); setError(null);
    try {
      await api.patch(`/api/admin/devices/${device.id}`, { name: name.trim() });
      onDone();
    } catch {
      setError('Failed to save name.');
    } finally {
      setPending(false);
    }
  };

  return (
    <dialog ref={dlgRef} onClose={onClose}>
      <form onSubmit={onSubmit} className="card" style={{ gap: '0.85rem', minWidth: 380 }}>
        <h3 style={{ margin: 0 }}>Rename device</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          Friendly name shown to users instead of the device id{' '}
          <code style={{ fontFamily: 'ui-monospace, monospace' }}>{device.id}</code>.
          Leave blank to clear.
        </p>
        <label>Device name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cold room 3 / Truck MH-04"
            maxLength={120}
            autoFocus
          />
        </label>
        {error && <div className="notice error">{error}</div>}
        <menu>
          <button type="button" className="btn" onClick={() => dlgRef.current?.close()}>Cancel</button>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? <><span className="spin" /> Saving…</> : 'Save'}
          </button>
        </menu>
      </form>
    </dialog>
  );
}

// ---------- Cells ----------

function AssignedUsersCell({ users }) {
  if (!users || users.length === 0) {
    return <span className="chip-unassigned">Unassigned</span>;
  }
  // 1 user → full card; 2+ users → stacked avatars + "+N more"
  if (users.length === 1) {
    const u = users[0];
    return (
      <div className="user-cell">
        <div className="avatar" style={{ background: avatarColor(u.email) }}>{initials(u.name || u.email)}</div>
        <div>
          <div className="user-name">{u.name || '—'}</div>
          <div className="user-email muted">{u.email}</div>
        </div>
      </div>
    );
  }
  const shown = users.slice(0, 3);
  const more = users.length - shown.length;
  return (
    <div className="user-cell">
      <div className="avatar-stack" title={users.map((u) => u.name || u.email).join(', ')}>
        {shown.map((u, i) => (
          <div key={u.id} className="avatar avatar-sm" style={{ background: avatarColor(u.email), zIndex: shown.length - i }}>
            {initials(u.name || u.email)}
          </div>
        ))}
        {more > 0 && <div className="avatar avatar-sm avatar-more">+{more}</div>}
      </div>
      <div>
        <div className="user-name">{users.length} users</div>
        <div className="user-email muted">{shown.map((u) => u.name || u.email).join(', ')}{more > 0 ? `, +${more} more` : ''}</div>
      </div>
    </div>
  );
}

// ---------- Manage Assignments dialog ----------

function ManageAssignmentsDialog({ device, allUsers, onClose, onChanged }) {
  const dlgRef = useRef(null);
  // Local optimistic copy of the current assignments so adding/removing feels instant.
  const [assigned, setAssigned] = useState(device.users || []);
  const [pickUser, setPickUser] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { dlgRef.current?.showModal(); }, []);

  const assignedIds = new Set(assigned.map((u) => Number(u.id)));
  const availableUsers = allUsers.filter((u) => !assignedIds.has(Number(u.id)));

  const onAdd = async (e) => {
    e.preventDefault();
    setError(null);
    if (!pickUser) return;
    const u = allUsers.find((x) => String(x.id) === String(pickUser));
    if (!u) return;
    setBusy(true);
    try {
      await api.post(`/api/admin/devices/${device.id}/assignments`, { user_id: u.id });
      setAssigned((prev) => [...prev, { id: u.id, name: u.full_name || u.email, email: u.email }]);
      setPickUser('');
      onChanged();
    } catch (err) {
      setError(err.data?.error || 'Failed to add user.');
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (userId) => {
    setError(null);
    setBusy(true);
    try {
      await api.del(`/api/admin/devices/${device.id}/assignments/${userId}`);
      setAssigned((prev) => prev.filter((u) => Number(u.id) !== Number(userId)));
      onChanged();
    } catch (err) {
      setError(err.data?.error || 'Failed to remove user.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dlgRef} onClose={onClose}>
      <div className="card" style={{ gap: '1rem', minWidth: 420 }}>
        <h3 style={{ margin: 0 }}>Manage assignments — <code style={{ fontFamily: 'ui-monospace, monospace' }}>{device.id}</code></h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          Multiple users can see the same device. Add or remove access here.
        </p>

        <div>
          <div className="muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
            Currently assigned ({assigned.length})
          </div>
          {assigned.length === 0 ? (
            <div className="chip-unassigned" style={{ display: 'block', padding: '0.7rem', textAlign: 'center' }}>
              No users — add one below.
            </div>
          ) : (
            <ul className="assignment-list">
              {assigned.map((u) => (
                <li key={u.id}>
                  <div className="user-cell">
                    <div className="avatar avatar-sm" style={{ background: avatarColor(u.email) }}>{initials(u.name || u.email)}</div>
                    <div>
                      <div className="user-name">{u.name || '—'}</div>
                      <div className="user-email muted">{u.email}</div>
                    </div>
                  </div>
                  <button type="button" className="icon-btn danger" onClick={() => onRemove(u.id)}
                          disabled={busy} title="Remove" aria-label="Remove">
                    <XIcon />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={onAdd} className="row" style={{ alignItems: 'flex-end', gap: '0.5rem' }}>
          <label style={{ flex: 1 }}>
            Add a user
            <select value={pickUser} onChange={(e) => setPickUser(e.target.value)} disabled={busy || availableUsers.length === 0}>
              <option value="">
                {availableUsers.length === 0 ? 'All users already assigned' : '— select user —'}
              </option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>{(u.full_name || '—')} · {u.email}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn primary" disabled={!pickUser || busy}>
            {busy ? <><span className="spin" /> Adding…</> : 'Add'}
          </button>
        </form>

        {error && <div className="notice error">{error}</div>}

        <menu>
          <button type="button" className="btn" onClick={() => dlgRef.current?.close()}>Close</button>
        </menu>
      </div>
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

function avatarColor(seed) {
  if (!seed) return '#94a3b8';
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}deg 55% 48%)`;
}

// ---------- icons ----------

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 21v-5h5" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 13.5c2.5 0 4.5 1.3 5 3.5" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
