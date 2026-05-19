import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminNav from '../../components/AdminNav.jsx';
import { SkeletonStat, SkeletonRow } from '../../components/Skeleton.jsx';
import { api } from '../../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState(null);
  const [webhook, setWebhook] = useState(null);

  useEffect(() => {
    api.get('/api/admin/stats')
      .then((d) => { setStats(d.stats); setRecent(d.recent_requests || []); })
      .catch(() => { setStats({}); setRecent([]); });
    api.get('/api/admin/webhook-events?limit=10')
      .then((d) => setWebhook(d))
      .catch(() => setWebhook({ events: [], counts: { total: 0, last_24h: 0, last_hour: 0, latest: null } }));
  }, []);

  const loading = stats === null;

  return (
    <>
      <AdminNav />
      <main className="container">
        <h1 className="page-title anim-in-down">Dashboard</h1>
        <p className="page-sub anim-fade anim-d1">Snapshot of activity across the platform.</p>

        <div className="stat-grid stagger">
          {loading ? (
            <>
              <SkeletonStat />
              <SkeletonStat />
              <SkeletonStat />
            </>
          ) : (
            <>
              <Stat label="Active users"              value={stats.active_users}     icon={<UsersIcon />} />
              <Stat label="Pending register requests" value={stats.pending_requests} icon={<InboxIcon />} />
              <Stat label="Devices"                   value={stats.device_count}     icon={<DeviceIcon />} />
            </>
          )}
        </div>

        {/* Webhook activity */}
        <div className="row-between anim-in anim-d2" style={{ marginBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>MindLabs webhook activity</h2>
          {webhook && (
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              {webhook.counts.total} total · {webhook.counts.last_24h} in 24h ·{' '}
              {webhook.counts.last_hour} in 1h
            </span>
          )}
        </div>

        <div className="card anim-in anim-d3" style={{ padding: 0, marginBottom: '1.5rem' }}>
          {webhook === null ? (
            <table className="data-table">
              <thead><tr><th>Received</th><th>Device</th><th>Type</th><th>Packets</th><th>Signature</th></tr></thead>
              <tbody><SkeletonRow cols={5} /><SkeletonRow cols={5} /><SkeletonRow cols={5} /></tbody>
            </table>
          ) : webhook.events.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center' }} className="muted">
              <p style={{ margin: 0, fontWeight: 500, color: 'var(--fg-soft)' }}>
                No webhook events yet
              </p>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
                Confirm the webhook URL is saved + active in the MindLabs portal. If it's saved
                but nothing arrives within an hour, MindLabs likely needs an HTTPS endpoint —
                ask the engineering team to set up TLS for{' '}
                <code style={{ background: 'var(--surface-2)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                  tracking.cargover.se
                </code>.
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Device</th>
                  <th>Type</th>
                  <th>Packets</th>
                  <th>Signature</th>
                </tr>
              </thead>
              <tbody>
                {webhook.events.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.received_at).toLocaleString()}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace' }}>{e.device_id || '—'}</td>
                    <td>{e.payload_type || '—'}</td>
                    <td>{e.packet_count ?? 0}</td>
                    <td className="muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem' }}>
                      {e.signature ? `${e.signature.slice(0, 18)}…` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Register requests */}
        <div className="row-between anim-in anim-d4" style={{ marginBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Recent register requests</h2>
          <Link className="inline-link" to="/admin/register-requests">View all →</Link>
        </div>

        <div className="card anim-in anim-d5" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr><th>Submitted</th><th>Name</th><th>Email</th><th>Mobile</th><th>Action</th></tr>
            </thead>
            <tbody>
              {recent === null ? (
                <>
                  <SkeletonRow cols={5} />
                  <SkeletonRow cols={5} />
                  <SkeletonRow cols={5} />
                </>
              ) : recent.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  No pending requests.
                </td></tr>
              ) : recent.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td style={{ fontWeight: 500 }}>{r.full_name || '—'}</td>
                  <td>{r.email}</td>
                  <td>{r.mobile}</td>
                  <td><Link className="inline-link" to="/admin/register-requests">Review</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-icon">{icon}</div>
    </div>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 13.5c2.5 0 4.5 1.3 5 3.5" />
    </svg>
  );
}
function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 13l2.5-7h11L20 13" />
      <path d="M4 13v6h16v-6h-5l-1.5 2h-3L9 13H4Z" />
    </svg>
  );
}
function DeviceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="5" y="3" width="14" height="18" rx="3" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  );
}
