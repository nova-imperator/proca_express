const jwt = require('jsonwebtoken');

const USER_COOKIE = 'pe_user';
const ADMIN_COOKIE = 'pe_admin';

function cookieOptions() {
  const inProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    // In prod the frontend (React build) is served by nginx on the same origin,
    // so SameSite=Lax is enough. For cross-origin dev (http://localhost:3000 →
    // http://localhost:5000), the browser would require SameSite=None+Secure,
    // but Secure won't work on plain http — so during local dev we set Lax and
    // rely on the Vite proxy (configured in frontend/vite.config.js) to keep
    // everything same-origin.
    sameSite: 'lax',
    secure: inProd,
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
  res.clearCookie(USER_COOKIE, { path: '/' });
  res.clearCookie(ADMIN_COOKIE, { path: '/' });
}

function verify(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Reads cookies and populates req.user / req.admin if tokens are valid.
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
