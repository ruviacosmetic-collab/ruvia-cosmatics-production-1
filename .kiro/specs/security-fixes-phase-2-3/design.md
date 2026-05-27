# Design Document: Security Fixes Phase 2-3

## Overview

This design implements 24 security requirements for Ruvia Cosmetics using a simple MERN stack (Express, MongoDB, Node.js) with in-memory storage patterns. The implementation prioritizes production-readiness with no external infrastructure dependencies (no Redis, no key management services).

**Key Design Principles:**
- Single-server deployment compatible
- In-memory storage with automatic cleanup
- Environment variable configuration
- Comprehensive error handling and logging
- Integration with existing Phase 1 authentication

---

## Architecture

### Middleware Stack (Request Processing Order)

```
1. helmet() - Security headers (CSP, HSTS, X-Frame-Options)
2. requestTimingMiddleware() - Performance monitoring
3. cookieParser() - Parse HTTP-only cookies
4. sanitizeRequest - NoSQL injection prevention
5. cors() - Cross-origin resource sharing
6. rateLimiter - General rate limiting (200 req/15min in prod)
7. csrfProtection - CSRF token validation (POST/PUT/DELETE only)
8. express.json() - Parse JSON body
9. authMiddleware (protect) - JWT validation + token blacklist check
10. inputValidator - Query/body parameter validation
11. Route handlers
12. errorHandler - Centralized error handling
```

### In-Memory Storage Patterns

#### 1. Rate Limiting Storage
```javascript
// Structure: Map<string, { count: number, resetTime: number }>
const rateLimitStore = new Map();

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
```

#### 2. Token Blacklist Storage
```javascript
// Structure: Set<string> (JWT tokens)
const tokenBlacklist = new Set();

// Cleanup every 5 minutes (remove expired tokens)
setInterval(() => {
  const now = Date.now();
  for (const token of tokenBlacklist) {
    try {
      const decoded = jwt.decode(token);
      if (decoded.exp * 1000 < now) {
        tokenBlacklist.delete(token);
      }
    } catch (e) {
      tokenBlacklist.delete(token);
    }
  }
}, 5 * 60 * 1000);
```

#### 3. CSRF Token Storage
```javascript
// Structure: Map<sessionId, { token: string, createdAt: number }>
const csrfTokenStore = new Map();

// Cleanup every 24 hours
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  for (const [key, data] of csrfTokenStore.entries()) {
    if (now - data.createdAt > maxAge) {
      csrfTokenStore.delete(key);
    }
  }
}, 60 * 60 * 1000);
```

---

## Middleware Architecture

### 1. CSRF Protection Middleware (`middleware/csrfMiddleware.js`)

**Purpose:** Prevent Cross-Site Request Forgery attacks

**Implementation:**
- Generate unique CSRF token per session using `crypto.randomBytes(32)`
- Store token in in-memory Map with session ID as key
- Validate token on POST/PUT/DELETE requests
- Skip validation for GET requests
- Use double-submit cookie pattern with SameSite=Strict

**Token Lifecycle:**
1. User accesses form page → Generate token → Store in memory + send in response
2. User submits form → Extract token from body/header → Validate against stored token
3. User logs out → Remove token from memory
4. Token expires after 24 hours → Automatic cleanup

**Response Headers:**
```
X-CSRF-Token: <token>
Set-Cookie: XSRF-TOKEN=<token>; SameSite=Strict; HttpOnly; Secure
```

### 2. Rate Limiting Middleware (`middleware/rateLimitMiddleware.js`)

**Purpose:** Prevent brute force and DoS attacks

**Three-Tier Rate Limiting:**

**Tier 1: Authentication Endpoints**
- Login: 5 failed attempts per 15 minutes per IP
- Register: 3 attempts per hour per IP
- Reset password: 3 attempts per hour per IP

