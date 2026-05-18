// SVG image captcha. The server renders an obfuscated math expression as an
// SVG (lines/curves drawn through the glyphs to thwart simple OCR), signs the
// answer into a short-lived JWT, and returns both. The client sends the token
// + the user's typed answer; verify() rejects on bad signature, expiry, or
// wrong answer.
//
// Stateless by design: no captcha-id table to clean up across pm2 restarts.

const jwt = require('jsonwebtoken');
const svgCaptcha = require('svg-captcha');

const TTL_SECONDS = 120;            // solve within 2 min
const CAPTCHA_AUD = 'pe-captcha';   // narrows token reuse

function issue() {
  // svg-captcha builds a single-digit `a op b` expression and returns the
  // numeric answer as a string + the SVG markup. mathOperator restricts to
  // + and - so the answer is always a small whole number.
  const cap = svgCaptcha.createMathExpr({
    mathMin: 1,
    mathMax: 9,
    mathOperator: '+-',
    background: '#0f172a',  // dark slate; matches our admin header palette
    color: false,           // single-colour text reads cleaner against dark bg
    noise: 2,               // crossing curves
    width: 150,
    height: 50,
    fontSize: 56,
  });

  const token = jwt.sign(
    { answer: String(cap.text), aud: CAPTCHA_AUD },
    process.env.JWT_SECRET,
    { expiresIn: TTL_SECONDS }
  );

  // Return SVG as a data URL so the client can drop it straight into <img>.
  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(cap.data).toString('base64')}`;
  return { token, image: svgDataUrl };
}

function verify(token, userAnswer) {
  if (!token) return { ok: false, error: 'captcha_missing' };
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { audience: CAPTCHA_AUD });
  } catch (err) {
    return { ok: false, error: err.name === 'TokenExpiredError' ? 'captcha_expired' : 'captcha_invalid' };
  }
  const expected = String(payload.answer).trim();
  const got = String(userAnswer || '').trim();
  if (!expected || got !== expected) {
    return { ok: false, error: 'captcha_wrong' };
  }
  return { ok: true };
}

module.exports = { issue, verify };
