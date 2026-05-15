// Quick one-off introspection helper. Safe to run anytime: read-only.
// Usage: node db/inspect.js
require('dotenv').config();
const { pool } = require('../config/db');

(async () => {
  console.log('--- register_requests (latest 10) ---');
  const rr = await pool.query(
    'SELECT id, email, mobile, full_name, status, created_at FROM register_requests ORDER BY created_at DESC LIMIT 10'
  );
  console.table(rr.rows);

  console.log('\n--- users (latest 10) ---');
  const us = await pool.query(
    'SELECT id, email, mobile, full_name, is_active, created_at FROM users ORDER BY created_at DESC LIMIT 10'
  );
  console.table(us.rows);

  console.log('\n--- admins ---');
  const ad = await pool.query('SELECT id, email, created_at FROM admins ORDER BY id');
  console.table(ad.rows);

  const c = await pool.query("SELECT COUNT(*)::int AS n FROM register_requests WHERE status = 'pending'");
  console.log('\npending register requests:', c.rows[0].n);

  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
