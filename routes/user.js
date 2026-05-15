const express = require('express');
const router = express.Router();
const { requireUser } = require('../middleware/auth');
const { query } = require('../config/db');

// GET /home — user dashboard (devices coming later)
router.get('/home', requireUser, async (req, res) => {
  const { rows } = await query(
    'SELECT id, email, full_name, mobile FROM users WHERE id = $1',
    [req.user.id]
  );
  res.render('home', { title: 'Dashboard', me: rows[0] || null });
});

module.exports = router;
