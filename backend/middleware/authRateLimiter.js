const rateLimitStore = require('../utils/rateLimitStore');

/**
 * Authentication Rate Limiter Middleware
 * Implements rate limiting for login and registration endpoints
 * - Login: 5 failed attempts per 15 minutes per IP
 * - Register: 3 attempts per hour per IP
 */

/**
 * Rate limiter for login endpoint
 * Allows 5 failed attempts per 15 minutes per IP
 */
const loginRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const key = `login:${ip}`;
  
  // 5 attempts per 15 minutes
  const limit = 5;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  
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
        message: 'Too many login attempts. Please try again later.',
        retryAfter,
      },
    });
  }
  
  next();
};

/**
 * Rate limiter for registration endpoint
 * Allows 3 attempts per hour per IP
 */
const registerRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const key = `register:${ip}`;
  
  // 3 attempts per hour
  const limit = 3;
  const windowMs = 60 * 60 * 1000; // 1 hour
  
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
        message: 'Too many registration attempts. Please try again later.',
        retryAfter,
      },
    });
  }
  
  next();
};

/**
 * Rate limiter for password reset endpoint
 * Allows 3 attempts per hour per IP
 */
const passwordResetRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const key = `password-reset:${ip}`;
  
  // 3 attempts per hour
  const limit = 3;
  const windowMs = 60 * 60 * 1000; // 1 hour
  
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
        message: 'Too many password reset attempts. Please try again later.',
        retryAfter,
      },
    });
  }
  
  next();
};

/**
 * Rate limiter for verification email resend endpoint
 * Allows 3 attempts per hour per IP
 * Keyed separately from password reset so the counters don't share buckets.
 */
const verificationResendRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const key = `verification-resend:${ip}`;

  // 3 attempts per hour
  const limit = 3;
  const windowMs = 60 * 60 * 1000; // 1 hour

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
        message: 'Too many verification email requests. Please try again later.',
        retryAfter,
      },
    });
  }

  next();
};

/**
 * Reset rate limit counter on successful login
 * Call this after successful authentication
 */
const resetLoginAttempts = (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  const key = `login:${ip}`;
  rateLimitStore.reset(key);
};

module.exports = {
  loginRateLimiter,
  registerRateLimiter,
  passwordResetRateLimiter,
  verificationResendRateLimiter,
  resetLoginAttempts,
};
