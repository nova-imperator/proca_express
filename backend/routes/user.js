const express = require('express');
const router = express.Router();
const { requireUser } = require('../middleware/auth');
const { query } = require('../config/db');
const mindlabs = require('../utils/mindlabs');

// GET /api/devices — list of devices assigned to the signed-in user via the
// device_assignments join table.
router.get('/devices', requireUser, async (req, res) => {
  const { rows } = await query(
    `SELECT d.id, d.type, d.asset_name, d.personal_reference, d.state,
            d.last_seen_at, d.last_battery, d.last_temp_i, d.last_humid_i,
            d.last_lat, d.last_lng, d.last_address
       FROM devices d
       JOIN device_assignments da ON da.device_id = d.id
      WHERE da.user_id = $1
      ORDER BY d.last_seen_at DESC NULLS LAST, d.id`,
    [req.user.id]
  );
  res.json({ devices: rows });
});

// GET /api/devices/:id — detail + recent packet history
//
// Validates ownership: a user can only see devices assigned to them. Returns
// summary, last N packets from our cache, and a 24h aggregate.
router.get('/devices/:id', requireUser, async (req, res) => {
  const id = String(req.params.id);
  const own = await query(
    `SELECT d.id, d.type, d.asset_name, d.personal_reference, d.state,
            d.last_seen_at, d.last_battery, d.last_temp_i, d.last_humid_i,
            d.last_light, d.last_shock,
            d.last_lat, d.last_lng, d.last_address, d.raw_meta
       FROM devices d
       JOIN device_assignments da ON da.device_id = d.id
      WHERE d.id = $1 AND da.user_id = $2`,
    [id, req.user.id]
  );
  if (!own.rows[0]) return res.status(404).json({ error: 'not_found' });

  const [packets, agg24h] = await Promise.all([
    query(
      `SELECT packet_time, battery, time_interval, temp_i, temp_p1, humid_i,
              light, shock, lat, lng, formatted_address
         FROM device_packets
        WHERE device_id = $1
        ORDER BY packet_time DESC
        LIMIT 200`,
      [id]
    ),
    query(
      `SELECT COUNT(*)::int AS packet_count,
              AVG(temp_i)::numeric(10,2) AS avg_temp_i,
              MIN(temp_i)::numeric(10,2) AS min_temp_i,
              MAX(temp_i)::numeric(10,2) AS max_temp_i,
              AVG(humid_i)::numeric(10,2) AS avg_humid_i,
              MAX(light)::numeric(10,2)   AS max_light,
              MAX(shock)::numeric(10,2)   AS max_shock,
              MIN(battery)::int           AS min_battery,
              MAX(packet_time)            AS latest_packet
         FROM device_packets
        WHERE device_id = $1 AND packet_time > NOW() - INTERVAL '24 hours'`,
      [id]
    ),
  ]);

  res.json({
    device: own.rows[0],
    packets: packets.rows,
    summary_24h: agg24h.rows[0],
  });
});

// GET /api/devices/:id/iframe-token — used by the React iframe to bootstrap +
// refresh the MindLabs live-tracking embed. Ownership-gated.
//
// The docs say `apikey:` should work on /v1/auth/generate-iframe-token but in
// reality that endpoint demands a Cognito IdToken (a logged-in MindLabs user
// session JWT). With only an API key, we therefore fall back to passing the
// API key itself as the iframeToken — if MindLabs accepts it, great; if not,
// the iframe will render their error page and we'll know definitively. The
// fallback is signalled via `mode: 'apikey'` so the UI can surface a warning.
router.get('/devices/:id/iframe-token', requireUser, async (req, res) => {
  const id = String(req.params.id);
  const own = await query(
    `SELECT 1 FROM device_assignments WHERE device_id = $1 AND user_id = $2`,
    [id, req.user.id]
  );
  if (!own.rows[0]) return res.status(404).json({ error: 'not_found' });
  try {
    res.json(await mindlabs.buildIframePayload(id));
  } catch (err) {
    res.status(err.status || 502).json({ error: 'iframe_token_failed', message: err.message });
  }
});

// GET /api/devices/:id/packets?start=...&end=... — fetch directly from MindLabs
// for a wider time window than we have cached locally. Useful for exporting or
// drilling deeper than 200 rows. Time params are unix seconds.
router.get('/devices/:id/packets', requireUser, async (req, res) => {
  const id = String(req.params.id);
  // ownership gate first
  const own = await query(
    `SELECT 1 FROM device_assignments WHERE device_id = $1 AND user_id = $2`,
    [id, req.user.id]
  );
  if (!own.rows[0]) return res.status(404).json({ error: 'not_found' });

  const start = Number(req.query.start);
  const end = Number(req.query.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return res.status(400).json({ error: 'bad_time_range' });
  }
  // Cap range to 14 days so we don't fetch huge payloads.
  if (end - start > 14 * 24 * 3600) {
    return res.status(400).json({ error: 'range_too_large', max_seconds: 14 * 24 * 3600 });
  }

  try {
    const data = await mindlabs.getPackets({ deviceId: id, startTime: start, endTime: end });
    res.json({ packets: Array.isArray(data?.data) ? data.data : [] });
  } catch (err) {
    res.status(err.status || 502).json({
      error: 'mindlabs_fetch_failed',
      message: err.message,
    });
  }
});

module.exports = router;
