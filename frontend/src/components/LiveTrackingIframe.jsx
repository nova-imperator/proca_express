import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api';

/**
 * Embeds the MindLabs live-tracking UI for a device via an <iframe>.
 *
 * Per their integration docs:
 *   <iframe src="https://app.mindlabs.cloud/track/{id}?iframeOrgId={ORG}&iframeToken={TOK}" />
 *
 * When the token in the iframe expires, MindLabs posts:
 *   { type: 'TOKEN_EXPIRED' }
 * to the parent (us). We then fetch a new token from our backend and post:
 *   { type: 'NEW_TOKEN', iframeToken, iframeOrgId }
 * back into the iframe so it stays alive without a reload.
 *
 * If the token endpoint fails (e.g. API key doesn't have iframe permission),
 * we render a graceful explanation card instead of a broken iframe.
 */
export default function LiveTrackingIframe({ deviceId, isAdmin }) {
  const iframeRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const path = isAdmin
    ? `/api/admin/devices/${deviceId}/iframe-token`
    : `/api/devices/${deviceId}/iframe-token`;

  const fetchToken = useCallback(async () => {
    const data = await api.get(path);
    return data;
  }, [path]);

  // Initial token + src build.
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetchToken()
      .then(({ token, org_id }) => {
        if (cancelled) return;
        if (!token || !org_id) {
          setError('Live tracking is not configured — missing token or org id.');
          return;
        }
        setOrgId(org_id);
        setSrc(`https://app.mindlabs.cloud/track/${encodeURIComponent(deviceId)}` +
               `?iframeOrgId=${encodeURIComponent(org_id)}&iframeToken=${encodeURIComponent(token)}`);
      })
      .catch((err) => {
        if (cancelled) return;
        const reason =
          err.data?.error === 'iframe_token_denied'
            ? 'Your MindLabs API key doesn\'t have iframe permission. Open ' +
              'app.mindlabs.cloud → Settings → Integrations → API Keys, edit ' +
              'the PROCA EXPRESS key, and enable the iframe / embed scope.'
            : err.data?.message || 'Could not load live tracking.';
        setError(reason);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deviceId, fetchToken]);

  // Listen for TOKEN_EXPIRED from the iframe, fetch a fresh one, post it back.
  useEffect(() => {
    const onMessage = async (event) => {
      // Strict origin check — only react to messages from MindLabs.
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
      <div className="card iframe-shell iframe-fallback">
        <div className="iframe-fallback-icon"><LockIcon /></div>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--fg-soft)', marginBottom: 4 }}>
            Live tracking unavailable
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>{error}</p>
          <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.82rem' }}>
            The packet history and stats below are still available — they come from our cached
            data and the periodic API sync.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="iframe-shell anim-in">
      <iframe
        ref={iframeRef}
        src={src}
        title={`Live tracking · ${deviceId}`}
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
