const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const captcha = require('../utils/captcha');
const mailer = require('../utils/mailer');

// POST /api/register-request
router.post('/register-request', async (req, res) => {
  const {
    email = '',
    mobile = '',
    full_name = '',
    designation = '',
    company_name = '',
    company_gst = '',
    captcha_token,
    captcha_answer,
  } = req.body || {};

  const errors = [];
  if (!String(email).trim()) errors.push('email_required');
  if (!String(mobile).trim()) errors.push('mobile_required');

  const cap = captcha.verify(captcha_token, captcha_answer);
  if (!cap.ok) errors.push(cap.error);

  if (errors.length) {
    return res.status(400).json({ error: 'validation_failed', details: errors });
  }

  await query(
    `INSERT INTO register_requests
       (email, mobile, full_name, designation, company_name, company_gst)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      String(email).toLowerCase().trim(),
      String(mobile).trim(),
      full_name,
      designation,
      company_name,
      company_gst,
    ]
  );

  mailer
    .send({
      to: process.env.MAIL_ADMIN_NOTIFY,
      subject: 'New register request — Proca Express',
      text: `New request from ${full_name || email} (${email}, ${mobile}).`,
    })
    .catch((e) => console.error('[mail] admin notify failed', e));

  mailer
    .send({
      to: email,
      subject: 'We received your request — Proca Express',
      text: `Hi ${full_name || ''},\n\nThanks for registering. Our team will reach out shortly.\n\n— Proca Express`,
    })
    .catch((e) => console.error('[mail] ack failed', e));

  res.json({ ok: true });
});

module.exports = router;
