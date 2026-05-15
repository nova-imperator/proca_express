// Google reCAPTCHA v2/v3 server-side verification.
// Skipped silently when RECAPTCHA_SECRET_KEY is unset so local dev still works.

async function verify(token, remoteIp) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, error: 'missing-token' };

  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.set('remoteip', remoteIp);

  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    return { ok: !!data.success, score: data.score, raw: data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { verify };
