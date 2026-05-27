const mongoose = require('mongoose');

/**
 * Support / contact form messages submitted from the public Support page.
 *
 * We persist these so admins can audit responses, and so we have a record
 * even when SMTP is misconfigured. The model is intentionally lightweight —
 * the admin notification email is the primary delivery mechanism today.
 */
const supportMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    topic: {
      type: String,
      trim: true,
      default: 'Other',
      maxlength: 120,
    },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    // Captured for abuse triage; never displayed to other users.
    ipAddress: { type: String },
    userAgent: { type: String },
    status: {
      type: String,
      enum: ['New', 'In Progress', 'Resolved', 'Spam'],
      default: 'New',
      index: true,
    },
  },
  { timestamps: true }
);

supportMessageSchema.index({ createdAt: -1 });
supportMessageSchema.index({ email: 1, createdAt: -1 });

const SupportMessage = mongoose.model('SupportMessage', supportMessageSchema);
module.exports = SupportMessage;
