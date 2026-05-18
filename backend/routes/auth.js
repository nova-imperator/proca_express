const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const { query } = require('../config/db');
const { setUserCookie, clearAuthCookies } = require('../middleware/auth');
const captcha = require('../utils/captcha');
const mailer = require('../utils/mailer');

// GET /api/auth/me
router.get('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  const { rows } = await query(
    'SELECT id, email, mobile, full_name, designation, company_name FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!rows[0]) return res.status(401).json({ error: 'unauthorized' });
  res.json({ user: rows[0] });
});

// POST /api/auth/login   body: { identifier, password, captcha_token, captcha_answer }
router.post('/login', async (req, res) => {
  const identifier = String(req.body?.identifier || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!identifier || !password) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  const cap = captcha.verify(req.body?.captcha_token, req.body?.captcha_answer);
  if (!cap.ok) return res.status(400).json({ error: cap.error });

  // Match by email (case-insensitive) OR by mobile. For mobile we compare the
  // last 10 digits of both stored and input — so "+91 8929023900" and
  // "8929023900" both match a row stored as either form.
  const digitsOnly = identifier.replace(/\D/g, '');
  const { rows } = await query(
    `SELECT id, email, mobile, full_name, password_hash, is_active FROM users
       WHERE LOWER(email) = $1
          OR (
               LENGTH($2) >= 10
               AND RIGHT(regexp_replace(mobile, '\\D', '', 'g'), 10) = RIGHT($2, 10)
             )
       LIMIT 1`,
    [identifier, digitsOnly]
  );
  const user = rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  setUserCookie(res, user);
  res.json({
    ok: true,
    user: { id: user.id, email: user.email, mobile: user.mobile, full_name: user.full_name },
  });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

// POST /api/auth/forgot-password   body: { email }
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const generic = { ok: true, message: 'If an account exists for that email, a reset link has been sent.' };
  if (!email) return res.json(generic);

  const { rows } = await query('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [email]);
  const user = rows[0];
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

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

// POST /api/auth/reset-password   body: { token, password }
router.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');

  if (!token || !password) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password_too_short' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await query(
    `SELECT id, user_id FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
    [tokenHash]
  );
  const reset = rows[0];
  if (!reset) return res.status(400).json({ error: 'invalid_or_expired_token' });

  const hash = await bcrypt.hash(password, 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, reset.user_id]);
  await query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [reset.id]);

  res.json({ ok: true });
});

module.exports = router;
