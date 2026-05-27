# Implementation Plan: Security Fixes Phase 2-3

## Overview

This implementation plan breaks down 24 security requirements into 45 specific coding tasks organized into 6 phases. Each task is production-ready and builds incrementally on previous tasks. All code uses the simple MERN stack with in-memory storage patterns.

**Implementation Approach:**
- Phase 1: Foundation (middleware setup, database indexes)
- Phase 2: Core Security (CSRF, rate limiting, input validation)
- Phase 3: Audit & Logging (audit logs, request logging)
- Phase 4: API Enhancement (versioning, pagination, documentation)
- Phase 5: Frontend Security (IDOR prevention, redirects, response validation)
- Phase 6: Advanced Security (encryption, email verification, password reset)

---

## Phase 1: Foundation Tasks

### 1. Database Indexes and Schema Updates

- [x] 1.1 Create audit log model with TTL index
  - Create `backend/models/auditLogModel.js`
  - Define schema: userId, action, resource, resourceId, details, createdAt
  - Add indexes: (userId, createdAt), (action, createdAt), TTL on createdAt (90 days)
  - _Requirements: 5, 6_

- [x] 1.2 Add indexes to User model
  - Add unique index on email field
  - Add indexes on emailVerificationToken, passwordResetToken
  - _Requirements: 5_

- [x] 1.3 Add indexes to Order model
  - Add compound index on (user, createdAt) for order history
  - Add index on (status, createdAt) for status filtering
  - Add index on (isPaid, createdAt) for payment status
  - _Requirements: 5, 8_

- [x] 1.4 Update User model with new security fields
  - Add emailVerified, emailVerificationToken, emailVerificationExpiry
  - Add passwordResetToken, passwordResetExpiry
  - Add isBlocked, lastLogout fields
  - Add loginAttempts, lockUntil fields
  - _Requirements: 18, 19, 20_

- [x] 1.5 Create encryption utility module
  - Create `backend/utils/encryptionUtil.js`
  - Implement encrypt() function using AES-256-GCM
  - Implement decrypt() function with auth tag verification
  - Export functions for use in models
  - _Requirements: 15_

### 2. In-Memory Storage Initialization

- [x] 2.1 Create rate limit store module
  - Create `backend/utils/rateLimitStore.js`
  - Implement Map-based storage for rate limit counters
  - Implement cleanup interval (every 5 minutes)
  - Export functions: increment(), check(), reset()
  - _Requirements: 2, 3_

- [x] 2.2 Create CSRF token store module
  - Create `backend/utils/csrfTokenStore.js`
  - Implement Map-based storage for CSRF tokens
  - Implement cleanup interval (every 24 hours)
  - Export functions: generate(), validate(), revoke()
  - _Requirements: 1_

- [x] 2.3 Enhance token blacklist in auth middleware
  - Update `backend/middleware/authMiddleware.js`
  - Implement automatic cleanup of expired tokens (every 5 minutes)
  - Add cleanup function that checks token expiration
  - Export tokenBlacklist for use in logout
  - _Requirements: 16_

### 3. Middleware Setup

- [x] 3.1 Create request timing middleware
  - Create `backend/middleware/requestTimingMiddleware.js` (if not exists)
  - Log slow requests (>500ms) for performance monitoring
  - Include request ID for tracing
  - _Requirements: 22_

- [x] 3.2 Create centralized error handler
  - Create `backend/middleware/errorMiddleware.js` (if not exists)
  - Implement consistent error response format
  - Log errors with context (user ID, request ID, timestamp)
  - Never expose sensitive data in error messages
  - _Requirements: 22_

---

## Phase 2: Core Security Middleware

### 4. CSRF Protection Implementation

- [x] 4.1 Create CSRF protection middleware
  - Create `backend/middleware/csrfMiddleware.js`
  - Generate CSRF token using crypto.randomBytes(32)
  - Store token in csrfTokenStore with session ID
  - Validate token on POST/PUT/DELETE requests
  - Skip validation for GET requests
  - Return 403 Forbidden if token invalid/missing
  - _Requirements: 1_

- [x] 4.2 Add CSRF token to form responses
  - Update `backend/controllers/authController.js`
  - Generate CSRF token on login page request
  - Include token in response headers (X-CSRF-Token)
  - Set SameSite=Strict cookie
  - _Requirements: 1_

