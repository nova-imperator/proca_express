const express = require('express');
const router = express.Router();
const { requireUser } = require('../middleware/auth');
const { query } = require('../config/db');

// GET /api/devices — placeholder until the devices feature lands
router.get('/devices', requireUser, async (req, res) => {
  const { rows } = await query(
    `SELECT id, device_name, imei, status, last_seen_at
       FROM devices WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({ devices: rows });
});

module.exports = router;
