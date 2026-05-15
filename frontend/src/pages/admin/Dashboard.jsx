import { useEffect, useState } from 'react';
import AdminNav from '../../components/AdminNav.jsx';
import { api } from '../../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/api/admin/stats').then((d) => setStats(d.stats)).catch(() => setStats(null));
  }, []);

  return (
    <>
      <AdminNav />
      <main className="container">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">Snapshot of activity across the platform.</p>

        <div className="stat-grid">
          <Stat label="Active users"             value={stats?.active_users}     icon={<UsersIcon />} />
          <Stat label="Pending register requests" value={stats?.pending_requests} icon={<InboxIcon />} />
          <Stat label="Devices"                  value={stats?.device_count}     icon={<DeviceIcon />} />
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
