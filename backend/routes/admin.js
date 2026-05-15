const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const { query } = require('../config/db');
const {
  requireAdmin,
  setAdminCookie,
  clearAuthCookies,
} = require('../middleware/auth');
const { verify: verifyCaptcha } = require('../utils/recaptcha');

// ---------- Admin auth ----------

// GET /api/admin/auth/me
router.get('/auth/me', async (req, res) => {
  if (!req.admin) return res.status(401).json({ error: 'unauthorized' });
  const { rows } = await query('SELECT id, email FROM admins WHERE id = $1', [req.admin.id]);
  if (!rows[0]) return res.status(401).json({ error: 'unauthorized' });
  res.json({ admin: rows[0] });
});

// POST /api/admin/auth/login   body: { email, password, recaptcha_token? }
router.post('/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const captcha = await verifyCaptcha(req.body?.recaptcha_token, req.ip);
  if (!captcha.ok) return res.status(400).json({ error: 'captcha_failed' });

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
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE is_active) AS active_users,
      (SELECT COUNT(*)::int FROM register_requests WHERE status = 'pending') AS pending_requests,
      (SELECT COUNT(*)::int FROM devices) AS device_count
  `);
  res.json({ stats: rows[0] });
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

module.exports = router;
