require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { pool } = require('./config/db');
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const { attachUser } = require('./middleware/auth');

const app = express();

// Behind nginx in prod; needed so secure cookies + rate-limit IP attribution work.
app.set('trust proxy', 1);

// CORS: explicit origin(s) + credentials so the React frontend can send cookies.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin (no Origin header) and any in the allowlist.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(attachUser);

// Public throttle on auth endpoints.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use(['/api/auth', '/api/admin/auth', '/api/register-request'], authLimiter);

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
});

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.code || 'server_error', message: err.message });
});

const port = parseInt(process.env.PORT || '5000', 10);
const server = app.listen(port, () => {
  console.log(`[proca-api] listening on :${port} (${process.env.NODE_ENV || 'development'})`);
});

async function shutdown(signal) {
  console.log(`[shutdown] ${signal} received`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
