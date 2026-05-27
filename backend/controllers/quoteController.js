const { calculateOrderPricing } = require('../utils/pricingEngine');

// @desc    Quote order totals (no order created)
// @route   POST /api/orders/quote
// @access  Private
const quoteOrder = async (req, res) => {
  try {
    const { items, promoCode } = req.body || {};
    const pricing = await calculateOrderPricing({ items, promoCode });

    res.json({
      promo: pricing.promoMeta || null,
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      discountedSubtotal: pricing.discountedSubtotal,
      gst: pricing.gst,
      shippingFee: pricing.shippingFee,
      total: pricing.total,
    });
  } catch (error) {
    console.error('quoteOrder error:', error);
    res.status(error.statusCode || 400).json({ message: error.message || 'Failed to quote order' });
  }
};

module.exports = { quoteOrder };

