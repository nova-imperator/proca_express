import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import UserNav from '../components/UserNav.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { SkeletonLine } from '../components/Skeleton.jsx';
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

        {devices === null ? (
          <div className="device-grid stagger">
            <DeviceCardSkeleton />
            <DeviceCardSkeleton />
            <DeviceCardSkeleton />
          </div>
        ) : devices.length === 0 ? (
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
          <div className="device-grid stagger">
            {devices.map((d) => <DeviceCard key={d.id} d={d} />)}
          </div>
        )}
      </main>
    </>
  );
}

function DeviceCard({ d }) {
  const fresh = d.last_seen_at && (Date.now() - new Date(d.last_seen_at).getTime() < 24 * 3600 * 1000);
  return (
    <Link to={`/devices/${d.id}`} className="device-card" aria-label={`Open device ${d.id}`}>
      <div className="device-card-head">
        <div>
          <div className="device-id">{d.id}</div>
          <div className="muted device-asset">{d.asset_name || d.personal_reference || d.type || 'Tracker'}</div>
        </div>
        <span className={`badge ${fresh ? 'active' : 'disabled'}`} title={fresh ? 'Reported in last 24h' : 'No recent report'}>
          {fresh ? 'live' : 'stale'}
        </span>
      </div>
      <div className="device-card-stats">
        <Stat label="Temp"   value={d.last_temp_i != null  ? `${d.last_temp_i}°C` : '—'} />
        <Stat label="Humid"  value={d.last_humid_i != null ? `${d.last_humid_i}%` : '—'} />
        <Stat label="Battery" value={d.last_battery != null ? `${d.last_battery}%` : '—'} />
      </div>
      <div className="device-card-foot muted">
        <span>{d.last_address ? truncate(d.last_address, 60) : '—'}</span>
        <span>{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : 'never'}</span>
      </div>
    </Link>
  );
}

function Stat({ label, value }) {
  return (
    <div className="device-stat">
      <div className="device-stat-label">{label}</div>
      <div className="device-stat-value">{value}</div>
    </div>
  );
}

function DeviceCardSkeleton() {
  return (
    <div className="device-card" aria-hidden="true">
      <div className="device-card-head">
        <div style={{ width: '100%' }}>
          <SkeletonLine width="40%" />
          <div style={{ height: 6 }} />
          <SkeletonLine width="60%" height="0.7rem" />
        </div>
      </div>
      <div className="device-card-stats">
        <SkeletonLine height="2rem" />
        <SkeletonLine height="2rem" />
        <SkeletonLine height="2rem" />
      </div>
      <div className="device-card-foot">
        <SkeletonLine width="80%" />
      </div>
    </div>
  );
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

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
