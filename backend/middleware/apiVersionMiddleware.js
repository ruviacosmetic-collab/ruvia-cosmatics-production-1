/**
 * API Version Middleware
 * Adds API version header to all responses
 */

const API_VERSION = '1.0';

/**
 * Middleware to add API version header to responses
 */
const apiVersionMiddleware = (req, res, next) => {
  // Add API version header to response
  res.setHeader('X-API-Version', API_VERSION);
  
  // Store version in request for use in controllers
  req.apiVersion = API_VERSION;
  
  next();
};

module.exports = {
  apiVersionMiddleware,
  API_VERSION,
};