- [x] 4.3 Integrate CSRF middleware into server
  - Update `backend/server.js`
  - Add csrfMiddleware after cookieParser
  - Apply to all routes except GET and webhooks
  - _Requirements: 1_

### 5. Rate Limiting Implementation

- [x] 5.1 Create authentication rate limiter
  - Create `backend/middleware/authRateLimiter.js`
  - Implement 5 failed attempts per 15 minutes per IP for login
  - Implement 3 attempts per hour per IP for registration
  - Track by IP address for unauthenticated requests
  - Return 429 Too Many Requests with Retry-After header
  - _Requirements: 2_

- [x] 5.2 Create payment rate limiter
  - Create `backend/middleware/paymentRateLimiter.js`
  - Implement 3 attempts per minute per user for payment
  - Implement 10 webhooks per minute per merchant
  - Implement 1 attempt per 5 minutes for transactions >$1000
  - Track by user ID for authenticated requests
  - _Requirements: 3_

- [x] 5.3 Integrate rate limiters into routes
  - Update `backend/routes/authRoutes.js`
  - Apply authRateLimiter to POST /login and POST /register
  - Update `backend/routes/paymentRoutes.js`
  - Apply paymentRateLimiter to POST /initiate and webhook endpoint
  - _Requirements: 2, 3_

- [x] 5.4 Add rate limit headers to responses
  - Update rate limiter middleware
  - Include X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  - Include Retry-After header on 429 responses
  - _Requirements: 2, 3_

### 6. Input Validation Implementation

- [x] 6.1 Create input validation middleware
  - Create `backend/middleware/inputValidationMiddleware.js`
  - Implement validation for query parameters (page, limit, status, dateRange, sortBy, search)
  - Implement validation for body parameters (email, password, phone, amount, productId)
  - Use express-validator for validation
  - Sanitize all string inputs (trim, escape)
  - _Requirements: 4_

- [x] 6.2 Add validation to order endpoints
  - Update `backend/routes/orderRoutes.js`
  - Add validation for GET /orders query parameters
  - Validate page (1-1000), limit (1-100), status (enum), dateRange (enum)
  - Return 400 Bad Request with specific error messages
  - _Requirements: 4, 8_

- [x] 6.3 Add validation to product endpoints
  - Update `backend/routes/productRoutes.js`
  - Add validation for GET /products query parameters
  - Validate search (max 100 chars), sortBy (enum), limit (1-100)
  - _Requirements: 4_

- [x] 6.4 Add validation to payment endpoints
  - Update `backend/routes/paymentRoutes.js`
  - Add validation for POST /initiate body (amount, productId, paymentMethod)
  - Validate amount (positive, max 999999)
  - _Requirements: 4_

---

## Phase 3: Audit & Logging

### 7. Audit Logging System

- [x] 7.1 Create audit logging utility
  - Create `backend/utils/auditLogger.js`
  - Implement logLogin() - record login attempts with status
  - Implement logPayment() - record payment details
  - Implement logAdminAction() - record admin create/update/delete
  - Implement logPasswordChange() - record password changes
  - Implement logAccountStatus() - record block/suspend actions
  - _Requirements: 6_

- [x] 7.2 Integrate audit logging into auth controller
  - Update `backend/controllers/authController.js`
  - Call auditLogger.logLogin() on login attempt (success/failure)
  - Call auditLogger.logPasswordChange() on password change
  - Include IP address, user agent, timestamp
  - _Requirements: 6_

- [x] 7.3 Integrate audit logging into payment controller
  - Update `backend/controllers/paymentController.js`
  - Call auditLogger.logPayment() on payment processing
  - Include payment amount, method, status
  - _Requirements: 6_

- [x] 7.4 Integrate audit logging into admin controller
  - Update `backend/controllers/adminController.js`
  - Call auditLogger.logAdminAction() on product create/update/delete
  - Call auditLogger.logAccountStatus() on user block/suspend
  - Include before/after values for updates
  - _Requirements: 6_

### 8. Request/Response Logging

- [x] 8.1 Create request logging middleware
  - Create `backend/middleware/requestLoggingMiddleware.js`
  - Use Morgan middleware with custom format
  - Log: method, path, IP address, user ID, status code, response time
  - Exclude sensitive data (passwords, tokens, credit cards)
  - Mask email addresses and phone numbers
  - _Requirements: 22_

