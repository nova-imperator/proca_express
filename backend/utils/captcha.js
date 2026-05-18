// Tiny homegrown math captcha.
// - issue() picks two small numbers and an operator, signs the answer into a
//   short-lived JWT, and returns the question + token to the client.
// - verify() checks the JWT is well-formed, unexpired, and that the user's
//   answer matches the signed `answer` claim.
//
// Why JWT instead of a server-side store? Stateless and pool-friendly: no
// need to track captcha IDs across pm2 workers / restarts, no cleanup job.

const jwt = require('jsonwebtoken');

const TTL_SECONDS = 120;            // captcha must be solved within 2 min
const CAPTCHA_AUD = 'pe-captcha';   // narrows token reuse (login won't accept a session token, etc.)

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function issue() {
  // Keep it accessible: single-digit addition or subtraction, never negative.
  const op = Math.random() < 0.5 ? '+' : '-';
  let a = randInt(2, 9);
  let b = randInt(1, 9);
  let answer;
  if (op === '+') {
    answer = a + b;
  } else {
    if (b > a) [a, b] = [b, a]; // ensure non-negative
    answer = a - b;
  }
  const challenge = `What is ${a} ${op} ${b}?`;
  const token = jwt.sign(
    { answer, aud: CAPTCHA_AUD },
    process.env.JWT_SECRET,
    { expiresIn: TTL_SECONDS }
  );
  return { token, challenge };
}

function verify(token, userAnswer) {
  if (!token) return { ok: false, error: 'captcha_missing' };
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { audience: CAPTCHA_AUD });
  } catch (err) {
    return { ok: false, error: err.name === 'TokenExpiredError' ? 'captcha_expired' : 'captcha_invalid' };
  }
  const expected = Number(payload.answer);
  const got = Number(String(userAnswer || '').trim());
  if (!Number.isFinite(got) || got !== expected) {
    return { ok: false, error: 'captcha_wrong' };
  }
  return { ok: true };
}

module.exports = { issue, verify };
