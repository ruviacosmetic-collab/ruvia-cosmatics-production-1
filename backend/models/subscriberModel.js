const mongoose = require('mongoose');

/**
 * Newsletter subscribers.
 *
 * Captured from the home page email-capture form. Each subscriber record is
 * linked to the welcome promo code that was sent so we can audit who has been
 * issued the code and avoid spamming repeat senders.
 *
 * The email is stored lowercased + trimmed and unique-indexed so repeat
 * subscriptions are no-ops at the DB layer.
 */
const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    welcomeCode: { type: String },
    source: { type: String, default: 'home_newsletter' },
    lastSentAt: { type: Date },
  },
  { timestamps: true }
);

const Subscriber = mongoose.model('Subscriber', subscriberSchema);
module.exports = Subscriber;