- [x] 8.2 Integrate request logging into server
  - Update `backend/server.js`
  - Add requestLoggingMiddleware after helmet
  - Configure Morgan format for production
  - _Requirements: 22_

- [x] 8.3 Create log rotation utility
  - Create `backend/utils/logRotation.js`
  - Implement daily log rotation
  - Implement 30-day retention policy
  - _Requirements: 22_

---

## Phase 4: API Enhancement

### 9. API Versioning Implementation

- [x] 9.1 Update all routes with /api/v1/ prefix
  - Update `backend/server.js`
  - Change all route mounts to /api/v1/auth, /api/v1/products, etc.
  - Update route files to remove /api prefix
  - _Requirements: 7_

- [x] 9.2 Add API version header middleware
  - Create `backend/middleware/apiVersionMiddleware.js`
  - Add X-API-Version: 1.0 to all responses
  - _Requirements: 7_

- [x] 9.3 Create API documentation with Swagger
  - Create `backend/swagger.js`
  - Define Swagger/OpenAPI spec for all endpoints
  - Include request/response schemas
  - Include authentication requirements
  - Include example requests/responses
  - _Requirements: 24_

- [x] 9.4 Add Swagger UI endpoint
  - Install swagger-ui-express
  - Add GET /api-docs endpoint
  - Serve Swagger UI with API documentation
  - _Requirements: 24_

### 10. Pagination Implementation

- [x] 10.1 Create pagination utility
  - Create `backend/utils/paginationUtil.js`
  - Implement calculatePagination() - calculate skip and limit
  - Implement formatPaginatedResponse() - format response with metadata
  - _Requirements: 8_

- [x] 10.2 Update order list endpoint with pagination
  - Update `backend/controllers/orderController.js`
  - Implement GET /orders with page and limit parameters
  - Return response with data, page, limit, total, totalPages
  - Validate page and limit parameters
  - _Requirements: 8_

- [x] 10.3 Update product list endpoint with pagination
  - Update `backend/controllers/productController.js`
  - Implement GET /products with page and limit parameters
  - Return response with data, page, limit, total, totalPages
  - _Requirements: 8_

- [x] 10.4 Add filtering to order endpoint
  - Update `backend/controllers/orderController.js`
  - Add status filtering (pending, completed, cancelled, processing, shipped, delivered)
  - Add date range filtering (7d, 30d, 90d)
  - Add sorting by createdAt, price, rating
  - _Requirements: 8_

### 11. Security Headers Implementation

- [x] 11.1 Configure Content Security Policy
  - Update `backend/server.js`
  - Add helmet CSP configuration
  - Set default-src 'self'
  - Set script-src 'self' + trusted CDNs
  - Set style-src 'self' 'unsafe-inline'
  - Set img-src 'self' https: data:
  - Set frame-ancestors 'none'
  - _Requirements: 9_

- [x] 11.2 Configure HSTS headers
  - Update `backend/server.js`
  - Add helmet HSTS configuration
  - Set max-age=31536000 (1 year)
  - Include includeSubDomains directive
  - Include preload directive
  - _Requirements: 10_

- [x] 11.3 Add HTTP to HTTPS redirect
  - Update `backend/server.js`
  - Add middleware to redirect HTTP to HTTPS
  - Use 301 permanent redirect
  - _Requirements: 10_

- [x] 11.4 Add CSP violation logging
  - Create `backend/middleware/cspViolationMiddleware.js`
  - Add endpoint to receive CSP violation reports
  - Log violations for security monitoring
  - _Requirements: 9_

---

## Phase 5: Frontend Security

### 12. File Upload Validation

- [x] 12.1 Create file upload validator
  - Create `backend/utils/fileUploadValidator.js`
  - Implement validateFileType() - check magic bytes (jpeg, png, webp only)
  - Implement validateFileSize() - enforce 5MB limit
  - Implement scanForMalicious() - basic malware scanning
  - _Requirements: 11_

- [x] 12.2 Update upload middleware
  - Update `backend/middleware/uploadMiddleware.js`
  - Integrate file upload validator
  - Return 400 Bad Request for invalid file type
  - Return 413 Payload Too Large for oversized files
  - Store files outside web root
  - Sanitize file names to prevent path traversal
  - _Requirements: 11_

