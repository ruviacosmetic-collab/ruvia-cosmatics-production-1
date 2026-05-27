const sanitize = require('mongo-sanitize');

/**
 * Sanitizes request body, query, and params to prevent NoSQL injection attacks
 * This middleware removes any keys starting with $ in the request data
 */
const sanitizeRequest = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body) {
      req.body = sanitize(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = sanitize(req.query);
    }

    // Sanitize route parameters
    if (req.params) {
      req.params = sanitize(req.params);
    }

    next();
  } catch (error) {
    console.error('Sanitization error:', error);
    res.status(500).json({ message: 'Server error during request sanitization' });
  }
};

module.exports = { sanitizeRequest };
