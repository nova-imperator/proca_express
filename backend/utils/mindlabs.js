// MindLabs Cloud REST API client.
//
// Auth: every request carries `apikey: <MINDLABS_API_KEY>`.
// Base: https://api.mindlabs.cloud (overridable via MINDLABS_API_BASE).
//
// Each helper throws an Error tagged with .status / .body on non-2xx so the
// route layer can decide to surface a 502/503 to the client.

function base() {
  return (process.env.MINDLABS_API_BASE || 'https://api.mindlabs.cloud').replace(/\/+$/, '');
}

function apiKey() {
  const k = process.env.MINDLABS_API_KEY;
  if (!k) {
    const err = new Error('mindlabs_api_key_missing');
    err.status = 500;
    throw err;
  }
  return k;
}

async function call(method, path, { query, body, timeoutMs = 15_000 } = {}) {
  const url = new URL(`${base()}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(`${k}[]`, item));
      else url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        apikey: apiKey(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('mindlabs_timeout');
      err.status = 504;
      throw err;
    }
    const err = new Error(`mindlabs_network: ${e.message}`);
    err.status = 502;
    throw err;
  } finally {
    clearTimeout(t);
  }

  let parsed = null;
  const text = await res.text();
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  }

  if (!res.ok) {
    const err = new Error(parsed?.message || `mindlabs_${res.status}`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}

// ---- Device catalog ----
function getDevices({ type, deviceId, config = true } = {}) {
  return call('GET', '/v2/devices', { query: { type, deviceId, config } });
}

// ---- Packets ----
function getPackets({ deviceId, startTime, endTime }) {
  return call('GET', '/v1/packets', { query: { deviceId, startTime, endTime } });
}

// ---- Shipment groups ----
function getShipmentGroups({ shipments = true, devices = true } = {}) {
  return call('GET', '/v1/shipmentgroups', { query: { shipments, devices } });
}

// ---- Loggers config ----
function getLoggersConfig(ids) {
  return call('GET', '/v1/loggers/config', { query: { ids } });
}
function updateLoggersConfig(ids, config) {
  return call('PATCH', '/v1/loggers/config', { query: { ids }, body: { config } });
}

// ---- Iframe token (used in Pass 2 once user has ORG_ID) ----
function generateIframeToken() {
  return call('GET', '/v1/auth/generate-iframe-token');
}

module.exports = {
  call,
  getDevices,
  getPackets,
  getShipmentGroups,
  getLoggersConfig,
  updateLoggersConfig,
  generateIframeToken,
};
