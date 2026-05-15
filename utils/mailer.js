const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) {
    // No SMTP configured yet — return a stub that logs to console.
    transporter = {
      sendMail: async (opts) => {
        console.log('[mail:stub] would send:', { to: opts.to, subject: opts.subject });
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
