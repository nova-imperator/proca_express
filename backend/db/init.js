// Idempotent bootstrap: applies schema.sql and seeds an initial admin if none exists.
// Usage: node db/init.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('[init] applying schema.sql ...');
  await pool.query(sql);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM admins');
  if (rows[0].n === 0) {
    const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').toLowerCase().trim();
    const pwd = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
    if (!email || !pwd) {
      console.warn('[init] no admin exists and BOOTSTRAP_ADMIN_EMAIL/PASSWORD not set — skipping seed.');
    } else {
      const hash = await bcrypt.hash(pwd, 12);
      await pool.query('INSERT INTO admins (email, password_hash) VALUES ($1, $2)', [email, hash]);
      console.log(`[init] seeded admin ${email}`);
    }
  } else {
    console.log('[init] admins table already populated — skipping seed.');
  }

  await pool.end();
  console.log('[init] done.');
}

main().catch((err) => {
  console.error('[init] failed:', err);
  process.exit(1);
});
