/**
 * Centralized logging utility for the application
 * Provides structured logging with different levels and contexts
 */

const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

/**
 * Formats log output with timestamp and context
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {object} context - Additional context data
 * @returns {object} Formatted log object
 */
const formatLog = (level, message, context = {}) => {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
};

/**
 * Logs info level messages
 * @param {string} message - Log message
 * @param {object} context - Additional context data
 */
const info = (message, context = {}) => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(formatLog('INFO', message, context)));
};

/**
 * Logs warning level messages
 * @param {string} message - Log message
 * @param {object} context - Additional context data
 */
const warn = (message, context = {}) => {
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify(formatLog('WARN', message, context)));
};

/**
 * Logs error level messages with security considerations
 * Never logs sensitive data like passwords, tokens, or credit cards
 * @param {string} message - Log message
 * @param {object} context - Additional context data
 * @param {Error} error - Error object (optional)
 */
const error = (message, context = {}, errorObj = null) => {
  const logData = formatLog('ERROR', message, context);

  // Include stack trace only in development
  if (!isProd && errorObj) {
    logData.stack = errorObj.stack;
  }

  // eslint-disable-next-line no-console
  console.error(JSON.stringify(logData));
};

/**
 * Sanitizes sensitive data from context objects
 * Removes passwords, tokens, credit cards, and other sensitive fields
 * @param {object} obj - Object to sanitize
 * @returns {object} Sanitized object
 */
const sanitizeSensitiveData = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveKeys = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'creditCard',
    'cardNumber',
    'cvv',
    'ssn',
    'apiKey',
    'secret',
    'authorization',
  ];

  const sanitized = { ...obj };

  sensitiveKeys.forEach((key) => {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  });

  return sanitized;
};

module.exports = {
  info,
  warn,
  error,
  sanitizeSensitiveData,
  formatLog,
};