**Tier 2: Payment Endpoints**
- Payment initiation: 3 attempts per minute per user
- Webhook processing: 10 webhooks per minute per merchant
- High-value transactions (>$1000): 1 attempt per 5 minutes

**Tier 3: General API**
- 200 requests per 15 minutes per IP (production)
- 2000 requests per 15 minutes per IP (development)

**Implementation:**
- Track by IP for unauthenticated requests
- Track by user ID for authenticated requests
- Store in in-memory Map with automatic cleanup
- Return 429 Too Many Requests with Retry-After header

**Response Headers:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 2
X-RateLimit-Reset: 1234567890
Retry-After: 300
```

### 3. Input Validation Middleware (`middleware/inputValidationMiddleware.js`)

**Purpose:** Prevent injection attacks and malformed requests

**Validation Rules:**

**Query Parameters:**
- `page`: integer, min=1, max=1000
- `limit`: integer, min=1, max=100
- `status`: enum (pending, completed, cancelled, processing, shipped, delivered)
- `dateRange`: enum (7d, 30d, 90d)
- `sortBy`: enum (createdAt, price, rating)
- `search`: string, max=100 chars, alphanumeric + spaces

**Body Parameters:**
- `email`: valid email format
- `password`: min 8 chars, max 128 chars
- `phone`: numeric, 10-15 digits
- `amount`: numeric, min=0, max=999999
- `productId`: valid MongoDB ObjectId

**Implementation:**
- Use `express-validator` library
- Sanitize all string inputs (trim, escape)
- Validate against whitelist of allowed values
- Return 400 Bad Request with specific error messages
- Log validation failures for security monitoring

### 4. Request/Response Logging Middleware (`middleware/loggingMiddleware.js`)

**Purpose:** Monitor API usage and debug issues

**Logged Information:**
- Request: method, path, IP address, user ID, timestamp
- Response: status code, response time, response size
- Errors: error message, stack trace, user context

**Sensitive Data Exclusion:**
- Never log: passwords, tokens, credit card numbers, API keys
- Mask: email addresses (first 3 chars + ***@domain)
- Redact: phone numbers, addresses

**Implementation:**
- Use Morgan middleware with custom format
- Log to console in development
- Log to file in production (rotate daily, retain 30 days)
- Include request ID for tracing

---

## Database Schema Updates

### 1. User Model Enhancements

**New Fields:**
```javascript
{
  // Encryption at rest
  phone: { type: String, encrypted: true },
  addresses: [{
    firstName: String,
    lastName: String,
    phone: { type: String, encrypted: true },
    address: { type: String, encrypted: true },
    city: String,
    pin: String,
  }],
  
  // Email verification
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpiry: { type: Date },
  
  // Password reset
  passwordResetToken: { type: String },
  passwordResetExpiry: { type: Date },
  
  // Account status
  isBlocked: { type: Boolean, default: false },
  lastLogout: { type: Date },
  
  // Login tracking
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
}
```

**Indexes:**
```javascript
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });
```

### 2. Audit Log Model (`models/auditLogModel.js`)

**Purpose:** Track sensitive operations for compliance and security

**Schema:**
```javascript
{
  userId: { type: ObjectId, ref: 'User' },
  action: String, // 'login', 'logout', 'payment', 'admin_action', 'password_change'
  resource: String, // 'user', 'product', 'order', 'payment'
  resourceId: ObjectId,
  details: {
    ipAddress: String,
    userAgent: String,
    status: String, // 'success', 'failure'
    reason: String, // failure reason
    changes: Object, // before/after for updates
  },
  createdAt: { type: Date, default: Date.now },
}
```

**Indexes:**
```javascript
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL
```

### 3. Order Model Enhancements

**New Indexes:**
```javascript
orderSchema.index({ user: 1, createdAt: -1 }); // User order history
orderSchema.index({ status: 1, createdAt: -1 }); // Status filtering
orderSchema.index({ isPaid: 1, createdAt: -1 }); // Payment status
```

---

## API Versioning Strategy

### URL Structure
```
/api/v1/products
/api/v1/orders
/api/v1/payments
/api/v1/auth
```

### Version Header
```
X-API-Version: 1.0
```

### Implementation
- All routes prefixed with `/api/v1/`
- Version included in response headers
- Deprecated endpoints marked in documentation
- Future versions (v2, v3) can coexist with v1

### Backward Compatibility
- v1 endpoints remain stable
- Breaking changes only in new versions
- Clients have 6-month notice before version sunset

---

## Frontend Security Components

### 1. IDOR Prevention

**Implementation:**
```javascript
// Before displaying resource, verify ownership
const order = await Order.findById(orderId);
if (order.user.toString() !== req.user._id.toString()) {
  return res.status(403).json({ message: 'Access Denied' });
}
```

**Frontend Validation:**
```javascript
// Verify response contains expected user ID
if (response.data.userId !== currentUser.id) {
  redirect('/orders');
}
```

### 2. Unvalidated Redirect Prevention

**Whitelist Approach:**
```javascript
const ALLOWED_REDIRECTS = [
  '/dashboard',
  '/orders',
  '/profile',
  '/checkout',
];