- [x] 12.3 Add file upload validation to product routes
  - Update `backend/routes/productRoutes.js`
  - Apply file upload validation to POST /products and PUT /products/:id
  - _Requirements: 11_

### 13. Frontend IDOR Prevention

- [x] 13.1 Add ownership verification to order endpoints
  - Update `backend/controllers/orderController.js`
  - Verify order belongs to current user before returning
  - Return 403 Forbidden if order doesn't belong to user
  - _Requirements: 12_

- [x] 13.2 Add ownership verification to user profile endpoint
  - Update `backend/controllers/userController.js`
  - Verify profile belongs to current user before returning
  - Return 403 Forbidden if profile doesn't belong to user
  - _Requirements: 12_

- [x] 13.3 Create frontend IDOR prevention component
  - Create `Frontend/utils/idorPrevention.js`
  - Implement verifyResourceOwnership() - check response contains expected user ID
  - Implement handleAccessDenied() - redirect to safe page on 403
  - _Requirements: 12_

- [x] 13.4 Add IDOR prevention to frontend order page
  - Update `Frontend/app/orders/[id]/page.js`
  - Verify order belongs to current user before displaying
  - Redirect to /orders if access denied
  - _Requirements: 12_

### 14. Unvalidated Redirect Prevention

- [x] 14.1 Create redirect validation utility
  - Create `Frontend/utils/redirectValidation.js`
  - Implement ALLOWED_REDIRECTS whitelist
  - Implement validateRedirect() - check URL against whitelist
  - _Requirements: 13_

- [x] 14.2 Add redirect validation to auth flow
  - Update `Frontend/app/auth/page.js`
  - Validate redirect parameter before redirecting
  - Use relative paths instead of absolute URLs
  - _Requirements: 13_

- [x] 14.3 Add redirect validation to checkout flow
  - Update `Frontend/app/checkout/page.js`
  - Validate redirect after successful payment
  - _Requirements: 13_

### 15. API Response Validation

- [x] 15.1 Create response validation schemas
  - Create `Frontend/utils/responseSchemas.js`
  - Define Zod schemas for all API responses
  - Include Order, Product, User, Payment schemas
  - _Requirements: 14_

- [x] 15.2 Create response validator utility
  - Create `Frontend/utils/responseValidator.js`
  - Implement validateResponse() - validate against schema
  - Implement handleValidationError() - log and display fallback UI
  - _Requirements: 14_

- [x] 15.3 Add response validation to API client
  - Update `Frontend/utils/apiClient.js`
  - Validate all API responses before using
  - Log validation errors for debugging
  - _Requirements: 14_

---

## Phase 6: Advanced Security

### 16. Encryption at Rest

- [x] 16.1 Add encryption to User model
  - Update `backend/models/userModel.js`
  - Add pre-save hook to encrypt phone and addresses
  - Add post-find hook to decrypt phone and addresses
  - Use encryptionUtil for encryption/decryption
  - _Requirements: 15_

- [x] 16.2 Test encryption/decryption
  - Create test script to verify encryption works
  - Verify encrypted data stored in database
  - Verify decrypted data matches original
  - _Requirements: 15_

### 17. Email Verification System

- [x] 17.1 Create email verification utility
  - Create `backend/utils/emailVerificationUtil.js`
  - Implement generateVerificationToken() - create 32-byte random token
  - Implement sendVerificationEmail() - send email with verification link
  - Implement verifyEmail() - mark email as verified
  - _Requirements: 19_

- [x] 17.2 Add email verification to registration
  - Update `backend/controllers/authController.js`
  - Generate verification token on registration
  - Send verification email
  - Require email verification before checkout (optional)
  - _Requirements: 19_

- [x] 17.3 Create email verification endpoint
  - Update `backend/routes/authRoutes.js`
  - Add GET /verify-email/:token endpoint
  - Verify token and mark email as verified
  - Return 400 Bad Request if token invalid/expired
  - _Requirements: 19_

- [x] 17.4 Create resend verification email endpoint
  - Update `backend/routes/authRoutes.js`
  - Add POST /resend-verification endpoint
  - Rate limit to 3 attempts per hour
  - _Requirements: 19_

