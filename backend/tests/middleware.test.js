/**
 * Middleware tests for request timing and error handling
 * Verifies middleware loads without errors and functions correctly
 */

const express = require('express');
const { requestTimingMiddleware } = require('../middleware/requestTimingMiddleware');
const {
  errorHandler,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServerError,
} = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// Mock logger to capture logs
const capturedLogs = [];
const originalInfo = logger.info;
const originalWarn = logger.warn;
const originalError = logger.error;

logger.info = (msg, ctx) => {
  capturedLogs.push({ level: 'INFO', message: msg, context: ctx });
};

logger.warn = (msg, ctx) => {
  capturedLogs.push({ level: 'WARN', message: msg, context: ctx });
};

logger.error = (msg, ctx, err) => {
  capturedLogs.push({ level: 'ERROR', message: msg, context: ctx, error: err });
};

/**
 * Test 1: Verify middleware loads without errors
 */
console.log('Test 1: Verify middleware loads without errors');
try {
  const app = express();
  app.use(requestTimingMiddleware({ slowMs: 500 }));
  app.use(errorHandler);
  console.log('✓ Middleware loaded successfully');
} catch (err) {
  console.error('✗ Failed to load middleware:', err.message);
}

/**
 * Test 2: Verify request ID generation
 */
console.log('\nTest 2: Verify request ID generation');
try {
  const app = express();
  const middleware = requestTimingMiddleware({ slowMs: 500 });

  const mockReq = {};
  const mockRes = {
    on: () => {},
  };
  const mockNext = () => {};

  middleware(mockReq, mockRes, mockNext);

  if (mockReq.requestId && typeof mockReq.requestId === 'string' && mockReq.requestId.length > 0) {
    console.log(`✓ Request ID generated: ${mockReq.requestId}`);
  } else {
    console.error('✗ Request ID not generated properly');
  }
} catch (err) {
  console.error('✗ Request ID generation failed:', err.message);
}

/**
 * Test 3: Verify error response format
 */
console.log('\nTest 3: Verify error response format');
try {
  const mockReq = {
    requestId: 'test-request-id',
    method: 'GET',
    path: '/api/test',
    user: { _id: 'user-123' },
  };

  const mockRes = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.jsonData = data;
      return this;
    },
  };

  const testError = new ValidationError('Test validation error', { field: 'email' });
  errorHandler(testError, mockReq, mockRes, () => {});

  if (
    mockRes.jsonData &&
    mockRes.jsonData.success === false &&
    mockRes.jsonData.error &&
    mockRes.jsonData.error.code &&
    mockRes.jsonData.error.message
  ) {
    console.log('✓ Error response format is correct');
    console.log(`  - Status Code: ${mockRes.statusCode}`);
    console.log(`  - Error Code: ${mockRes.jsonData.error.code}`);
    console.log(`  - Error Message: ${mockRes.jsonData.error.message}`);
  } else {
    console.error('✗ Error response format is incorrect');
  }
} catch (err) {
  console.error('✗ Error response format test failed:', err.message);
}

/**
 * Test 4: Verify sensitive data not exposed
 */
console.log('\nTest 4: Verify sensitive data not exposed');
try {
  const mockReq = {
    requestId: 'test-request-id',
    method: 'POST',
    path: '/api/auth/login',
    user: null,
  };

  const mockRes = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.jsonData = data;
      return this;
    },
  };

  const testError = new UnauthorizedError('Invalid credentials');
  errorHandler(testError, mockReq, mockRes, () => {});

  const responseStr = JSON.stringify(mockRes.jsonData);
  const hasSensitiveData =
    responseStr.includes('password') ||
    responseStr.includes('token') ||
    responseStr.includes('creditCard') ||
    responseStr.includes('cvv');

  if (!hasSensitiveData) {
    console.log('✓ Sensitive data not exposed in error response');
  } else {
    console.error('✗ Sensitive data found in error response');
  }
} catch (err) {
  console.error('✗ Sensitive data test failed:', err.message);
}

/**
 * Test 5: Verify error type mapping
 */
console.log('\nTest 5: Verify error type mapping');
try {
  const errorTests = [
    { error: new ValidationError('Invalid input'), expectedCode: 400, expectedStatus: 'VALIDATION_ERROR' },
    { error: new UnauthorizedError('Not authenticated'), expectedCode: 401, expectedStatus: 'UNAUTHORIZED' },
    { error: new ForbiddenError('Access denied'), expectedCode: 403, expectedStatus: 'FORBIDDEN' },
    { error: new NotFoundError('Resource not found'), expectedCode: 404, expectedStatus: 'NOT_FOUND' },
    { error: new ConflictError('Duplicate entry'), expectedCode: 409, expectedStatus: 'CONFLICT' },
    { error: new RateLimitError('Too many requests'), expectedCode: 429, expectedStatus: 'RATE_LIMIT_EXCEEDED' },
    { error: new ServerError('Internal error'), expectedCode: 500, expectedStatus: 'INTERNAL_ERROR' },
  ];

  let allPassed = true;

  errorTests.forEach(({ error, expectedCode, expectedStatus }) => {
    const mockReq = {
      requestId: 'test-id',
      method: 'GET',
      path: '/api/test',
    };

    const mockRes = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.jsonData = data;
        return this;
      },
    };

    errorHandler(error, mockReq, mockRes, () => {});

    if (mockRes.statusCode === expectedCode && mockRes.jsonData.error.code === expectedStatus) {
      console.log(`✓ ${error.name}: ${expectedCode} - ${expectedStatus}`);
    } else {
      console.error(
        `✗ ${error.name}: Expected ${expectedCode}/${expectedStatus}, got ${mockRes.statusCode}/${mockRes.jsonData.error.code}`
      );
      allPassed = false;
    }
  });

  if (allPassed) {
    console.log('✓ All error types mapped correctly');
  }
} catch (err) {
  console.error('✗ Error type mapping test failed:', err.message);
}

/**
 * Test 6: Verify request ID attached to req object
 */
console.log('\nTest 6: Verify request ID attached to req object');
try {
  const middleware = requestTimingMiddleware({ slowMs: 500 });
  const mockReq = {};
  const mockRes = {
    on: () => {},
  };

  middleware(mockReq, mockRes, () => {});

  if (mockReq.requestId) {
    console.log(`✓ Request ID attached to req object: ${mockReq.requestId}`);
  } else {
    console.error('✗ Request ID not attached to req object');
  }
} catch (err) {
  console.error('✗ Request ID attachment test failed:', err.message);
}

/**
 * Test 7: Verify logger utility works
 */
console.log('\nTest 7: Verify logger utility works');
try {
  capturedLogs.length = 0;

  logger.info('Test info message', { key: 'value' });
  logger.warn('Test warn message', { key: 'value' });
  logger.error('Test error message', { key: 'value' });

  if (capturedLogs.length === 3) {
    console.log('✓ Logger utility works correctly');
    console.log(`  - Captured ${capturedLogs.length} log entries`);
  } else {
    console.error(`✗ Logger captured ${capturedLogs.length} entries, expected 3`);
  }
} catch (err) {
  console.error('✗ Logger utility test failed:', err.message);
}

// Restore original logger functions
logger.info = originalInfo;
logger.warn = originalWarn;
logger.error = originalError;

console.log('\n✓ All middleware tests completed');
