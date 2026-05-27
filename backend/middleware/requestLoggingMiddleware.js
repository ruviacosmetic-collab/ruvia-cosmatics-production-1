const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

/**
 * Request Logging Middleware
 * Logs HTTP requests with sensitive data protection
 */

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom token to mask sensitive data
 */
morgan.token('masked-body', (req) => {
  if (!req.body) return '';
  
  const body = JSON.stringify(req.body);
  
  // Mask passwords
  let masked = body.replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"***"');
  
  // Mask tokens
  masked = masked.replace(/"token"\s*:\s*"[^"]*"/gi, '"token":"***"');
  masked = masked.replace(/"_csrf"\s*:\s*"[^"]*"/gi, '"_csrf":"***"');
  
  // Mask credit card numbers
  masked = masked.replace(/"cardNumber"\s*:\s*"[^"]*"/gi, '"cardNumber":"***"');
  
  // Mask API keys
  masked = masked.replace(/"apiKey"\s*:\s*"[^"]*"/gi, '"apiKey":"***"');
  
  return masked;
});

/**
 * Custom token to mask email addresses
 */
morgan.token('masked-email', (req) => {
  if (!req.body || !req.body.email) return '';
  
  const email = req.body.email;
  if (email.length <= 3) return '***';
  
  const [localPart, domain] = email.split('@');
  const masked = localPart.substring(0, 3) + '***';
  
  return domain ? `${masked}@${domain}` : masked;
});

/**
 * Custom token to get user ID
 */
morgan.token('user-id', (req) => {
  return req.user ? req.user._id : 'anonymous';
});

/**
 * Custom token to get request ID
 */
morgan.token('request-id', (req) => {
  return req.requestId || 'no-id';
});

/**
 * Development format: concise, colorful
 */
const devFormat = ':request-id :user-id :method :url :status :response-time ms';

/**
 * Production format: detailed, structured
 */
const prodFormat = ':request-id :user-id :method :url :status :response-time ms - :res[content-length] bytes';

/**
 * Create request logging middleware
 * @param {Object} options - Configuration options
 * @param {string} options.env - Environment (development or production)
 * @returns {Function} Express middleware
 */
const createRequestLogger = (options = {}) => {
  const env = options.env || process.env.NODE_ENV || 'development';
  
  if (env === 'production') {
    // Production: log to file with rotation
    const accessLogStream = fs.createWriteStream(
      path.join(logsDir, 'access.log'),
      { flags: 'a' }
    );
    
    return morgan(prodFormat, {
      stream: accessLogStream,
      skip: (req) => {
        // Skip health check endpoints
        if (req.path === '/health' || req.path === '/') {
          return true;
        }
        return false;
      },
    });
  } else {
    // Development: log to console
    return morgan(devFormat, {
      skip: (req) => {
        // Skip health check endpoints
        if (req.path === '/health' || req.path === '/') {
          return true;
        }
        return false;
      },
    });
  }
};

/**
 * Error logging middleware
 * Logs errors with context
 */
const errorLogger = (err, req, res, next) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    userId: req.user ? req.user._id : 'anonymous',
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    errorMessage: err.message,
    errorCode: err.code,
    errorName: err.name,
  };
  
  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('ERROR:', JSON.stringify(errorLog, null, 2));
  } else {
    // Log to file in production
    const errorLogStream = fs.createWriteStream(
      path.join(logsDir, 'error.log'),
      { flags: 'a' }
    );
    errorLogStream.write(JSON.stringify(errorLog) + '\n');
    errorLogStream.end();
  }
  
  next(err);
};

module.exports = {
  createRequestLogger,
  errorLogger,
};
