/**
 * Pagination Utility
 * Provides helper functions for pagination and response formatting
 */

/**
 * Calculate pagination parameters (skip and limit)
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Object} { skip: number, limit: number }
 */
const calculatePagination = (page = 1, limit = 20) => {
  // Validate inputs
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20));
  
  // Calculate skip
  const skip = (pageNum - 1) * limitNum;
  
  return {
    skip,
    limit: limitNum,
    page: pageNum,
  };
};

/**
 * Format paginated response
 * @param {Array} data - Array of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Formatted response with pagination metadata
 */
const formatPaginatedResponse = (data, page, limit, total) => {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20));
  const totalPages = Math.ceil(total / limitNum);
  
  return {
    success: true,
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
    },
  };
};

/**
 * Format simple paginated response (without pagination object)
 * @param {Array} data - Array of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Formatted response with inline pagination fields
 */
const formatSimplePaginatedResponse = (data, page, limit, total) => {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 20));
  const totalPages = Math.ceil(total / limitNum);
  
  return {
    success: true,
    data,
    page: pageNum,
    limit: limitNum,
    total,
    totalPages,
  };
};

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} { isValid: boolean, errors: Array }
 */
const validatePaginationParams = (page, limit) => {
  const errors = [];
  
  if (page !== undefined) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > 1000) {
      errors.push('Page must be an integer between 1 and 1000');
    }
  }
  
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('Limit must be an integer between 1 and 100');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  calculatePagination,
  formatPaginatedResponse,
  formatSimplePaginatedResponse,
  validatePaginationParams,
};
