const { Pool } = require('pg');

const useSsl = String(process.env.PGSSL || '').toLowerCase() === 'true';

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  // AWS RDS terminates TLS but uses a cert chain Node doesn't ship with by default.
  // For now we trust the server; harden by loading the RDS root CA when going to prod.
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[pg] idle client error', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
