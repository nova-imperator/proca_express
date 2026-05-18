import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import UserNav from '../components/UserNav.jsx';
import AdminNav from '../components/AdminNav.jsx';
import { SkeletonLine, SkeletonRow } from '../components/Skeleton.jsx';
import { api } from '../api';

// Dual-mode device detail page.
// - /devices/:id        → user view; calls /api/devices/:id (ownership-gated)
// - /admin/devices/:id  → admin view; calls /api/admin/devices/:id (any device)
// The two paths render the same body, just with the matching nav + back-link.
export default function DeviceDetail() {
  const { id } = useParams();
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith('/admin/');
  const Nav = isAdmin ? AdminNav : UserNav;
  const backTo = isAdmin ? '/admin/devices' : '/home';
  const backLabel = isAdmin ? 'Devices' : 'Dashboard';

  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const path = isAdmin ? `/api/admin/devices/${id}` : `/api/devices/${id}`;
    api.get(path)
      .then((d) => setData(d))
      .catch((err) => { if (err.status === 404) setNotFound(true); });
  }, [id, isAdmin]);

  if (notFound) {
    return (
      <>
        <Nav />
        <main className="container narrow">
          <h1 className="page-title">Device not found</h1>
          <p className="page-sub">
            {isAdmin ? "This device isn't in the catalog." : "This device isn't linked to your account."}
          </p>
          <Link className="btn" to={backTo}>← Back to {backLabel.toLowerCase()}</Link>
        </main>
      </>
    );
  }

  if (!data) return <DeviceDetailSkeleton isAdmin={isAdmin} />;
  const { device, packets, summary_24h } = data;

  const fresh = device.last_seen_at && (Date.now() - new Date(device.last_seen_at).getTime() < 24 * 3600 * 1000);

  return (
    <>
      <Nav />
      <main className="container">
        <div className="row-between anim-in-down" style={{ marginBottom: '1rem' }}>
          <div>
            <p className="muted" style={{ margin: 0 }}>
              <Link to={backTo} className="inline-link">← {backLabel}</Link>
            </p>
            <h1 className="page-title" style={{ fontFamily: 'ui-monospace, monospace' }}>{device.id}</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              {device.asset_name || device.personal_reference || device.type || 'Tracker'}
              <span className={`badge ${fresh ? 'active' : 'disabled'}`} style={{ marginLeft: 8 }}>
                {fresh ? 'live' : 'stale'}
              </span>
              {isAdmin && device.user_email && (
                <span className="muted" style={{ marginLeft: 12, fontSize: '0.85rem' }}>
                  · assigned to {device.user_name || device.user_email}
                </span>
              )}
              {isAdmin && !device.user_id && (
                <span className="badge disabled" style={{ marginLeft: 8 }}>unassigned</span>
              )}
            </p>
          </div>
        </div>

        {/* Current snapshot */}
        <div className="stat-grid stagger">
          <SnapStat label="Last temperature" value={device.last_temp_i  != null ? `${device.last_temp_i}°C` : '—'} />
          <SnapStat label="Last humidity"    value={device.last_humid_i != null ? `${device.last_humid_i}%` : '—'} />
          <SnapStat label="Battery"          value={device.last_battery != null ? `${device.last_battery}%` : '—'} />
          <SnapStat label="Last reported"    value={device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'never'} />
        </div>

        {/* 24h summary */}
        <h2 style={{ fontSize: '1.05rem', margin: '0.5rem 0' }}>Last 24 hours</h2>
        <div className="card anim-in anim-d2">
          <div className="agg-grid">
            <Agg label="Packets"     value={summary_24h?.packet_count ?? '—'} />
            <Agg label="Avg temp"    value={summary_24h?.avg_temp_i != null ? `${summary_24h.avg_temp_i}°C` : '—'} />
            <Agg label="Min / max"   value={
              summary_24h?.min_temp_i != null
                ? `${summary_24h.min_temp_i} / ${summary_24h.max_temp_i}°C`
                : '—'
            } />
            <Agg label="Avg humidity" value={summary_24h?.avg_humid_i != null ? `${summary_24h.avg_humid_i}%` : '—'} />
            <Agg label="Min battery"  value={summary_24h?.min_battery != null ? `${summary_24h.min_battery}%` : '—'} />
          </div>
        </div>

        {/* Location */}
        {device.last_lat != null && device.last_lng != null && (
          <>
            <h2 style={{ fontSize: '1.05rem', margin: '1rem 0 0.5rem' }}>Last location</h2>
            <div className="card anim-in anim-d3">
              <div style={{ fontSize: '0.92rem' }}>{device.last_address || '—'}</div>
              <a
                className="inline-link"
                target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps/search/?api=1&query=${device.last_lat},${device.last_lng}`}
              >
                {device.last_lat}, {device.last_lng} ↗
              </a>
            </div>
          </>
        )}

        {/* Recent packets */}
        <h2 style={{ fontSize: '1.05rem', margin: '1rem 0 0.5rem' }}>Recent packets</h2>
        <div className="card anim-in anim-d4" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr><th>Time</th><th>Temp</th><th>Humid</th><th>Battery</th><th>Location</th></tr>
            </thead>
            <tbody>
              {packets.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  No packets recorded yet. Once MindLabs delivers a transmission for this device, it'll show up here.
                </td></tr>
              ) : packets.map((p, i) => (
                <tr key={i}>
                  <td>{new Date(p.packet_time).toLocaleString()}</td>
                  <td>{p.temp_i != null ? `${p.temp_i}°C` : '—'}</td>
                  <td>{p.humid_i != null ? `${p.humid_i}%` : '—'}</td>
                  <td>{p.battery != null ? `${p.battery}%` : '—'}</td>
                  <td>
                    {p.lat != null && p.lng != null ? (
                      <a className="inline-link" target="_blank" rel="noreferrer"
                         href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}>
                        {p.formatted_address ? truncate(p.formatted_address, 40) : `${p.lat}, ${p.lng}`} ↗
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

function SnapStat({ label, value }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: '1.45rem', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function Agg({ label, value }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function DeviceDetailSkeleton({ isAdmin }) {
  const Nav = isAdmin ? AdminNav : UserNav;
  return (
    <>
      <Nav />
      <main className="container">
        <div style={{ marginBottom: '1rem' }}>
          <SkeletonLine width="120px" />
          <div style={{ height: 8 }} />
          <SkeletonLine width="220px" height="1.8rem" />
        </div>
        <div className="stat-grid">
          <div className="card"><SkeletonLine width="60%" /><SkeletonLine width="40%" height="1.5rem" /></div>
          <div className="card"><SkeletonLine width="60%" /><SkeletonLine width="40%" height="1.5rem" /></div>
          <div className="card"><SkeletonLine width="60%" /><SkeletonLine width="40%" height="1.5rem" /></div>
          <div className="card"><SkeletonLine width="60%" /><SkeletonLine width="40%" height="1.5rem" /></div>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead><tr><th>Time</th><th>Temp</th><th>Humid</th><th>Battery</th><th>Location</th></tr></thead>
            <tbody><SkeletonRow cols={5} /><SkeletonRow cols={5} /><SkeletonRow cols={5} /></tbody>
          </table>
        </div>
      </main>
    </>
  );
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
