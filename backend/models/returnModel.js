const mongoose = require('mongoose');

const returnSchema = mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Order' },
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  reason: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Refunded', 'Rejected'], default: 'Pending' }
}, { timestamps: true });

const ReturnRequest = mongoose.model('ReturnRequest', returnSchema);
module.exports = ReturnRequest;
