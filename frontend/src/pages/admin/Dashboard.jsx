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
        <h1>Dashboard</h1>
        <div className="stat-grid">
          <Stat label="Active users" value={stats?.active_users} />
          <Stat label="Pending register requests" value={stats?.pending_requests} />
          <Stat label="Devices" value={stats?.device_count} />
        </div>
      </main>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '—'}</div>
    </div>
  );
}
