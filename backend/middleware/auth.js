const jwt = require('jsonwebtoken');

const USER_COOKIE = 'pe_user';
const ADMIN_COOKIE = 'pe_admin';

// Cookie `Secure` MUST be tied to whether the site actually serves over TLS,
// not to NODE_ENV. Browsers silently drop Secure cookies on http:// pages, so
// `secure: true` on a not-yet-HTTPS prod box means nobody stays logged in.
// Set COOKIE_SECURE=true in .env once TLS is in front (Certbot/nginx on 443).
const cookieSecure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    signed: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
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