### 18. Password Reset Flow

- [x] 18.1 Create password reset utility
  - Create `backend/utils/passwordResetUtil.js`
  - Implement generateResetToken() - create 32-byte random token
  - Implement sendResetEmail() - send email with reset link
  - Implement resetPassword() - update password and invalidate tokens
  - _Requirements: 20_

- [x] 18.2 Create forgot password endpoint
  - Update `backend/routes/authRoutes.js`
  - Add POST /forgot-password endpoint
  - Generate reset token and send email
  - Rate limit to 3 attempts per hour
  - _Requirements: 20_

- [x] 18.3 Create reset password endpoint
  - Update `backend/routes/authRoutes.js`
  - Add POST /reset-password/:token endpoint
  - Verify token and update password
  - Invalidate all active tokens for user
  - Return 400 Bad Request if token invalid/expired
  - _Requirements: 20_

### 19. Account Status Checks

- [x] 19.1 Enhance auth middleware with account status checks
  - Update `backend/middleware/authMiddleware.js`
  - Check if user is blocked/suspended
  - Check if user still exists
  - Check if email is verified (optional restriction)
  - Return 403 Forbidden if account suspended
  - _Requirements: 18_

- [x] 19.2 Add account blocking endpoint
  - Update `backend/routes/adminRoutes.js`
  - Add POST /users/:id/block endpoint (admin only)
  - Revoke all active tokens for user
  - Log action in audit log
  - _Requirements: 18_

- [x] 19.3 Add account unblocking endpoint
  - Update `backend/routes/adminRoutes.js`
  - Add POST /users/:id/unblock endpoint (admin only)
  - Log action in audit log
  - _Requirements: 18_

### 20. Webhook Signature Verification

- [x] 20.1 Create webhook verification utility
  - Create `backend/utils/webhookVerificationUtil.js`
  - Implement verifySignature() - verify HMAC-SHA256 signature
  - Implement verifyTimestamp() - check timestamp within 5 minutes
  - Implement checkDuplicate() - prevent duplicate webhook processing
  - _Requirements: 17_

- [x] 20.2 Update payment webhook handler
  - Update `backend/controllers/paymentController.js`
  - Verify webhook signature before processing
  - Verify timestamp to prevent replay attacks
  - Check for duplicate webhook ID
  - Return 401 Unauthorized if signature invalid
  - Return 400 Bad Request if timestamp outside window
  - _Requirements: 17_

- [x] 20.3 Create webhook event model
  - Create `backend/models/webhookEventModel.js` (if not exists)
  - Store webhook ID, timestamp, status
  - Add index on webhookId for duplicate detection
  - _Requirements: 17_

### 21. Request Timeout Configuration

- [x] 21.1 Create request timeout middleware
  - Create `backend/middleware/requestTimeoutMiddleware.js`
  - Set 5-second timeout for external API calls
  - Set 10-second timeout for critical operations
  - Return 504 Gateway Timeout on timeout
  - Log timeout for monitoring
  - _Requirements: 21_

- [x] 21.2 Add timeout to payment controller
  - Update `backend/controllers/paymentController.js`
  - Apply 5-second timeout to Razorpay API calls
  - Handle timeout errors gracefully
  - _Requirements: 21_

- [x] 21.3 Add timeout to email controller
  - Update `backend/controllers/emailController.js`
  - Apply 5-second timeout to email sending
  - Handle timeout errors gracefully
  - _Requirements: 21_

### 22. Database Connection Pooling

- [x] 22.1 Configure MongoDB connection pooling
  - Update `backend/config/db.js`
  - Set minPoolSize: 5, maxPoolSize: 10
  - Configure connection timeout and retry logic
  - _Requirements: 23_

- [x] 22.2 Add connection health monitoring
  - Create `backend/utils/connectionMonitor.js`
  - Monitor connection pool health
  - Alert on connection failures
  - _Requirements: 23_

---

## Phase 7: Testing & Verification

### 23. Checkpoint - Foundation & Core Security

- [x] 23.1 Verify all middleware loads without errors
  - Start server and check console output
  - Verify no middleware initialization errors
  - Verify all routes registered
  - _Requirements: 1, 2, 3, 4, 5, 6_