function validateRedirect(url) {
  return ALLOWED_REDIRECTS.includes(url);
}
```

### 3. API Response Validation

**Using Zod Schema:**
```javascript
const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: z.enum(['pending', 'completed', 'cancelled']),
  total: z.number().positive(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    price: z.number().positive(),
  })),
});

// Validate response
const validated = OrderSchema.parse(response.data);
```

---

## Technology Choices

### Core Stack
- **Express.js**: Lightweight, flexible web framework
- **MongoDB**: Document database with flexible schema
- **Node.js**: JavaScript runtime for backend
- **JWT**: Stateless authentication tokens

### Security Libraries
- **helmet**: Security headers (CSP, HSTS, X-Frame-Options)
- **express-validator**: Input validation and sanitization
- **bcryptjs**: Password hashing
- **crypto**: Built-in Node.js module for CSRF tokens, encryption
- **jsonwebtoken**: JWT token generation and verification
- **mongo-sanitize**: NoSQL injection prevention
- **morgan**: HTTP request logging
- **cookie-parser**: HTTP-only cookie parsing

### Frontend Libraries
- **zod**: Runtime schema validation
- **axios**: HTTP client with interceptors
- **next/router**: Client-side routing with validation

### No External Dependencies
- ❌ Redis (use in-memory Map instead)
- ❌ AWS KMS (use environment variables)
- ❌ Vault (use environment variables)
- ❌ External logging service (use file-based logging)

---

## Encryption at Rest Implementation

### AES-256-GCM Encryption

**Sensitive Fields:**
- User phone number
- User addresses
- Payment method details (if stored)

**Implementation:**
```javascript
const crypto = require('crypto');

function encrypt(text, encryptionKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText, encryptionKey) {
  const [iv, authTag, encrypted] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), Buffer.from(iv, 'hex'));
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**Key Management:**
- Store encryption key in `ENCRYPTION_KEY` environment variable
- Key must be 32 bytes (256 bits) in hex format
- Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Rotate keys by updating environment variable (old data remains encrypted with old key)

---

## Error Handling and Logging

### Error Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

**HTTP Status Codes:**
- 200: Success
- 201: Created
- 400: Bad Request (validation error)
- 401: Unauthorized (auth failed)
- 403: Forbidden (access denied)
- 404: Not Found
- 429: Too Many Requests (rate limit)
- 500: Internal Server Error
- 504: Gateway Timeout

### Logging Levels

**ERROR:** Authentication failures, payment errors, database errors
**WARN:** Rate limit exceeded, validation failures, deprecated API usage
**INFO:** Login success, payment processed, admin actions
**DEBUG:** Request/response details, query execution time

---

## Integration with Phase 1

### Enhanced Auth Middleware

