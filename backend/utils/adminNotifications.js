const getAdminNotificationRecipients = () => {
  const raw = String(process.env.ADMIN_NOTIFICATIONS_EMAIL || '').trim();

  // If the explicit admin notifications list is set, use it.
  if (raw) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Fallback: when the dedicated admin notifications variable is not set,
  // route admin alerts to the configured support address (or the FROM
  // address as a last resort) so dev environments still see notifications
  // without extra configuration. In production, set ADMIN_NOTIFICATIONS_EMAIL
  // explicitly to the operations team's distribution list.
  const fallback =
    process.env.EMAIL_SUPPORT_EMAIL ||
    process.env.EMAIL_REPLY_TO ||
    process.env.EMAIL_FROM_EMAIL ||
    '';

  return fallback
    ? fallback.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
};

module.exports = { getAdminNotificationRecipients };

