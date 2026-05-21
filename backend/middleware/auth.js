const jwt = require('jsonwebtoken');

const USER_COOKIE = 'pe_user';
const ADMIN_COOKIE = 'pe_admin';

// Cookie `Secure` MUST be tied to whether the site actually serves over TLS,
// not to NODE_ENV. Browsers silently drop Secure cookies on http:// pages, so
// `secure: true` on a not-yet-HTTPS prod box means nobody stays logged in.
// Set COOKIE_SECURE=true in .env once TLS is in front (Certbot/nginx on 443).
const cookieSecure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';

// Parse durations like "12h", "30m", "7d", "60s" into milliseconds. Used so
// the cookie's `maxAge` always matches the JWT's `expiresIn` — otherwise the
// cookie outlives a dead token and the browser keeps re-sending garbage.
function parseDurationMs(s) {
  const m = String(s || '').trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) return 12 * 60 * 60 * 1000; // default: 12h
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2].toLowerCase()];
  return Number(m[1]) * mult;
}

const SESSION_TTL = process.env.JWT_EXPIRES_IN || '12h';
const SESSION_TTL_MS = parseDurationMs(SESSION_TTL);

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    signed: true,
    maxAge: SESSION_TTL_MS,
    path: '/',
  };
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: SESSION_TTL });
}

function setUserCookie(res, user) {
  res.cookie(USER_COOKIE, signToken({ sub: user.id, kind: 'user' }), cookieOptions());
}

function setAdminCookie(res, admin) {
  res.cookie(ADMIN_COOKIE, signToken({ sub: admin.id, kind: 'admin' }), cookieOptions());
}

function clearAuthCookies(res) {
  // Clear options must mirror the Set-Cookie options the browser stored, or
  // the clear is ignored. `secure` and `sameSite` must match.
  const opts = { path: '/', sameSite: 'lax', secure: cookieSecure };
  res.clearCookie(USER_COOKIE, opts);
  res.clearCookie(ADMIN_COOKIE, opts);
}

function verify(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function attachUser(req, _res, next) {
  const userTok = req.signedCookies?.[USER_COOKIE];
  const adminTok = req.signedCookies?.[ADMIN_COOKIE];
  if (userTok) {
    const payload = verify(userTok);
    if (payload?.kind === 'user') req.user = { id: payload.sub };
  }
  if (adminTok) {
    const payload = verify(adminTok);
    if (payload?.kind === 'admin') req.admin = { id: payload.sub };
  }
  next();
}

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.admin) return res.status(401).json({ error: 'unauthorized' });
  next();
}

module.exports = {
  USER_COOKIE,
  ADMIN_COOKIE,
  attachUser,
  requireUser,
  requireAdmin,
  setUserCookie,
  setAdminCookie,
  clearAuthCookies,
};
