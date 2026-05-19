import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import UserNav from '../components/UserNav.jsx';
import AdminNav from '../components/AdminNav.jsx';
import { SkeletonLine, SkeletonRow } from '../components/Skeleton.jsx';
import LiveTrackingIframe from '../components/LiveTrackingIframe.jsx';
import LineChart from '../components/LineChart.jsx';
import Pagination from '../components/Pagination.jsx';
import useLocalState from '../hooks/useLocalState.js';
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
              {isAdmin && Array.isArray(device.users) && device.users.length > 0 && (
                <span className="muted" style={{ marginLeft: 12, fontSize: '0.85rem' }}>
                  · assigned to {device.users.length === 1
                    ? (device.users[0].name || device.users[0].email)
                    : `${device.users.length} users`}
                </span>
              )}
              {isAdmin && Array.isArray(device.users) && device.users.length === 0 && (
                <span className="badge disabled" style={{ marginLeft: 8 }}>unassigned</span>
              )}
            </p>
          </div>
        </div>

        {/* Live MindLabs embed */}
        <h2 style={{ fontSize: '1.05rem', margin: '0.25rem 0 0.5rem' }}>Live tracking</h2>
        <LiveTrackingIframe deviceId={device.id} isAdmin={isAdmin} />

        {/* Current snapshot */}
        <h2 style={{ fontSize: '1.05rem', margin: '0.5rem 0' }}>Current snapshot</h2>
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

        {/* Sensor trend chart */}
        <SensorTrend packets={packets} />

        {/* Packet table — paginated + filterable */}
        <PacketTable packets={packets} />
      </main>
    </>
  );
}

// ---------- Sensor trend (chart + metric tabs) ----------

const METRICS = [
  { key: 'temp_i',   label: 'Temperature', unit: '°C', color: '#2563eb' },
  { key: 'humid_i',  label: 'Humidity',    unit: '%',  color: '#16a34a' },
  { key: 'battery',  label: 'Battery',     unit: '%',  color: '#b45309' },
];

function SensorTrend({ packets }) {
  const [metric, setMetric] = useState('temp_i');
  const def = METRICS.find((m) => m.key === metric) || METRICS[0];
  const data = useMemo(
    () => (packets || [])
      .map((p) => ({ t: p.packet_time, v: p[metric] }))
      .filter((p) => p.v != null),
    [packets, metric]
  );

  return (
    <>
      <div className="row-between anim-in anim-d3" style={{ margin: '1rem 0 0.5rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Sensor trend</h2>
        <div className="chart-tabs" role="tablist" aria-label="Metric">
          {METRICS.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={metric === m.key}
              className={metric === m.key ? 'active' : ''}
              onClick={() => setMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card anim-in anim-d4">
        <LineChart data={data} color={def.color} unit={def.unit} gradient />
      </div>
    </>
  );
}

// ---------- Packet table (paginated + location-only toggle) ----------

const PAGE_SIZE = 15;

function PacketTable({ packets }) {
  // UI preference; remembered per-device in localStorage. Default true because
  // a journey timeline (location-only) is more useful than a flat sensor wall.
  const [locOnly, setLocOnly] = useLocalState('devicedetail.locOnly', true);
  const [page, setPage] = useState(1);

  const list = useMemo(
    () => (locOnly ? packets.filter((p) => p.lat != null && p.lng != null) : packets),
    [packets, locOnly]
  );

  // Reset to page 1 whenever the filter changes the visible set.
  useEffect(() => { setPage(1); }, [locOnly]);

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const sliceStart = (safePage - 1) * PAGE_SIZE;
  const rows = list.slice(sliceStart, sliceStart + PAGE_SIZE);

  return (
    <>
      <div className="row-between anim-in anim-d5" style={{ margin: '1rem 0 0.5rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>
          Packet log <span className="muted" style={{ fontWeight: 400 }}>· {list.length} total</span>
        </h2>
        <label className="checkbox" style={{ fontSize: '0.85rem', color: 'var(--fg-soft)' }}>
          <input type="checkbox" checked={locOnly} onChange={(e) => setLocOnly(e.target.checked)} />
          Only show location updates
        </label>
      </div>

      <div className="card anim-in anim-d6" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr><th>Time</th><th>Temp</th><th>Humid</th><th>Battery</th><th>Location</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="muted" style={{ padding: '1.5rem', textAlign: 'center' }}>
                {locOnly
                  ? 'No packets in this view contain a location reading.'
                  : 'No packets recorded yet. Once MindLabs delivers a transmission for this device, it\'ll show up here.'}
              </td></tr>
            ) : rows.map((p, i) => (
              <tr key={`${p.packet_time}-${i}`}>
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
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      </div>
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
