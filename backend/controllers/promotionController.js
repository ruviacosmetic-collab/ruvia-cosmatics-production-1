const Promotion = require('../models/promotionModel');
const Subscriber = require('../models/subscriberModel');
const sendEmail = require('../utils/sendEmail');
const { welcomeCouponEmail } = require('../utils/emailTemplates');

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

const isPromoActiveNow = (promo) => {
  if (!promo?.isActive) return false;
  const now = new Date();
  if (promo.startAt && now < new Date(promo.startAt)) return false;
  if (promo.endAt && now > new Date(promo.endAt)) return false;
  if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return false;
  return true;
};

// Admin: list promotions
const listPromotions = async (req, res) => {
  const promos = await Promotion.find({}).sort({ createdAt: -1 });
  res.json(promos);
};

// Admin: create promotion
const createPromotion = async (req, res) => {
  const payload = { ...(req.body || {}) };
  payload.code = normalizeCode(payload.code);
  if (!payload.code) return res.status(400).json({ message: 'code is required' });
  if (!payload.type) return res.status(400).json({ message: 'type is required' });

  const exists = await Promotion.findOne({ code: payload.code });
  if (exists) return res.status(400).json({ message: 'Promotion code already exists' });

  const promo = await Promotion.create(payload);
  res.status(201).json(promo);
};

// Admin: update promotion
const updatePromotion = async (req, res) => {
  const promo = await Promotion.findById(req.params.id);
  if (!promo) return res.status(404).json({ message: 'Promotion not found' });

  const payload = { ...(req.body || {}) };
  if (payload.code) payload.code = normalizeCode(payload.code);

  Object.assign(promo, payload);
  await promo.save();
  res.json(promo);
};

// Admin: delete promotion
const deletePromotion = async (req, res) => {
  const promo = await Promotion.findById(req.params.id);
  if (!promo) return res.status(404).json({ message: 'Promotion not found' });
  await Promotion.findByIdAndDelete(req.params.id);
  res.json({ message: 'Promotion deleted' });
};

// Public: validate a promo code (does not apply pricing)
const validatePromotion = async (req, res) => {
  const code = normalizeCode(req.params.code || req.query.code);
  if (!code) return res.status(400).json({ message: 'code is required' });

  const promo = await Promotion.findOne({ code });
  if (!promo) return res.status(404).json({ message: 'Invalid promo code' });

  const active = isPromoActiveNow(promo);
  if (!active) return res.status(400).json({ message: 'Promo code is not active' });

  res.json({
    code: promo.code,
    type: promo.type,
    minSubtotal: promo.minSubtotal || 0,
    maxDiscount: promo.maxDiscount ?? null,
    isActive: true,
    startAt: promo.startAt ?? null,
    endAt: promo.endAt ?? null,
  });
};

// Welcome promo defaults — used when ensuring the WELCOME15 code exists in DB.
// Kept conservative: 15% off, no minimum, no expiry, no usage cap.
const WELCOME_PROMO_CODE = 'WELCOME15';
const WELCOME_PROMO_PERCENT = 15;

const isValidEmail = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return false;
  // Basic RFC-5322-lite check; we deliberately don't try to be exhaustive.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

const ensureWelcomePromoExists = async () => {
  let promo = await Promotion.findOne({ code: WELCOME_PROMO_CODE });
  if (promo) return promo;

  promo = await Promotion.create({
    code: WELCOME_PROMO_CODE,
    name: 'First-order welcome 15% off',
    type: 'PERCENT',
    percentOff: WELCOME_PROMO_PERCENT,
    minSubtotal: 0,
    isActive: true,
  });
  return promo;
};

// Public: subscribe to the newsletter and receive a welcome coupon by email.
// No login or CSRF token required so the home-page form works for guests.
const subscribeNewsletter = async (req, res) => {
  const rawEmail = (req.body && req.body.email) || '';
  const email = String(rawEmail).trim().toLowerCase();

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'A valid email address is required' });
  }

  try {
    // Make sure the promo exists so admins don't have to seed it manually.
    const promo = await ensureWelcomePromoExists();

    // Idempotent upsert. Repeat subscriptions just refresh `lastSentAt`.
    const subscriber = await Subscriber.findOneAndUpdate(
      { email },
      {
        $setOnInsert: { email, source: 'home_newsletter' },
        $set: { welcomeCode: promo.code, lastSentAt: new Date() },
      },
      { upsert: true, new: true }
    );

    // Best-effort email send (don't block the API on SMTP).
    try {
      const tpl = welcomeCouponEmail({
        email,
        code: promo.code,
        percentOff: promo.percentOff || WELCOME_PROMO_PERCENT,
      });
      setImmediate(() => {
        sendEmail({
          email,
          subject: tpl.subject,
          message: tpl.text,
          html: tpl.html,
        }).catch((err) => console.error('Welcome coupon email failed', err));
      });
    } catch (err) {
      console.error('Could not enqueue welcome coupon email', err);
    }

    return res.status(200).json({
      message: 'Welcome coupon sent. Check your inbox.',
      code: promo.code,
      percentOff: promo.percentOff || WELCOME_PROMO_PERCENT,
      subscriberId: subscriber._id,
    });
  } catch (err) {
    console.error('subscribeNewsletter error:', err);
    return res
      .status(500)
      .json({ message: 'Something went wrong while subscribing. Please try again.' });
  }
};

module.exports = {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  validatePromotion,
  subscribeNewsletter,
};

