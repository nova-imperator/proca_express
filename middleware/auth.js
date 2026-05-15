const jwt = require('jsonwebtoken');

const USER_COOKIE = 'pe_user';
const ADMIN_COOKIE = 'pe_admin';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
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
  if (!req.user) return res.redirect('/');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.admin) return res.redirect('/admin');
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
