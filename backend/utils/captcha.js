// Custom image captcha — math expression on a white card scattered with
// Ishihara-style coloured dots.
//
//   • Easy for humans:  big bold dark text on a white background, dots act
//                       as decoration around the digits.
//   • Hard for bots:    dots overlap parts of the glyphs, glyphs are slightly
//                       rotated and randomly nudged so naive OCR templates
//                       won't latch on, and the answer never appears in the
//                       rendered image (only the expression does).
//
// Stateless: the server signs the answer into a 2-min JWT and returns the
// SVG + token; verify() checks signature + user-submitted answer.

const jwt = require('jsonwebtoken');

const TTL_SECONDS = 120;
const CAPTCHA_AUD = 'pe-captcha';

const W = 200;
const H = 64;

// Muted earth/grass/clay tones evocative of the Ishihara colour-blindness
// plates — close enough in luminance that the foreground text only stands
// out via the dark fill, not via brightness contrast with the dots.
const DOT_PALETTE = [
  '#d97706', '#b45309', '#92400e', '#a16207', '#854d0e', // ambers
  '#15803d', '#16a34a', '#65a30d', '#4d7c0f', '#166534', // greens
  '#dc2626', '#b91c1c', '#7c2d12', '#9a3412',             // reds / browns
  '#ca8a04', '#eab308',                                   // yellows
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

function generateMath() {
  const op = Math.random() < 0.5 ? '+' : '-';
  let a = randInt(2, 9);
  let b = randInt(1, 9);
  let answer;
  if (op === '+') {
    answer = a + b;
  } else {
    if (b > a) [a, b] = [b, a];   // never negative
    answer = a - b;
  }
  return { expression: `${a} ${op} ${b}`, answer };
}

function buildSvg(expression) {
  // Layer 1: ~110 randomly-placed dots, mixed sizes, around the edges of
  // the canvas so text in the middle stays mostly clean — bots that just
  // sample text-coloured pixels still have to navigate around them.
  const dots = [];
  for (let i = 0; i < 110; i++) {
    const cx = randInt(2, W - 2);
    const cy = randInt(2, H - 2);
    const r = randInt(3, 7);
    const fill = pick(DOT_PALETTE);
    const opacity = (0.55 + Math.random() * 0.4).toFixed(2);
    dots.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`);
  }

  // Layer 2: the expression itself. Each character placed individually so
  // we can rotate it a few degrees and nudge its baseline — defeats fixed
  // bounding-box OCR templates while staying easily readable.
  const chars = expression.split('');
  const padX = 16;
  const span = (W - padX * 2);
  const step = span / Math.max(chars.length, 1);
  const textNodes = chars.map((c, i) => {
    if (c === ' ') return '';
    const x = padX + (i + 0.5) * step;
    const y = H / 2 + 14;
    const rot = randInt(-12, 12);
    const jitterY = randInt(-3, 3);
    return (
      `<text x="${x}" y="${y + jitterY}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" ` +
      `font-size="36" font-weight="800" fill="#0f172a" text-anchor="middle" ` +
      `transform="rotate(${rot} ${x} ${y + jitterY})">${c}</text>`
    );
  }).join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    dots.join('') +
    textNodes +
    `</svg>`
  );
}

function issue() {
  const { expression, answer } = generateMath();
  const svg = buildSvg(expression);
  const token = jwt.sign(
    { answer: String(answer), aud: CAPTCHA_AUD },
    process.env.JWT_SECRET,
    { expiresIn: TTL_SECONDS }
  );
  const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return { token, image };
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
