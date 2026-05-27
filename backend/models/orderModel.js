const mongoose = require('mongoose');

const orderSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  status: { type: String, enum: ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'], default: 'Processing' },
  total: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  discount: { type: Number, required: true, default: 0 },
  gst: { type: Number, required: true },
  shippingFee: { type: Number, required: true },
  items: [{
    product: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true },
    img: { type: String, required: true }
  }],
  shippingAddress: {
    // Customer checkout fields (frontend uses these)
    firstName: String,
    lastName: String,
    phone: String,
    address: String,
    city: String,
    pin: String,

    // Backward compatibility / alternative naming
    street: String,
    state: String,
    zipCode: String,
  },
  paymentMethod: { type: String, enum: ['Razorpay', 'COD', 'UPI'], required: true },
  promoCode: { type: String },
  pricingBreakdown: {
    // Optional diagnostic info for auditing pricing decisions
    type: Object,
    default: undefined,
  },
  paymentResult: {
    id: String,
    status: String,
    update_time: String,
    email_address: String,
  },
  isPaid: { type: Boolean, required: true, default: false },
  paidAt: { type: Date },
  trackingEvents: [{
    status: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Compound indexes for efficient querying
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ isPaid: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
