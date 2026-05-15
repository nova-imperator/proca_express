require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { pool } = require('./config/db');
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const { attachUser } = require('./middleware/auth');

const app = express();

// Trust the first proxy hop — needed on EC2 behind nginx so secure cookies + rate-limit IPs work.
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.static(path.join(__dirname, 'public')));

// Inject auth context (user/admin) into every request + view.
app.use(attachUser);
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.currentAdmin = req.admin || null;
  res.locals.recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY || '';
  next();
});

// Throttle abusive login attempts.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use(['/login', '/admin/login', '/forgot-password'], loginLimiter);

app.use('/', publicRoutes);
app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/admin', adminRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not found' });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.status(500).render('error', { title: 'Server error', message: err.message });
});

const port = parseInt(process.env.PORT || '3000', 10);
const server = app.listen(port, () => {
  console.log(`[proca-express] listening on :${port} (${process.env.NODE_ENV || 'development'})`);
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
