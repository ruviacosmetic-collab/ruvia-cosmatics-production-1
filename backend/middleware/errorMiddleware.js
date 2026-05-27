const logger = require('../utils/logger');

/**
 * Custom error classes for different error types
 */
class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class RateLimitError extends Error {
  constructor(message = 'Too Many Requests') {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
  }
}

class ServerError extends Error {
  constructor(message = 'Internal Server Error') {
    super(message);
    this.name = 'ServerError';
    this.statusCode = 500;
  }
}

/**
 * Maps error types to HTTP status codes.
 * Falls back to 500 for unknown errors.
 *
 * @param {Error} err - Error object
 * @returns {number} HTTP status code
 */
const getStatusCode = (err) => {
  if (err && typeof err.statusCode === 'number') return err.statusCode;
  if (err && typeof err.status === 'number') return err.status;

  const statusMap = {
    ValidationError: 400,
    UnauthorizedError: 401,
    JsonWebTokenError: 401,
    TokenExpiredError: 401,
    ForbiddenError: 403,
    NotFoundError: 404,
    ConflictError: 409,
    RateLimitError: 429,
    CastError: 400,
    MongoError: 500,
    MongoServerError: 500,
  };

  return statusMap[err && err.name] || 500;
};

/**
 * Returns a user-friendly error message that is safe to send to clients.
 *
 * In production we never echo internal error messages; instead we surface
 * a generic message based on the error type. In development, the original
 * error message is included to make debugging easier.
 *
 * @param {Error} err - Error object
 * @param {boolean} isProd - Whether running in production
 * @returns {string} Error message safe for the client
 */
const getErrorMessage = (err, isProd) => {
  const messageMap = {
    ValidationError: 'Validation failed',
    UnauthorizedError: 'Unauthorized',
    JsonWebTokenError: 'Unauthorized',
    TokenExpiredError: 'Unauthorized',
    ForbiddenError: 'Forbidden',
    NotFoundError: 'Not Found',
    ConflictError: 'Conflict',
    RateLimitError: 'Too Many Requests',
    CastError: 'Invalid request',
    MongoError: 'Internal Server Error',
    MongoServerError: 'Internal Server Error',
  };

  if (isProd) {
    return messageMap[err && err.name] || 'Internal Server Error';
  }

  return (err && err.message) || messageMap[err && err.name] || 'Internal Server Error';
};

/**
 * Returns a stable error code string for API responses so that clients can
 * branch on machine-readable identifiers rather than free-form messages.
 *
 * @param {Error} err - Error object
 * @returns {string} Error code
 */
const getErrorCode = (err) => {
  const codeMap = {
    ValidationError: 'VALIDATION_ERROR',
    UnauthorizedError: 'UNAUTHORIZED',
    JsonWebTokenError: 'UNAUTHORIZED',
    TokenExpiredError: 'UNAUTHORIZED',
    ForbiddenError: 'FORBIDDEN',
    NotFoundError: 'NOT_FOUND',
    ConflictError: 'CONFLICT',
    RateLimitError: 'RATE_LIMIT_EXCEEDED',
    CastError: 'INVALID_REQUEST',
    MongoError: 'DATABASE_ERROR',
    MongoServerError: 'DATABASE_ERROR',
  };

  return codeMap[err && err.name] || (err && err.code) || 'INTERNAL_ERROR';
};

/**
 * 404 Not Found handler.
 *
 * Mount this AFTER all routes (and BEFORE `errorHandler`) so any unmatched
 * request is converted into a NotFoundError that flows through the
 * centralized error handler. This guarantees a consistent response shape
 * for unknown routes.
 *
 * @param {object} req - Express request object
 * @param {object} _res - Express response object (unused)
 * @param {function} next - Express next function
 */
const notFound = (req, _res, next) => {
  next(new NotFoundError(`Not Found - ${req.originalUrl || req.url}`));
};

/**
 * Centralized error handler middleware.
 *
 * Responsibilities:
 *  - Convert any thrown/forwarded error into a consistent JSON response shape
 *    `{ success: false, error: { code, message, details? } }`.
 *  - Log the error with rich context (request id, user id, method, path,
 *    timestamp, status code, error code) using the structured logger. The
 *    full stack is logged but never returned to the client to avoid leaking
 *    internal details.
 *  - Strip sensitive information (passwords, tokens, etc.) by relying on the
 *    generic message map in production.
 *
 * @param {Error} err - Error object
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} _next - Express next function (unused, signature required)
 */
const errorHandler = (err, req, res, _next) => {
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const statusCode = getStatusCode(err);
  const errorMessage = getErrorMessage(err, isProd);
  const errorCode = getErrorCode(err);

  // Build error context for logging. Prefer req.id (set by request timing
  // middleware) and fall back to req.requestId for backward compatibility.
  const requestId = (req && (req.id || req.requestId)) || undefined;
  const userId = (req && req.user && req.user._id) ? String(req.user._id) : 'anonymous';

  const errorContext = {
    requestId,
    userId,
    method: req && req.method,
    path: req && (req.originalUrl || req.path),
    timestamp: new Date().toISOString(),
    statusCode,
    errorCode,
    errorName: err && err.name,
  };

  // Always log the original error message internally; clients only see the
  // sanitized message. The full stack is only relevant to operators.
  if (statusCode >= 500) {
    logger.error((err && err.message) || 'Internal Server Error', errorContext, err);
  } else {
    logger.warn((err && err.message) || errorMessage, errorContext);
  }

  // Build the client response. We intentionally do NOT include the stack
  // trace in any environment to avoid leaking internals. In development we
  // include the original message and any structured `details` to aid
  // debugging.
  const response = {
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
    },
  };

  if (!isProd) {
    if (err && err.details && typeof err.details === 'object') {
      response.error.details = err.details;
    } else if (err && err.message && err.message !== errorMessage) {
      response.error.details = err.message;
    }
  }

  if (requestId) {
    response.error.requestId = requestId;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  errorHandler,
  notFound,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServerError,
};
