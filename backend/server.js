require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { pool } = require('./config/db');
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const configRoutes = require('./routes/config');
const { attachUser } = require('./middleware/auth');

// Fail loud at startup if a critical secret is missing or obviously a placeholder.
function assertEnv() {
  const required = ['JWT_SECRET', 'COOKIE_SECRET', 'PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[fatal] missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
  // Refuse to boot in production with weak/default secrets.
  if (process.env.NODE_ENV === 'production') {
    for (const k of ['JWT_SECRET', 'COOKIE_SECRET']) {
      if (process.env[k].length < 32 || /change.?me|dev.?only/i.test(process.env[k])) {
        console.error(`[fatal] ${k} looks like a placeholder; generate with: openssl rand -hex 32`);
        process.exit(1);
      }
    }
  }
}
assertEnv();

const app = express();

// Behind nginx in prod — needed so rate-limit attributes the right IP and
// cookie `secure` evaluation can read `req.secure` correctly.
app.set('trust proxy', 1);

// Security headers (defaults are safe; CSP turned off because the Vite-built
// bundle uses inline styles, which a strict CSP would block).
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// CORS: explicit origin allowlist + credentials so the React frontend can
// send the auth cookie.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin (no Origin header — e.g., curl) and anything in the allowlist.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Belt-and-suspenders CSRF defense: any state-changing request that carries
// an Origin or Referer must match the allowlist. SameSite=Lax already blocks
// most cross-site forms; this stops the rest.
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return next(); // server-to-server, no browser to forge from
  const ok = allowedOrigins.some((o) => origin.startsWith(o));
  if (!ok) return res.status(403).json({ error: 'origin_not_allowed' });
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(attachUser);

// Throttle abuse-prone endpoints (login attempts, password reset, signup).
// Scope must NOT include /me — that fires on every page load and would lock
// out users for refreshing the dashboard. We attach the limiter only to the
// actual sensitive paths.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'too_many_attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});
const sensitivePaths = [
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/admin/auth/login',
  '/api/register-request',
];
sensitivePaths.forEach((p) => app.use(p, authLimiter));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.use('/api', configRoutes);
app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
});

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  // Never leak internal error messages to clients in prod.
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: err.code || 'server_error',
    message: isProd ? 'Something went wrong' : err.message,
  });
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
