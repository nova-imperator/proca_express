const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) {
    // No SMTP configured yet — log the full envelope so dev/staging can grab
    // password-reset links from `pm2 logs` instead of needing a real inbox.
    transporter = {
      sendMail: async (opts) => {
        console.log('[mail:stub] would send →', opts.to);
        console.log('             subject :', opts.subject);
        if (opts.text) {
          console.log('             body    :');
          opts.text.split('\n').forEach((line) => console.log('               ', line));
        }
        return { messageId: 'stub' };
      },
    };
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

async function send({ to, subject, text, html }) {
  const t = getTransporter();
  return t.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@procaexpress.in',
    to,
    subject,
    text,
    html,
  });
}

module.exports = { send };