- [x] 23.2 Test CSRF protection
  - Make POST request without CSRF token
  - Verify 403 Forbidden response
  - Make POST request with valid CSRF token
  - Verify request succeeds
  - _Requirements: 1_

- [x] 23.3 Test rate limiting
  - Make 6 login attempts in 15 minutes
  - Verify 429 Too Many Requests on 6th attempt
  - Verify Retry-After header present
  - _Requirements: 2, 3_

- [x] 23.4 Test input validation
  - Make request with invalid query parameters
  - Verify 400 Bad Request with specific error
  - Make request with valid parameters
  - Verify request succeeds
  - _Requirements: 4_

### 24. Checkpoint - Audit & Logging

- [x] 24.1 Verify audit logging
  - Make login request
  - Check audit log in database
  - Verify login recorded with timestamp, IP, status
  - _Requirements: 6_

- [x] 24.2 Verify request logging
  - Make API request
  - Check logs for request details
  - Verify method, path, status, response time logged
  - Verify sensitive data not logged
  - _Requirements: 22_

### 25. Checkpoint - API Enhancement

- [x] 25.1 Verify API versioning
  - Make request to /api/v1/products
  - Verify X-API-Version: 1.0 header present
  - Verify response includes version
  - _Requirements: 7_

- [x] 25.2 Verify pagination
  - Make request to /api/v1/orders?page=1&limit=20
  - Verify response includes data, page, limit, total, totalPages
  - Make request with page=2
  - Verify correct offset applied
  - _Requirements: 8_

- [x] 25.3 Verify Swagger documentation
  - Navigate to /api-docs
  - Verify Swagger UI loads
  - Verify all endpoints documented
  - Verify request/response schemas present
  - _Requirements: 24_

### 26. Checkpoint - Frontend Security

- [x] 26.1 Test IDOR prevention
  - Login as user A
  - Try to access order belonging to user B
  - Verify 403 Forbidden response
  - Verify frontend redirects to /orders
  - _Requirements: 12_

- [x] 26.2 Test redirect validation
  - Try to redirect to external URL
  - Verify redirect blocked
  - Try to redirect to whitelisted URL
  - Verify redirect succeeds
  - _Requirements: 13_

- [x] 26.3 Test response validation
  - Modify API response in browser dev tools
  - Verify frontend detects invalid response
  - Verify fallback UI displayed
  - _Requirements: 14_

### 27. Checkpoint - Advanced Security

- [x] 27.1 Verify encryption at rest
  - Create user with phone number
  - Check database directly
  - Verify phone number encrypted
  - Verify decryption works in application
  - _Requirements: 15_

- [x] 27.2 Test email verification
  - Register new user
  - Verify verification email sent
  - Click verification link
  - Verify email marked as verified
  - _Requirements: 19_

- [x] 27.3 Test password reset
  - Request password reset
  - Verify reset email sent
  - Click reset link
  - Verify password changed
  - Verify old tokens invalidated
  - _Requirements: 20_

- [x] 27.4 Test webhook signature verification
  - Send webhook with invalid signature
  - Verify 401 Unauthorized response
  - Send webhook with valid signature
  - Verify webhook processed
  - _Requirements: 17_

### 28. Final Checkpoint - Production Build

- [x] 28.1 Run production build
  - Execute `npm install`
  - Execute `npm run build` (if applicable)
  - Execute `npm start`
  - Verify server starts without errors
  - _Requirements: All_

- [x] 28.2 Verify all environment variables
  - Check NODE_ENV=production
  - Check MONGODB_URI configured
  - Check JWT_SECRET configured
  - Check ENCRYPTION_KEY configured
  - Check CORS_ORIGINS configured
  - _Requirements: All_

- [x] 28.3 Verify security headers
  - Make HTTPS request to API
  - Verify Content-Security-Policy header
  - Verify Strict-Transport-Security header
  - Verify X-Frame-Options header
  - _Requirements: 9, 10_

- [x] 28.4 Verify error handling
  - Make request that causes error
  - Verify error response format
  - Verify sensitive data not exposed
  - Verify error logged
  - _Requirements: All_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- All code must be production-ready
- No external infrastructure dependencies (Redis, KMS, etc.)
- In-memory storage with automatic cleanup
- Single-server deployment compatible

