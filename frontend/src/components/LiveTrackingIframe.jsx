import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api';

/**
 * Embeds the live-tracking map for a device.
 *
 * The embed source + token come from our backend (/api/.../iframe-token),
 * which mints a fresh provider token. When the token expires the embedded
 * page posts { type: 'TOKEN_EXPIRED' } to us; we fetch a new one and post
 * { type: 'NEW_TOKEN', ... } back so the view never breaks.
 *
 * Provider branding is intentionally not surfaced in the UI.
 */
export default function LiveTrackingIframe({ deviceId, isAdmin }) {
  const iframeRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const path = isAdmin
    ? `/api/admin/devices/${deviceId}/iframe-token`
    : `/api/devices/${deviceId}/iframe-token`;

  const fetchToken = useCallback(() => api.get(path), [path]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetchToken()
      .then(({ token, org_id }) => {
        if (cancelled) return;
        if (!token || !org_id) { setError('Live tracking is not configured.'); return; }
        setSrc(`https://app.mindlabs.cloud/track/${encodeURIComponent(deviceId)}` +
               `?iframeOrgId=${encodeURIComponent(org_id)}&iframeToken=${encodeURIComponent(token)}`);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.data?.message || 'Could not prepare live tracking.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deviceId, fetchToken]);

  // Token-refresh handshake with the embedded page.
  useEffect(() => {
    const onMessage = async (event) => {
      if (!/^https:\/\/[^/]*mindlabs\.cloud$/.test(event.origin)) return;
      if (event.data?.type !== 'TOKEN_EXPIRED') return;
      try {
        const { token, org_id } = await fetchToken();
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'NEW_TOKEN', iframeToken: token, iframeOrgId: org_id },
          event.origin
        );
      } catch (err) {
        console.error('[livetrack] token refresh failed', err);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [fetchToken]);

  if (loading) {
    return (
      <div className="card iframe-shell iframe-loading">
        <div className="row" style={{ gap: '0.55rem' }}>
          <span className="spin" />
          <span>Loading live tracking…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="iframe-shell">
        <div className="iframe-fallback">
          <div className="iframe-fallback-icon"><LockIcon /></div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--fg-soft)', marginBottom: 4 }}>
              Live tracking unavailable
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="iframe-shell anim-in" style={{ overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        src={src}
        title="Live tracking"
        allow="geolocation; clipboard-write"
        loading="lazy"
        className="iframe-track"
      />
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
         strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
