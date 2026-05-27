const SupportMessage = require('../models/supportMessageModel');
const sendEmail = require('../utils/sendEmail');
const { getAdminNotificationRecipients } = require('../utils/adminNotifications');
const {
  adminSupportMessageEmail,
  customerSupportAcknowledgementEmail,
} = require('../utils/emailTemplates');

const isValidEmail = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

const queueEmail = ({ to, subject, text, html, label }) => {
  if (!to) return;
  setImmediate(() => {
    sendEmail({ email: to, subject, message: text, html }).catch((err) => {
      // Surface the actual SMTP error in the log so the operator can see why
      // a "successful" submit didn't produce mail (e.g. Brevo IP allowlist).
      console.error(`${label} email failed:`, err && err.message ? err.message : err);
    });
  });
};

// @desc    Submit a support / contact-us message from the public Support page.
// @route   POST /api/support/contact
// @access  Public (no auth, no CSRF token required)
const submitContactMessage = async (req, res) => {
  try {
    const { name, email, topic, message } = req.body || {};

    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanTopic = String(topic || 'Other').trim() || 'Other';
    const cleanMessage = String(message || '').trim();

    if (!cleanName) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ message: 'A valid email is required' });
    }
    if (!cleanMessage) {
      return res.status(400).json({ message: 'Message is required' });
    }
    if (cleanMessage.length > 5000) {
      return res
        .status(400)
        .json({ message: 'Message is too long (max 5000 characters)' });
    }

    const record = await SupportMessage.create({
      name: cleanName,
      email: cleanEmail,
      topic: cleanTopic,
      message: cleanMessage,
      ipAddress: req.ip,
      userAgent: req.headers && req.headers['user-agent'],
    });

    // 1) Notify admin(s). When ADMIN_NOTIFICATIONS_EMAIL is unset we fall
    //    back to EMAIL_SUPPORT_EMAIL so dev environments still see alerts.
    const recipients = getAdminNotificationRecipients();
    if (recipients.length > 0) {
      try {
        const tpl = adminSupportMessageEmail({
          name: cleanName,
          email: cleanEmail,
          topic: cleanTopic,
          message: cleanMessage,
          createdAt: record.createdAt,
        });
        queueEmail({
          to: recipients.join(','),
          subject: tpl.subject,
          text: tpl.text,
          html: tpl.html,
          label: 'Admin support message',
        });
      } catch (e) {
        console.error('Could not enqueue admin support message email', e);
      }
    } else {
      console.warn(
        'No admin notification recipients configured; skipping admin support email.'
      );
    }

    // 2) Acknowledgement email to the customer.
    try {
      const tpl = customerSupportAcknowledgementEmail({
        name: cleanName,
        topic: cleanTopic,
        message: cleanMessage,
      });
      queueEmail({
        to: cleanEmail,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
        label: 'Customer support acknowledgement',
      });
    } catch (e) {
      console.error('Could not enqueue customer support acknowledgement', e);
    }

    return res.status(201).json({
      message: 'Message received. We will get back to you within 24 hours.',
      id: record._id,
    });
  } catch (err) {
    console.error('submitContactMessage error:', err);
    return res
      .status(500)
      .json({ message: 'Could not submit your message. Please try again.' });
  }
};

module.exports = { submitContactMessage };
