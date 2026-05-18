const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const { query, pool } = require('../config/db');
const {
  requireAdmin,
  setAdminCookie,
  clearAuthCookies,
} = require('../middleware/auth');
const captcha = require('../utils/captcha');
const mindlabs = require('../utils/mindlabs');

// ---------- Admin auth ----------

// GET /api/admin/auth/me
router.get('/auth/me', async (req, res) => {
  if (!req.admin) return res.status(401).json({ error: 'unauthorized' });
  const { rows } = await query('SELECT id, email FROM admins WHERE id = $1', [req.admin.id]);
  if (!rows[0]) return res.status(401).json({ error: 'unauthorized' });
  res.json({ admin: rows[0] });
});

// POST /api/admin/auth/login   body: { email, password, captcha_token, captcha_answer }
router.post('/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const cap = captcha.verify(req.body?.captcha_token, req.body?.captcha_answer);
  if (!cap.ok) return res.status(400).json({ error: cap.error });

  const { rows } = await query('SELECT id, email, password_hash FROM admins WHERE email = $1 LIMIT 1', [email]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  setAdminCookie(res, admin);
  res.json({ ok: true, admin: { id: admin.id, email: admin.email } });
});

// POST /api/admin/auth/logout
router.post('/auth/logout', (_req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

// All routes below require admin auth.
router.use(requireAdmin);

// GET /api/admin/stats
router.get('/stats', async (_req, res) => {
  const [s, recent] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE is_active) AS active_users,
        (SELECT COUNT(*)::int FROM register_requests WHERE status = 'pending') AS pending_requests,
        (SELECT COUNT(*)::int FROM devices) AS device_count,
        (SELECT COUNT(*)::int FROM devices WHERE user_id IS NOT NULL) AS assigned_device_count,
        (SELECT COUNT(*)::int FROM devices WHERE last_seen_at > NOW() - INTERVAL '24 hours') AS active_devices_24h
    `),
    query(`
      SELECT id, email, mobile, full_name, status, created_at
        FROM register_requests
        WHERE status = 'pending'
        ORDER BY created_at DESC
        LIMIT 5
    `),
  ]);
  res.json({ stats: s.rows[0], recent_requests: recent.rows });
});

// ---------- Register requests ----------

// GET /api/admin/register-requests?status=pending|approved|rejected|all
router.get('/register-requests', async (req, res) => {
  const status = String(req.query.status || 'all');
  const allowed = ['pending', 'approved', 'rejected', 'all'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'bad_status' });

  const sql = status === 'all'
    ? `SELECT * FROM register_requests ORDER BY created_at DESC`
    : `SELECT * FROM register_requests WHERE status = $1 ORDER BY created_at DESC`;
  const args = status === 'all' ? [] : [status];

  const { rows } = await query(sql, args);
  res.json({ register_requests: rows });
});

// POST /api/admin/register-requests/:id/reject
router.post('/register-requests/:id/reject', async (req, res) => {
  const { rows } = await query(
    `UPDATE register_requests SET status = 'rejected'
       WHERE id = $1 AND status = 'pending'
       RETURNING id, status`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not_found_or_not_pending' });
  res.json({ ok: true, request: rows[0] });
});

// POST /api/admin/register-requests/:id/approve   body: { password }
// Creates a user from the request, marks the request approved — atomically.
// Admin supplies the password (we never auto-generate, since there's no
// vetted channel to deliver one).
router.post('/register-requests/:id/approve', async (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 8) return res.status(400).json({ error: 'password_too_short' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT id, email, mobile, full_name, designation, company_name, company_gst, status
         FROM register_requests WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    const rr = r.rows[0];
    if (!rr) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found' }); }
    if (rr.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'already_processed' });
    }

    const hash = await bcrypt.hash(password, 12);
    const created = await client.query(
      `INSERT INTO users (email, mobile, password_hash, full_name, designation, company_name, company_gst)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, mobile, full_name`,
      [rr.email, rr.mobile, hash, rr.full_name, rr.designation, rr.company_name, rr.company_gst]
    );
    await client.query(`UPDATE register_requests SET status = 'approved' WHERE id = $1`, [rr.id]);
    await client.query('COMMIT');
    res.status(201).json({ ok: true, user: created.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ error: 'duplicate_email_or_mobile' });
    throw err;
  } finally {
    client.release();
  }
});

// GET /api/admin/users
router.get('/users', async (_req, res) => {
  const { rows } = await query(
    `SELECT id, full_name, email, mobile, designation, company_name, company_gst,
            is_active, created_at
       FROM users ORDER BY created_at DESC`
  );
  res.json({ users: rows });
});

// POST /api/admin/users   body: full user
router.post('/users', async (req, res) => {
  const {
    email = '',
    mobile = '',
    password = '',
    full_name = '',
    designation = '',
    company_name = '',
    company_gst = '',
  } = req.body || {};

  if (!String(email).trim() || !String(mobile).trim() || !password) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password_too_short' });
  }

  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await query(
      `INSERT INTO users (email, mobile, password_hash, full_name, designation, company_name, company_gst)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, full_name, email, mobile, designation, company_name, company_gst, is_active, created_at`,
      [
        String(email).toLowerCase().trim(),
        String(mobile).trim(),
        hash,
        full_name,
        designation,
        company_name,
        company_gst,
      ]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'duplicate_email_or_mobile' });
    throw err;
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT id, full_name, email, mobile, designation, company_name, company_gst,
            is_active, created_at, updated_at
       FROM users WHERE id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json({ user: rows[0] });
});

// PUT /api/admin/users/:id
router.put('/users/:id', async (req, res) => {
  const {
    email = '',
    mobile = '',
    full_name = '',
    designation = '',
    company_name = '',
    company_gst = '',
    is_active,
  } = req.body || {};

  try {
    const { rows } = await query(
      `UPDATE users SET
         email = $1, mobile = $2, full_name = $3, designation = $4,
         company_name = $5, company_gst = $6, is_active = $7
       WHERE id = $8
       RETURNING id, full_name, email, mobile, designation, company_name, company_gst, is_active, created_at, updated_at`,
      [
        String(email).toLowerCase().trim(),
        String(mobile).trim(),
        full_name,
        designation,
        company_name,
        company_gst,
        is_active === true || is_active === 'true' || is_active === 'on',
        req.params.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'duplicate_email_or_mobile' });
    throw err;
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  const result = await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// ============================================================
// Webhook activity (admin-only monitoring view)
// ============================================================

// GET /api/admin/webhook-events?limit=20
router.get('/webhook-events', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const { rows } = await query(
    `SELECT id, source, payload_timestamp, signature, packet_count, received_at,
            raw->'payload'->'data'->>'id' AS device_id,
            raw->'payload'->>'type'        AS payload_type
       FROM webhook_events
      ORDER BY received_at DESC
      LIMIT $1`,
    [limit]
  );
  const counts = await query(
    `SELECT
       COUNT(*)::int                                                              AS total,
       COUNT(*) FILTER (WHERE received_at > NOW() - INTERVAL '24 hours')::int     AS last_24h,
       COUNT(*) FILTER (WHERE received_at > NOW() - INTERVAL '1 hour')::int       AS last_hour,
       MAX(received_at)                                                           AS latest
       FROM webhook_events
      WHERE source = 'mindlabs'`
  );
  res.json({ events: rows, counts: counts.rows[0] });
});

// ============================================================
// Devices (mirror of MindLabs catalog)
// ============================================================

// GET /api/admin/devices — list of devices (from our DB), with assigned user
router.get('/devices', async (_req, res) => {
  const { rows } = await query(`
    SELECT d.id, d.type, d.asset_name, d.personal_reference, d.state,
           d.last_seen_at, d.last_battery, d.last_temp_i, d.last_humid_i,
           d.last_lat, d.last_lng, d.last_address,
           d.user_id, u.full_name AS user_name, u.email AS user_email
      FROM devices d
      LEFT JOIN users u ON u.id = d.user_id
     ORDER BY d.updated_at DESC
  `);
  res.json({ devices: rows });
});

// POST /api/admin/devices/sync — pull from MindLabs and upsert into our DB
router.post('/devices/sync', async (_req, res) => {
  let data;
  try {
    data = await mindlabs.getDevices({ config: true });
  } catch (err) {
    return res.status(err.status || 502).json({
      error: 'mindlabs_sync_failed',
      message: err.message,
    });
  }
  const list = Array.isArray(data?.data) ? data.data : [];

  const client = await pool.connect();
  let upserted = 0;
  try {
    await client.query('BEGIN');
    for (const d of list) {
      if (!d?.id) continue;
      const last = d.lastUpdate || {};
      const lloc = d.lastUpdateLocation || {};
      const lastSeenSec = Number(last.timestamp) || Number(lloc.timestamp);
      await client.query(
        `INSERT INTO devices (id, type, org_id, state, raw_meta,
            last_seen_at, last_battery, last_temp_i, last_humid_i,
            last_lat, last_lng, last_address)
         VALUES ($1,$2,$3,$4,$5,
                 CASE WHEN $6::bigint IS NULL THEN NULL ELSE to_timestamp($6) END,
                 $7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE SET
            type        = COALESCE(EXCLUDED.type, devices.type),
            org_id      = COALESCE(EXCLUDED.org_id, devices.org_id),
            state       = COALESCE(EXCLUDED.state, devices.state),
            raw_meta    = EXCLUDED.raw_meta,
            last_seen_at = COALESCE(EXCLUDED.last_seen_at, devices.last_seen_at),
            last_battery = COALESCE(EXCLUDED.last_battery, devices.last_battery),
            last_temp_i  = COALESCE(EXCLUDED.last_temp_i, devices.last_temp_i),
            last_humid_i = COALESCE(EXCLUDED.last_humid_i, devices.last_humid_i),
            last_lat     = COALESCE(EXCLUDED.last_lat, devices.last_lat),
            last_lng     = COALESCE(EXCLUDED.last_lng, devices.last_lng),
            last_address = COALESCE(EXCLUDED.last_address, devices.last_address)`,
        [
          d.id, d.type || null, d.orgId || null, d.state || null, d,
          Number.isFinite(lastSeenSec) ? lastSeenSec : null,
          numOr(last.battery ?? lloc.battery),
          numOr(last.tempI),
          numOr(last.humidI),
          numOr(lloc.lat),
          numOr(lloc.lng),
          lloc.formatted_address || null,
        ]
      );
      upserted++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  res.json({ ok: true, synced: upserted, total_returned: list.length });
});

// GET /api/admin/devices/:id — full detail for any device (no ownership filter)
router.get('/devices/:id', async (req, res) => {
  const id = String(req.params.id);
  const dev = await query(
    `SELECT d.id, d.type, d.asset_name, d.personal_reference, d.state, d.org_id,
            d.last_seen_at, d.last_battery, d.last_temp_i, d.last_humid_i,
            d.last_lat, d.last_lng, d.last_address, d.raw_meta,
            d.user_id, u.full_name AS user_name, u.email AS user_email
       FROM devices d
       LEFT JOIN users u ON u.id = d.user_id
      WHERE d.id = $1`,
    [id]
  );
  if (!dev.rows[0]) return res.status(404).json({ error: 'not_found' });

  const [packets, agg24h] = await Promise.all([
    query(
      `SELECT packet_time, battery, time_interval, temp_i, temp_p1, humid_i,
              lat, lng, formatted_address
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
              MIN(battery)::int           AS min_battery,
              MAX(packet_time)            AS latest_packet
         FROM device_packets
        WHERE device_id = $1 AND packet_time > NOW() - INTERVAL '24 hours'`,
      [id]
    ),
  ]);

  res.json({
    device: dev.rows[0],
    packets: packets.rows,
    summary_24h: agg24h.rows[0],
  });
});

// GET /api/admin/devices/:id/iframe-token — admin-side; no ownership gate.
router.get('/devices/:id/iframe-token', async (req, res) => {
  const id = String(req.params.id);
  const dev = await query('SELECT 1 FROM devices WHERE id = $1', [id]);
  if (!dev.rows[0]) return res.status(404).json({ error: 'not_found' });
  try {
    res.json(await mindlabs.buildIframePayload(id));
  } catch (err) {
    res.status(err.status || 502).json({ error: 'iframe_token_failed', message: err.message });
  }
});

// PUT /api/admin/devices/:id/assign   body: { user_id }
router.put('/devices/:id/assign', async (req, res) => {
  const userId = req.body?.user_id;
  if (userId === null || userId === '' || userId === undefined) {
    return res.status(400).json({ error: 'missing_user_id' });
  }
  // Verify user exists.
  const u = await query('SELECT id FROM users WHERE id = $1', [userId]);
  if (!u.rows[0]) return res.status(404).json({ error: 'user_not_found' });

  const { rows } = await query(
    'UPDATE devices SET user_id = $1 WHERE id = $2 RETURNING id, user_id',
    [userId, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'device_not_found' });
  res.json({ ok: true, device: rows[0] });
});

// DELETE /api/admin/devices/:id/assign — un-assign
router.delete('/devices/:id/assign', async (req, res) => {
  const { rows } = await query(
    'UPDATE devices SET user_id = NULL WHERE id = $1 RETURNING id',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'device_not_found' });
  res.json({ ok: true });
});

function numOr(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

module.exports = router;
