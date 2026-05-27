const { query, body, param, validationResult } = require('express-validator');

/**
 * Input Validation Middleware
 * Provides reusable validation chains for common parameters
 */

// ============ Query Parameter Validators ============

/**
 * Validate pagination parameters (page, limit)
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be an integer between 1 and 1000'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
];

/**
 * Validate order status filter
 */
const validateOrderStatus = [
  query('status')
    .optional()
    .isIn(['pending', 'completed', 'cancelled', 'processing', 'shipped', 'delivered', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'])
    .withMessage('Invalid order status'),
];

/**
 * Validate date range filter
 */
const validateDateRange = [
  query('dateRange')
    .optional()
    .isIn(['7d', '30d', '90d'])
    .withMessage('Date range must be one of: 7d, 30d, 90d'),
];

/**
 * Validate sort parameter
 */
const validateSortBy = [
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'price', 'rating', '-createdAt', '-price', '-rating'])
    .withMessage('Invalid sort field'),
];

/**
 * Validate search parameter
 */
const validateSearch = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search must be less than 100 characters')
    .matches(/^[a-zA-Z0-9\s\-]*$/)
    .withMessage('Search can only contain alphanumeric characters, spaces, and hyphens'),
];

// ============ Body Parameter Validators ============

/**
 * Validate email format
 */
const validateEmail = [
  body('email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Invalid email format'),
];

/**
 * Validate password (min 8 chars, max 128 chars)
 */
const validatePassword = [
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters'),
];

/**
 * Validate phone number (10-15 digits)
 */
const validatePhone = [
  body('phone')
    .optional()
    .matches(/^\d{10,15}$/)
    .withMessage('Phone must be 10-15 digits'),
];

/**
 * Validate amount (positive number, max 999999)
 */
const validateAmount = [
  body('amount')
    .isFloat({ min: 0.01, max: 999999 })
    .withMessage('Amount must be between 0.01 and 999999'),
];

/**
 * Validate MongoDB ObjectId
 */
const validateObjectId = [
  param('id')
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid ID format'),
];

/**
 * Validate product ID in body
 */
const validateProductId = [
  body('productId')
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid product ID format'),
];

// ============ Validation Result Handler ============

/**
 * Middleware to handle validation errors
 * Must be called after validation chains
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array().map(err => ({
          field: err.param,
          message: err.msg,
          value: err.value,
        })),
      },
    });
  }
  
  next();
};

// ============ Combined Validators ============

/**
 * Validate order list query parameters
 */
const validateOrderListQuery = [
  ...validatePagination,
  ...validateOrderStatus,
  ...validateDateRange,
  ...validateSortBy,
  handleValidationErrors,
];

/**
 * Validate product list query parameters
 */
const validateProductListQuery = [
  ...validatePagination,
  ...validateSearch,
  ...validateSortBy,
  handleValidationErrors,
];

/**
 * Validate payment initiation body
 */
const validatePaymentInitiation = [
  ...validateAmount,
  ...validateProductId,
  body('paymentMethod')
    .isIn(['Razorpay', 'COD', 'UPI'])
    .withMessage('Invalid payment method'),
  handleValidationErrors,
];

/**
 * Validate user registration body
 */
const validateUserRegistration = [
  ...validateEmail,
  ...validatePassword,
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  handleValidationErrors,
];

/**
 * Validate user login body
 */
const validateUserLogin = [
  ...validateEmail,
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];

module.exports = {
  // Individual validators
  validatePagination,
  validateOrderStatus,
  validateDateRange,
  validateSortBy,
  validateSearch,
  validateEmail,
  validatePassword,
  validatePhone,
  validateAmount,
  validateObjectId,
  validateProductId,
  
  // Combined validators
  validateOrderListQuery,
  validateProductListQuery,
  validatePaymentInitiation,
  validateUserRegistration,
  validateUserLogin,
  
  // Handler
  handleValidationErrors,
};
