/**
 * Request Timeout Middleware
 * Sets timeout for external API calls and critical operations
 */

/**
 * Create timeout middleware for specific routes
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Function} Express middleware
 */
const createTimeoutMiddleware = (timeoutMs = 5000) => {
  return (req, res, next) => {
    // Set timeout for the request
    req.setTimeout(timeoutMs);
    
    // Handle timeout
    req.on('timeout', () => {
      res.status(504).json({
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timeout - operation took too long',
        },
      });
    });
    
    next();
  };
};

/**
 * Timeout middleware for external API calls (5 seconds)
 */
const externalApiTimeout = createTimeoutMiddleware(5000);

/**
 * Timeout middleware for critical operations (10 seconds)
 */
const criticalOperationTimeout = createTimeoutMiddleware(10000);

/**
 * Timeout middleware for payment operations (5 seconds)
 */
const paymentTimeout = createTimeoutMiddleware(5000);

/**
 * Timeout middleware for email operations (5 seconds)
 */
const emailTimeout = createTimeoutMiddleware(5000);

module.exports = {
  createTimeoutMiddleware,
  externalApiTimeout,
  criticalOperationTimeout,
  paymentTimeout,
  emailTimeout,
};
