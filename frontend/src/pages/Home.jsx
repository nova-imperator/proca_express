import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
        <div className="anim-in-down" style={{ marginBottom: '1rem' }}>
          <h1 className="page-title">
            Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {devices === null
              ? 'Loading your devices…'
              : devices.length === 0
                ? 'No devices yet — ask your administrator to assign one to your account.'
                : `${devices.length} device${devices.length === 1 ? '' : 's'} linked to your account.`}
          </p>
        </div>

        {devices !== null && devices.length === 0 ? (
          <div className="card empty-state anim-in anim-d1">
            <DeviceIcon big />
            <p style={{ marginTop: '0.75rem', fontWeight: 600, color: 'var(--fg-soft)' }}>
              No devices assigned
            </p>
            <p className="muted" style={{ maxWidth: 360, margin: '0.25rem auto 0' }}>
              Your devices will appear here once the operations team links them to your account.
            </p>
          </div>
        ) : (
          <div className="card anim-in anim-d1" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Asset</th>
                  <th>Status</th>
                  <th>Last temp</th>
                  <th>Battery</th>
                  <th>Last seen</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {devices === null ? (
                  <>
                    <SkeletonRow cols={7} />
                    <SkeletonRow cols={7} />
                    <SkeletonRow cols={7} />
                  </>
                ) : devices.map((d, i) => {
                  const fresh = d.last_seen_at &&
                    (Date.now() - new Date(d.last_seen_at).getTime() < 24 * 3600 * 1000);
                  return (
                    <tr key={d.id} className="anim-in" style={{ animationDelay: `${Math.min(i * 25, 280)}ms` }}>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}>{d.id}</td>
                      <td>{d.asset_name || d.personal_reference || d.type || '—'}</td>
                      <td>
                        <span className={`badge ${fresh ? 'active' : 'disabled'}`} title={fresh ? 'Reported in last 24h' : 'No recent report'}>
                          {fresh ? 'live' : 'stale'}
                        </span>
                      </td>
                      <td>
                        {d.last_temp_i != null ? `${d.last_temp_i}°C` : '—'}
                        {d.last_humid_i != null && (
                          <span className="muted" style={{ fontSize: '0.78rem', marginLeft: 6 }}>
                            · {d.last_humid_i}%
                          </span>
                        )}
                      </td>
                      <td>{d.last_battery != null ? `${d.last_battery}%` : '—'}</td>
                      <td>{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '—'}</td>
                      <td className="actions">
                        <Link to={`/devices/${d.id}`}>View all data</Link>
                      </td>
                    </tr>
                  );
                })}
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
