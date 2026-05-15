import { useEffect, useState } from 'react';
import UserNav from '../components/UserNav.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api';

export default function Home() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    api.get('/api/devices').then((d) => setDevices(d?.devices || [])).catch(() => setDevices([]));
  }, []);

  return (
    <>
      <UserNav />
      <main className="container">
        <h1>Welcome{user?.full_name ? `, ${user.full_name}` : ''}</h1>
        <p className="muted">Your devices will appear here once they're provisioned.</p>

        {devices.length === 0 ? (
          <div className="card empty-state">
            <p>No devices yet.</p>
          </div>
        ) : (
          <div className="card">
            <table className="data-table">
              <thead>
                <tr><th>Device</th><th>IMEI</th><th>Status</th><th>Last seen</th></tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td>{d.device_name || '—'}</td>
                    <td>{d.imei || '—'}</td>
                    <td>{d.status}</td>
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
