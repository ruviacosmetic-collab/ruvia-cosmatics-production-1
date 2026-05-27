const mongoose = require('mongoose');

const bundleItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true }, // Product.id (public id/slug)
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const promotionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    isActive: { type: Boolean, default: true },
    startAt: { type: Date },
    endAt: { type: Date },

    // PERCENT | FLAT | B1G1 | BUNDLE | FREE_SHIPPING
    type: {
      type: String,
      required: true,
      enum: ['PERCENT', 'FLAT', 'B1G1', 'BUNDLE', 'FREE_SHIPPING'],
    },

    // Common constraints
    minSubtotal: { type: Number, default: 0 },
    maxDiscount: { type: Number }, // cap (optional)
    usageLimit: { type: Number }, // global usage cap (optional)
    usedCount: { type: Number, default: 0 },

    // PERCENT
    percentOff: { type: Number }, // 0-100

    // FLAT
    flatOff: { type: Number }, // INR

    // B1G1 (general buyX getY free for same eligible SKU)
    buyQty: { type: Number, default: 1 },
    getQty: { type: Number, default: 1 },
    eligibleProductIds: [{ type: String }],
    eligibleCategories: [{ type: String }],

    // BUNDLE (cart must contain all required items)
    bundleItems: [bundleItemSchema],
    bundlePrice: { type: Number }, // optional fixed price for bundle (advanced)
    bundleFlatOff: { type: Number }, // optional flat off when bundle satisfied
    bundlePercentOff: { type: Number }, // optional percent off eligible items subtotal

    // FREE_SHIPPING
    freeShipping: { type: Boolean, default: false },
    freeShippingMinSubtotal: { type: Number }, // optional threshold for free shipping
  },
  { timestamps: true }
);

promotionSchema.pre('save', function () {
  if (this.code) this.code = String(this.code).trim().toUpperCase();
});

const Promotion = mongoose.model('Promotion', promotionSchema);
module.exports = Promotion;

