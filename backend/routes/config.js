const express = require('express');
const router = express.Router();
const captcha = require('../utils/captcha');

// GET /api/config — small public bag of runtime values.
router.get('/config', (_req, res) => {
  res.json({
    // Math captcha is always on; clients should treat the boolean as "we will
    // verify on submit". Field name kept generic so the frontend can stay
    // agnostic about implementation.
    captcha_enabled: true,
  });
});

// GET /api/captcha — issue a fresh math captcha challenge.
router.get('/captcha', (_req, res) => {
  res.json(captcha.issue());
});

module.exports = router;
