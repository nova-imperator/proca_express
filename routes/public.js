const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { verify: verifyCaptcha } = require('../utils/recaptcha');
const mailer = require('../utils/mailer');

// GET /register-request — show form
router.get('/register-request', (req, res) => {
  res.render('register-request', {
    title: 'Register Request',
    form: {},
    error: null,
    success: null,
  });
});

// POST /register-request — store + email
router.post('/register-request', async (req, res) => {
  const {
    email = '',
    mobile = '',
    full_name = '',
    designation = '',
    company_name = '',
    company_gst = '',
    'g-recaptcha-response': captchaToken,
  } = req.body;

  const form = { email, mobile, full_name, designation, company_name, company_gst };
  const errors = [];
  if (!email.trim()) errors.push('Email is required.');
  if (!mobile.trim()) errors.push('Mobile number is required.');

  const captcha = await verifyCaptcha(captchaToken, req.ip);
  if (!captcha.ok) errors.push('Captcha verification failed.');

  if (errors.length) {
    return res.status(400).render('register-request', {
      title: 'Register Request',
      form,
      error: errors.join(' '),
      success: null,
    });
  }

  await query(
    `INSERT INTO register_requests
       (email, mobile, full_name, designation, company_name, company_gst)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [email.toLowerCase().trim(), mobile.trim(), full_name, designation, company_name, company_gst]
  );

  // Fire-and-forget: notify admin + ack to user.
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

  res.render('register-request', {
    title: 'Register Request',
    form: {},
    error: null,
    success: 'Thanks — we received your request and will be in touch soon.',
  });
});

module.exports = router;
