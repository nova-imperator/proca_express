// Read-only RDS probe: connects to the `postgres` system DB, reports version
// and whether the target database in $PGDATABASE exists. Makes no changes.

require('dotenv').config();
const { Client } = require('pg');

const targetDb = process.env.PGDATABASE || 'proca_express';
const useSsl = String(process.env.PGSSL || '').toLowerCase() === 'true';

const client = new Client({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: 'postgres', // system DB
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 8000,
});

(async () => {
  const started = Date.now();
  try {
    await client.connect();
    const v = await client.query('SELECT version() AS version, current_user AS user, inet_server_addr()::text AS server_ip');
    const dbs = await client.query(
      'SELECT datname FROM pg_database WHERE datname = $1',
      [targetDb]
    );
    console.log('OK   connected in', Date.now() - started, 'ms');
    console.log('     version :', v.rows[0].version);
    console.log('     user    :', v.rows[0].user);
    console.log('     server  :', v.rows[0].server_ip);
    console.log('     target db `' + targetDb + '` exists:', dbs.rowCount > 0);
  } catch (err) {
    console.error('FAIL ', err.code || '', err.message);
    if (err.code === 'ENOTFOUND') console.error('     DNS failed — PGHOST is wrong or unreachable.');
    if (err.code === 'ETIMEDOUT') console.error('     Timed out — RDS security group likely blocks your IP.');
    if (err.code === 'ECONNREFUSED') console.error('     Refused — port closed.');
    if (err.code === '28P01' || err.code === '28000') console.error('     Auth failed — PGUSER / PGPASSWORD wrong.');
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
