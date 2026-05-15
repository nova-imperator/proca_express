const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const { query } = require('../config/db');
const { setUserCookie, clearAuthCookies } = require('../middleware/auth');
const mailer = require('../utils/mailer');

// GET / — user login (also doubles as home for logged-out)
router.get('/', (req, res) => {
  if (req.user) return res.redirect('/home');
  res.render('login', { title: 'Sign in', error: null, identifier: '' });
});

// POST /login — accept email OR mobile in `identifier`
router.post('/login', async (req, res) => {
  const identifier = String(req.body.identifier || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!identifier || !password) {
    return res.status(400).render('login', { title: 'Sign in', error: 'Email/mobile and password are required.', identifier });
  }

  const { rows } = await query(
    `SELECT id, password_hash, is_active FROM users
       WHERE LOWER(email) = $1 OR mobile = $1
       LIMIT 1`,
    [identifier]
  );
  const user = rows[0];
  if (!user || !user.is_active) {
    return res.status(401).render('login', { title: 'Sign in', error: 'Invalid credentials.', identifier });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).render('login', { title: 'Sign in', error: 'Invalid credentials.', identifier });
  }

  setUserCookie(res, user);
  res.redirect('/home');
});

// POST /logout
router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  res.redirect('/');
});

// POST /forgot-password — issue a reset link
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  // Always respond the same so we don't leak which emails exist.
  const generic = { ok: true, message: 'If an account exists for that email, a reset link has been sent.' };

  if (!email) return res.json(generic);

  const { rows } = await query('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [email]);
  const user = rows[0];
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expires]
    );

    const link = `${process.env.APP_URL || ''}/reset-password?token=${rawToken}`;
    mailer
      .send({
        to: email,
        subject: 'Reset your Proca Express password',
        text: `Click here to reset your password (valid 1 hour):\n${link}`,
      })
      .catch((e) => console.error('[mail] reset failed', e));
  }

  res.json(generic);
});

// GET /reset-password?token=...
router.get('/reset-password', (req, res) => {
  const token = String(req.query.token || '');
  if (!token) return res.status(400).render('error', { title: 'Invalid link', message: 'Reset token missing.' });
  res.render('reset-password', { title: 'Reset password', token, error: null });
});

// POST /reset-password
router.post('/reset-password', async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');
  const confirm = String(req.body.confirm || '');

  if (!token || !password || password !== confirm) {
    return res.status(400).render('reset-password', {
      title: 'Reset password',
      token,
      error: 'Passwords are required and must match.',
    });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await query(
    `SELECT id, user_id FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
    [tokenHash]
  );
  const reset = rows[0];
  if (!reset) {
    return res.status(400).render('error', { title: 'Invalid link', message: 'This reset link is invalid or expired.' });
  }

  const hash = await bcrypt.hash(password, 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, reset.user_id]);
  await query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [reset.id]);

  res.render('login', { title: 'Sign in', error: null, identifier: '', notice: 'Password updated — please sign in.' });
});

module.exports = router;
