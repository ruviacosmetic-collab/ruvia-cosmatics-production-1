const rateLimitStore = require('../utils/rateLimitStore');

/**
 * Payment Rate Limiter Middleware
 * Implements rate limiting for payment processing endpoints
 * - Payment initiation: 3 attempts per minute per user
 * - Webhook processing: 10 webhooks per minute per merchant
 * - High-value transactions (>$1000): 1 attempt per 5 minutes
 */

/**
 * Rate limiter for payment initiation
 * Allows 3 payment attempts per minute per user
 * For transactions >$1000, allows 1 attempt per 5 minutes
 */
const paymentInitiationRateLimiter = (req, res, next) => {
  // Get user ID from authenticated request
  const userId = req.user ? req.user._id.toString() : req.ip;
  
  // Check if transaction amount exceeds $1000
  const amount = req.body && req.body.amount ? parseFloat(req.body.amount) : 0;
  const isHighValue = amount > 1000;
  
  // Set limits based on transaction value
  let limit, windowMs;
  if (isHighValue) {
    // High-value transactions: 1 attempt per 5 minutes
    limit = 1;
    windowMs = 5 * 60 * 1000; // 5 minutes
  } else {
    // Regular transactions: 3 attempts per minute
    limit = 3;
    windowMs = 60 * 1000; // 1 minute
  }
  
  const key = `payment:${userId}`;
  const result = rateLimitStore.increment(key, limit, windowMs);
  
  // Add rate limit headers to response
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
  
  // Check if limit exceeded
  if (result.count > limit) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    res.setHeader('Retry-After', retryAfter);
    
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many payment attempts. Please try again later.',
        retryAfter,
      },
    });
  }
  
  next();
};

/**
 * Rate limiter for webhook processing
 * Allows 10 webhooks per minute per merchant
 */
const webhookRateLimiter = (req, res, next) => {
  // Get merchant ID from webhook signature or IP
  const merchantId = req.headers['x-merchant-id'] || req.ip;
  const key = `webhook:${merchantId}`;
  
  // 10 webhooks per minute
  const limit = 10;
  const windowMs = 60 * 1000; // 1 minute
  
  const result = rateLimitStore.increment(key, limit, windowMs);
  
  // Add rate limit headers to response
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
  
  // Check if limit exceeded
  if (result.count > limit) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    res.setHeader('Retry-After', retryAfter);
    
    // Log the rate limit violation for fraud detection
    console.warn(`Webhook rate limit exceeded for merchant: ${merchantId}`);
    
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many webhook requests. Please try again later.',
        retryAfter,
      },
    });
  }
  
  next();
};

/**
 * Reset payment rate limit counter on successful payment
 * Call this after successful payment processing
 */
const resetPaymentAttempts = (req) => {
  const userId = req.user ? req.user._id.toString() : req.ip;
  const key = `payment:${userId}`;
  rateLimitStore.reset(key);
};

module.exports = {
  paymentInitiationRateLimiter,
  webhookRateLimiter,
  resetPaymentAttempts,
};
