const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const { query } = require('../config/db');
const {
  requireAdmin,
  setAdminCookie,
  clearAuthCookies,
} = require('../middleware/auth');

// ---------- Admin login ----------
router.get('/', (req, res) => {
  if (req.admin) return res.redirect('/admin/home');
  res.render('admin/login', { title: 'Admin sign in', error: null, email: '' });
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).render('admin/login', { title: 'Admin sign in', error: 'Email and password are required.', email });
  }

  const { rows } = await query('SELECT id, password_hash FROM admins WHERE email = $1 LIMIT 1', [email]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return res.status(401).render('admin/login', { title: 'Admin sign in', error: 'Invalid credentials.', email });
  }

  setAdminCookie(res, admin);
  res.redirect('/admin/home');
});

router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  res.redirect('/admin');
});

// ---------- Dashboard ----------
router.get('/home', requireAdmin, async (req, res) => {
  const stats = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE is_active) AS active_users,
      (SELECT COUNT(*)::int FROM register_requests WHERE status = 'pending') AS pending_requests,
      (SELECT COUNT(*)::int FROM devices) AS device_count
  `);
  res.render('admin/dashboard', { title: 'Admin Dashboard', stats: stats.rows[0] });
});

// ---------- User management ----------
router.get('/users', requireAdmin, async (req, res) => {
  const { rows } = await query(
    `SELECT id, full_name, email, mobile, is_active, created_at
       FROM users ORDER BY created_at DESC`
  );
  res.render('admin/users', { title: 'Users', users: rows });
});

router.get('/add-user', requireAdmin, (req, res) => {
  res.render('admin/add-user', { title: 'Add user', form: {}, error: null });
});

router.post('/add-user', requireAdmin, async (req, res) => {
  const {
    email = '',
    mobile = '',
    password = '',
    confirm = '',
    full_name = '',
    designation = '',
    company_name = '',
    company_gst = '',
  } = req.body;

  const form = { email, mobile, full_name, designation, company_name, company_gst };
  if (!email.trim() || !mobile.trim() || !password) {
    return res.status(400).render('admin/add-user', { title: 'Add user', form, error: 'Email, mobile, and password are required.' });
  }
  if (password !== confirm) {
    return res.status(400).render('admin/add-user', { title: 'Add user', form, error: 'Passwords must match.' });
  }

  const hash = await bcrypt.hash(password, 12);
  try {
    await query(
      `INSERT INTO users (email, mobile, password_hash, full_name, designation, company_name, company_gst)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [email.toLowerCase().trim(), mobile.trim(), hash, full_name, designation, company_name, company_gst]
    );
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).render('admin/add-user', { title: 'Add user', form, error: 'A user with that email or mobile already exists.' });
    }
    throw err;
  }
  res.redirect('/admin/users');
});

router.get('/edit-user/:id', requireAdmin, async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).render('404', { title: 'Not found' });
  res.render('admin/edit-user', { title: 'Edit user', user: rows[0], error: null });
});

router.post('/edit-user/:id', requireAdmin, async (req, res) => {
  const { email = '', mobile = '', full_name = '', designation = '', company_name = '', company_gst = '', is_active } = req.body;
  await query(
    `UPDATE users SET
       email = $1, mobile = $2, full_name = $3, designation = $4,
       company_name = $5, company_gst = $6, is_active = $7
     WHERE id = $8`,
    [
      email.toLowerCase().trim(),
      mobile.trim(),
      full_name,
      designation,
      company_name,
      company_gst,
      is_active === 'on' || is_active === 'true' || is_active === true,
      req.params.id,
    ]
  );
  res.redirect('/admin/users');
});

router.post('/users/:id/delete', requireAdmin, async (req, res) => {
  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.redirect('/admin/users');
});

module.exports = router;
