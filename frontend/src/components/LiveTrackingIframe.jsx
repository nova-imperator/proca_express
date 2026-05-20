import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api';

/**
 * Embeds the MindLabs live-tracking UI for a device.
 *
 * Two-track approach:
 *
 *   1. Whenever possible, embed via <iframe>. MindLabs sets a CSP
 *      `frame-ancestors` allowlist on app.mindlabs.cloud that includes
 *      `http://localhost:3000` (so local dev works) and a handful of
 *      specific customer domains. Production needs MindLabs to add our
 *      origin to that list.
 *
 *   2. ALWAYS show an "Open in MindLabs ↗" button as a guaranteed
 *      escape hatch. Opens app.mindlabs.cloud/track/<id> in a new tab,
 *      where the user is already logged in. Works regardless of CSP.
 *
 * The token itself comes from our backend, which tries MindLabs'
 * generate-iframe-token endpoint first and (since their endpoint
 * demands a Cognito IdToken we don't have) falls back to using the
 * API key directly as the iframeToken.
 */
export default function LiveTrackingIframe({ deviceId, isAdmin }) {
  const iframeRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [mode, setMode] = useState(null);      // 'mindlabs' | 'apikey'
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
      .then(({ token, org_id, mode }) => {
        if (cancelled) return;
        if (!token || !org_id) { setError('Live tracking is not configured.'); return; }
        setMode(mode);
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

  // Listen for TOKEN_EXPIRED → fetch a fresh one → post back into the iframe.
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
        console.error('[iframe] refresh failed', err);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [fetchToken]);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

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

  return (
    <div className="iframe-shell anim-in" style={{ overflow: 'hidden' }}>
      <div className="iframe-toolbar">
        <div className="iframe-toolbar-left">
          <span style={{ fontWeight: 600 }}>MindLabs live view</span>
          {mode === 'apikey' && (
            <span className="badge" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>experimental token</span>
          )}
        </div>
        <a
          href={src || `https://app.mindlabs.cloud/track/${encodeURIComponent(deviceId)}`}
          target="_blank"
          rel="noreferrer"
          className="btn primary"
          style={{ padding: '0.45rem 0.9rem', fontSize: '0.88rem' }}
        >
          Open in MindLabs <ExternalIcon />
        </a>
      </div>

      {error ? (
        <FallbackCard error={error} currentOrigin={currentOrigin} />
      ) : (
        // CSP is enforced by MindLabs; if our origin isn't on their allowlist
        // the browser shows "refused to connect" inside the frame. Whitelisted
        // origins (incl. tracking.cargover.se as of 2026-05-19) render fine.
        <iframe
          ref={iframeRef}
          src={src}
          title={`Live tracking · ${deviceId}`}
          allow="geolocation; clipboard-write"
          loading="lazy"
          className="iframe-track"
        />
      )}
    </div>
  );
}

function FallbackCard({ error, currentOrigin }) {
  return (
    <div className="iframe-fallback">
      <div className="iframe-fallback-icon"><LockIcon /></div>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--fg-soft)', marginBottom: 4 }}>
          Live tracking unavailable
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>{error}</p>
        <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.82rem' }}>
          Origin: <code>{currentOrigin}</code>
        </p>
      </div>
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

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
