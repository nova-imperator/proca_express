const express = require('express');
const router = express.Router();

// GET /api/config — small public bag of values the frontend needs to know at runtime
// (currently just whether reCAPTCHA is configured, so it can render the widget).
router.get('/config', (_req, res) => {
  res.json({
    recaptcha_site_key: process.env.RECAPTCHA_SITE_KEY || null,
  });
});

module.exports = router;
