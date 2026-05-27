const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Generates a unique request ID using native crypto.
 * Prefers crypto.randomUUID() (Node 14.17+/15+), falls back to randomBytes
 * if randomUUID is unavailable in the runtime.
 *
 * @returns {string} A unique request identifier
 */
const generateRequestId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: 16 random bytes encoded as hex (128 bits of entropy)
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Request timing middleware for performance monitoring.
 *
 * - Generates a unique request ID for tracing (exposed as `req.id`,
 *   with `req.requestId` retained as an alias for backward compatibility).
 * - Sets the `X-Request-Id` response header so clients/log aggregators can
 *   correlate requests.
 * - Uses `process.hrtime.bigint()` for high-precision timing.
 * - Logs slow requests (>= slowMs, default 500ms) on the `finish` event with
 *   method, path, status code, duration in ms, and request id.
 *
 * @param {object} [options] - Configuration options
 * @param {number} [options.slowMs=500] - Threshold in milliseconds for slow request logging
 * @returns {function} Express middleware function
 */
const requestTimingMiddleware = (options = {}) => {
  const enabled = String(process.env.LOG_REQUESTS || '').toLowerCase() === 'true';
  const slowMs = Number(process.env.LOG_SLOW_REQUEST_MS || options.slowMs || 500);

  return (req, res, next) => {
    // Generate unique request ID for tracing
    const requestId = generateRequestId();
    req.id = requestId;
    // Maintain backward compatibility with existing middleware/tests that read req.requestId
    req.requestId = requestId;

    // Expose the request ID to clients and downstream services
    res.setHeader('X-Request-Id', requestId);

    // Record start time using high-resolution timer
    const start = process.hrtime.bigint();

    // Listen for response finish event to calculate timing
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      const isSlow = durationMs >= slowMs;

      // Only log if verbose logging is enabled or if the request is slow
      if (enabled || isSlow) {
        const logData = {
          requestId,
          method: req.method,
          path: req.originalUrl || req.url,
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs),
        };

        if (isSlow) {
          logger.warn('Slow request detected', logData);
        } else {
          logger.info('Request completed', logData);
        }
      }
    });

    next();
  };
};

module.exports = { requestTimingMiddleware, generateRequestId };