**Existing Functionality:**
- JWT token validation
- User existence check
- Role-based access control (admin/user)

**Phase 2-3 Enhancements:**
- Token blacklist check (Req 16)
- Account status check (Req 18)
- Email verification check (Req 19)
- Login attempt tracking (Req 2)

### Enhanced User Model

**Existing Fields:**
- name, email, password, role, phone, addresses

**Phase 2-3 Fields:**
- emailVerified, emailVerificationToken (Req 19)
- passwordResetToken, passwordResetExpiry (Req 20)
- isBlocked, lastLogout (Req 18)
- loginAttempts, lockUntil (Req 2)

### Enhanced Routes

**Existing Routes:**
- POST /api/auth/login
- POST /api/auth/register
- POST /api/auth/logout

**Phase 2-3 Routes:**
- POST /api/v1/auth/verify-email
- POST /api/v1/auth/resend-verification
- POST /api/v1/auth/forgot-password
- POST /api/v1/auth/reset-password
- GET /api/v1/orders (with pagination)
- POST /api/v1/payments/webhook

---

## Production Build Verification

### Build Steps
```bash
npm install
npm run build  # If applicable
npm start
```

### Verification Checklist
- ✅ All middleware loads without errors
- ✅ Database connection established
- ✅ Rate limiters initialized
- ✅ CSRF token store initialized
- ✅ Token blacklist initialized
- ✅ Cleanup intervals scheduled
- ✅ All routes registered
- ✅ Error handler attached
- ✅ Server listening on PORT

### Environment Variables Required
```
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://...
JWT_SECRET=<32+ char random string>
ENCRYPTION_KEY=<64 char hex string>
CORS_ORIGINS=https://yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

---

## Testing Strategy

### Unit Tests (Not PBT - Infrastructure/Configuration)

**Middleware Tests:**
- CSRF token generation and validation
- Rate limit counter increment and reset
- Input validation with various payloads
- Error response formatting

**Model Tests:**
- User encryption/decryption
- Audit log creation
- Index verification

**Utility Tests:**
- Token generation
- Email formatting
- Password reset link generation

### Integration Tests

**Authentication Flow:**
- Register → Email verification → Login → Logout
- Password reset flow
- Account blocking/suspension

**Payment Flow:**
- Payment initiation → Webhook processing → Order update
- Rate limit enforcement on payment endpoints

**API Versioning:**
- /api/v1/ endpoints return correct version header
- Deprecated endpoints return 404 or redirect

### Manual Testing

**Security Headers:**
```bash
curl -I https://api.ruvia.com/api/v1/products
# Verify: Content-Security-Policy, Strict-Transport-Security, X-Frame-Options
```

**Rate Limiting:**
```bash
for i in {1..10}; do curl -X POST https://api.ruvia.com/api/v1/auth/login; done
# Verify: 429 Too Many Requests after limit exceeded
```

**CSRF Protection:**
```bash
curl -X POST https://api.ruvia.com/api/v1/orders -d '{}' -H 'Content-Type: application/json'
# Verify: 403 Forbidden - Invalid CSRF token
```

---

## Deployment Considerations

### Single-Server Deployment

**Limitations:**
- In-memory storage lost on restart (acceptable for rate limits, CSRF tokens)
- Token blacklist cleared on restart (users can use old tokens briefly)
- No horizontal scaling (single process)

**Mitigation:**
- Graceful shutdown: wait for in-flight requests before closing
- Startup: reinitialize all in-memory stores
- Monitoring: alert on unexpected restarts

### Production Checklist

- ✅ HTTPS enforced (HSTS header)
- ✅ Environment variables configured
- ✅ Database backups enabled
- ✅ Logs rotated and retained
- ✅ Monitoring and alerting configured
- ✅ Rate limits appropriate for expected load
- ✅ CSRF tokens generated with secure random
- ✅ Encryption keys stored securely
- ✅ Error messages don't expose internals
- ✅ Sensitive data not logged

