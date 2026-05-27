const mongoose = require('mongoose');

const webhookEventSchema = mongoose.Schema({
  hash: { type: String, required: true, unique: true },
  event: { type: String },
  receivedAt: { type: Date, default: Date.now }
});

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
module.exports = WebhookEvent;
