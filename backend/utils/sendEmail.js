const nodemailer = require('nodemailer');
const https = require('https');

let cachedTransporter = null;

// Timeout (ms) for outbound email send. Keeps best-effort emails from blocking
// request handlers when the SMTP server is slow/unreachable.
const EMAIL_SEND_TIMEOUT_MS = 5000;

/**
 * Race a promise against a timeout. On timeout, rejects with a TimeoutError
 * tagged with `code: 'TIMEOUT'` so callers can detect and handle gracefully.
 */
const withTimeout = (promise, ms, label = 'operation') => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.code = 'TIMEOUT';
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/**
 * Send an email via Brevo's HTTPS REST API (port 443) instead of SMTP.
 *
 * Required when the host blocks outbound SMTP (Render, some Vercel plans, etc).
 * Activates automatically when BREVO_API_KEY is set; falls back to SMTP otherwise.
 *
 * Docs: https://developers.brevo.com/reference/sendtransacemail
 */
const sendViaBrevoApi = (mailOptions) => {
  const apiKey = process.env.BREVO_API_KEY;
  // Parse "Name <email>" or just "email"
  const fromMatch = String(mailOptions.from || '').match(/^(.*?)\s*<(.+)>$/);
  const senderName = fromMatch ? fromMatch[1].trim() : (process.env.EMAIL_FROM_NAME || 'Ruvia');
  const senderEmail = fromMatch ? fromMatch[2].trim() : (mailOptions.from || process.env.EMAIL_FROM_EMAIL);

  const payload = JSON.stringify({
    sender: { name: senderName, email: senderEmail },
    to: [{ email: mailOptions.to }],
    subject: mailOptions.subject,
    htmlContent: mailOptions.html || `<p>${mailOptions.text || ''}</p>`,
    textContent: mailOptions.text || undefined,
    replyTo: mailOptions.replyTo ? { email: mailOptions.replyTo } : undefined,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: 'api.brevo.com',
        path: '/v3/smtp/email',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'api-key': apiKey,
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 10000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (_e) {
              resolve({ raw: body });
            }
          } else {
            const err = new Error(`Brevo API ${res.statusCode}: ${body}`);
            err.code = 'BREVO_API_ERROR';
            err.responseCode = res.statusCode;
            err.response = body;
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Brevo API request timed out'));
    });
    req.write(payload);
    req.end();
  });
};

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 0);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // common SMTPS port
    auth: { user, pass },
  });

  return cachedTransporter;
};

const sendEmail = async (options) => {
  // Feature flag: allow disabling emails without breaking flows
  const enabled = String(process.env.EMAIL_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) return;

  const fromName = process.env.EMAIL_FROM_NAME || 'Ruvia';
  const fromEmail = process.env.EMAIL_FROM_EMAIL || 'info@ruviacosmetics.com';
  const mailOptions = {
    from: `${fromName} <${fromEmail}>`,
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  // Prefer Brevo HTTPS API if BREVO_API_KEY is configured (works on hosts that
  // block outbound SMTP like Render). Falls back to SMTP otherwise.
  if (process.env.BREVO_API_KEY) {
    try {
      await withTimeout(sendViaBrevoApi(mailOptions), EMAIL_SEND_TIMEOUT_MS * 2, 'brevoApiSend');
      return;
    } catch (err) {
      if (err && (err.code === 'TIMEOUT' || err.name === 'TimeoutError')) {
        console.warn('Brevo API send timed out:', err.message);
        return;
      }
      console.error(
        'Brevo API send failed:',
        (err && (err.responseCode || err.code || '')) +
          ' ' +
          (err && err.message ? err.message : err)
      );
      throw err;
    }
  }

  // Fallback: SMTP transport
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('Email transporter not configured (missing BREVO_API_KEY or EMAIL_HOST/EMAIL_PORT/EMAIL_USER/EMAIL_PASS). Skipping email.');
    return;
  }

  try {
    await withTimeout(
      transporter.sendMail(mailOptions),
      EMAIL_SEND_TIMEOUT_MS,
      'sendEmail'
    );
  } catch (err) {
    if (err && (err.code === 'TIMEOUT' || err.name === 'TimeoutError')) {
      console.warn('Email send timed out:', err.message);
      return;
    }
    console.error(
      'Email send failed:',
      (err && (err.responseCode || err.code || '')) +
        ' ' +
        (err && err.message ? err.message : err)
    );
    throw err;
  }
};

module.exports = sendEmail;
