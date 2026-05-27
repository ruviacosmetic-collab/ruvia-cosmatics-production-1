const Product = require('../models/productModel');
const Promotion = require('../models/promotionModel');

const nowInRange = (promo) => {
  const now = new Date();
  if (promo?.startAt && now < new Date(promo.startAt)) return false;
  if (promo?.endAt && now > new Date(promo.endAt)) return false;
  return true;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const computeB1G1FreeUnits = ({ qty, buyQty = 1, getQty = 1 }) => {
  const q = Number(qty || 0);
  const buy = Math.max(1, Number(buyQty || 1));
  const get = Math.max(1, Number(getQty || 1));
  const group = buy + get;
  const fullGroups = Math.floor(q / group);
  const remainder = q % group;
  const extraFree = Math.min(Math.max(0, remainder - buy), get);
  return fullGroups * get + extraFree;
};

const applyPromotionToCart = ({ promo, verifiedItems, subtotal }) => {
  if (!promo) return { discount: 0, shippingOverride: null, meta: null };
  if (!promo.isActive) return { discount: 0, shippingOverride: null, meta: { rejected: 'inactive' } };
  if (!nowInRange(promo)) return { discount: 0, shippingOverride: null, meta: { rejected: 'expired' } };
  if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
    return { discount: 0, shippingOverride: null, meta: { rejected: 'usage_limit' } };
  }

  const minSubtotal = Number(promo.minSubtotal || 0);
  if (subtotal < minSubtotal) {
    return { discount: 0, shippingOverride: null, meta: { rejected: 'min_subtotal', minSubtotal } };
  }

  let discount = 0;
  let shippingOverride = null;
  const type = promo.type;

  if (type === 'PERCENT') {
    const percent = clamp(Number(promo.percentOff || 0), 0, 100);
    discount = Math.round((subtotal * percent) / 100);
  } else if (type === 'FLAT') {
    discount = Math.round(Number(promo.flatOff || 0));
  } else if (type === 'B1G1') {
    const eligibleIds = new Set((promo.eligibleProductIds || []).map((x) => String(x)));
    const eligibleCats = new Set((promo.eligibleCategories || []).map((x) => String(x).toLowerCase()));
    for (const it of verifiedItems) {
      const isEligible =
        (eligibleIds.size === 0 || eligibleIds.has(String(it.product))) ||
        (eligibleCats.size > 0 && eligibleCats.has(String(it.category || '').toLowerCase()));
      if (!isEligible) continue;

      const freeUnits = computeB1G1FreeUnits({
        qty: it.qty,
        buyQty: promo.buyQty,
        getQty: promo.getQty,
      });
      discount += freeUnits * Number(it.price || 0);
    }
    discount = Math.round(discount);
  } else if (type === 'BUNDLE') {
    const bundleItems = Array.isArray(promo.bundleItems) ? promo.bundleItems : [];
    if (bundleItems.length > 0) {
      const byId = new Map(verifiedItems.map((it) => [String(it.product), it]));
      const satisfied = bundleItems.every((b) => {
        const it = byId.get(String(b.productId));
        return it && Number(it.qty || 0) >= Number(b.qty || 0);
      });
      if (satisfied) {
        const eligibleSubtotal = bundleItems.reduce((acc, b) => {
          const it = byId.get(String(b.productId));
          const qty = Number(b.qty || 0);
          return acc + qty * Number(it?.price || 0);
        }, 0);

        if (promo.bundlePrice !== undefined && promo.bundlePrice !== null) {
          discount = Math.max(0, Math.round(eligibleSubtotal - Number(promo.bundlePrice || 0)));
        } else if (promo.bundleFlatOff) {
          discount = Math.round(Number(promo.bundleFlatOff || 0));
        } else if (promo.bundlePercentOff) {
          const pct = clamp(Number(promo.bundlePercentOff || 0), 0, 100);
          discount = Math.round((eligibleSubtotal * pct) / 100);
        }
      } else {
        return { discount: 0, shippingOverride: null, meta: { rejected: 'bundle_not_satisfied' } };
      }
    }
  } else if (type === 'FREE_SHIPPING') {
    const threshold = Number(promo.freeShippingMinSubtotal ?? promo.minSubtotal ?? 0);
    if (subtotal >= threshold) shippingOverride = 0;
    discount = 0;
  }

  if (promo.maxDiscount !== undefined && promo.maxDiscount !== null) {
    discount = Math.min(discount, Number(promo.maxDiscount || 0));
  }

  // Never discount more than subtotal
  discount = clamp(discount, 0, subtotal);

  // If promo also sets freeShipping (boolean), respect it
  if (promo.freeShipping === true) shippingOverride = 0;

  return {
    discount,
    shippingOverride,
    meta: {
      promoId: promo._id,
      code: promo.code,
      type: promo.type,
    },
  };
};

const calculateOrderPricing = async ({ items, promoCode }) => {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('No order items');
    err.statusCode = 400;
    throw err;
  }

  // Verify items against DB
  let subtotal = 0;
  const verifiedItems = [];

  for (const item of items) {
    const id = String(item?.id || item?.product || '').trim();
    const qty = Number(item?.qty || item?.quantity || 0);
    if (!id) {
      const err = new Error('Invalid item id');
      err.statusCode = 400;
      throw err;
    }
    if (!qty || qty < 1) {
      const err = new Error(`Invalid quantity for product ${id}`);
      err.statusCode = 400;
      throw err;
    }

    const product = await Product.findOne({ id: String(id) });
    if (!product) {
      const err = new Error(`Product ${id} not found`);
      err.statusCode = 400;
      throw err;
    }

    if (product.countInStock < qty) {
      const err = new Error(`Insufficient stock for ${product.name}. Available: ${product.countInStock}`);
      err.statusCode = 400;
      throw err;
    }

    subtotal += Number(product.price || 0) * qty;
    verifiedItems.push({
      product: String(product.id),
      name: product.name,
      price: product.price,
      qty,
      img: product.image,
      category: product.category,
    });
  }

  subtotal = Math.round(subtotal);

  // Promotion lookup (optional)
  let promo = null;
  const cleanedCode = promoCode ? String(promoCode).trim().toUpperCase() : '';
  if (cleanedCode) {
    promo = await Promotion.findOne({ code: cleanedCode });
  }

  const promoResult = applyPromotionToCart({ promo, verifiedItems, subtotal });
  const discount = Number(promoResult.discount || 0);
  const discountedSubtotal = Math.max(0, subtotal - discount);

  // Option A: discount first, then GST on discounted subtotal
  const gst = Math.round(discountedSubtotal * 0.18);

  // Default shipping rule (can be overridden by promo)
  let shippingFee = discountedSubtotal > 500 ? 0 : 50;
  if (promoResult.shippingOverride === 0) shippingFee = 0;

  const total = discountedSubtotal + gst + shippingFee;

  return {
    verifiedItems,
    promo: promoResult?.meta?.promoId ? promo : null,
    promoMeta: promoResult.meta,
    subtotal,
    discount,
    discountedSubtotal,
    gst,
    shippingFee,
    total,
  };
};

module.exports = { calculateOrderPricing };

