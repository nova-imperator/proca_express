import { useEffect, useState } from 'react';
import UserNav from '../components/UserNav.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { SkeletonRow } from '../components/Skeleton.jsx';
import { api } from '../api';

export default function Home() {
  const { user } = useAuth();
  const [devices, setDevices] = useState(null);

  useEffect(() => {
    api.get('/api/devices')
      .then((d) => setDevices(d?.devices || []))
      .catch(() => setDevices([]));
  }, []);

  return (
    <>
      <UserNav />
      <main className="container">
        <div className="row-between anim-in-down" style={{ marginBottom: '1rem' }}>
          <div>
            <h1 className="page-title">
              Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
            </h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>Here are the devices linked to your account.</p>
          </div>
        </div>

        {devices === null ? (
          <div className="card anim-in anim-d1" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr><th>Device</th><th>IMEI</th><th>Status</th><th>Last seen</th></tr>
              </thead>
              <tbody>
                <SkeletonRow cols={4} />
                <SkeletonRow cols={4} />
                <SkeletonRow cols={4} />
              </tbody>
            </table>
          </div>
        ) : devices.length === 0 ? (
          <div className="card empty-state anim-in anim-d1">
            <DeviceIcon big />
            <p style={{ marginTop: '0.75rem', fontWeight: 600, color: 'var(--fg-soft)' }}>
              No devices yet
            </p>
            <p className="muted" style={{ maxWidth: 320, margin: '0.25rem auto 0' }}>
              Your devices will appear here once they're provisioned by the operations team.
            </p>
          </div>
        ) : (
          <div className="card anim-in anim-d1" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr><th>Device</th><th>IMEI</th><th>Status</th><th>Last seen</th></tr>
              </thead>
              <tbody>
                {devices.map((d, i) => (
                  <tr key={d.id} className="anim-in" style={{ animationDelay: `${Math.min(i * 25, 280)}ms` }}>
                    <td>{d.device_name || '—'}</td>
                    <td>{d.imei || '—'}</td>
                    <td>
                      <span className={`badge ${d.status === 'active' ? 'active' : 'disabled'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td>{d.last_seen_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

function DeviceIcon({ big }) {
  const size = big ? 44 : 24;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
         style={{ color: 'var(--muted-2)' }}>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  );
}
