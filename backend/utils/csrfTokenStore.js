/**
 * In-memory CSRF token store for managing session-based CSRF tokens
 * Implements automatic cleanup of expired tokens every 24 hours
 */

const crypto = require('crypto');

// Map structure: Map<sessionId, { token: string, createdAt: number }>
const csrfTokenStore = new Map();

// Token expiration time: 24 hours
const TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;

// Cleanup interval reference for testing/cleanup
let cleanupInterval = null;

/**
 * Start the cleanup interval that removes expired tokens
 * Runs every 24 hours
 */
const startCleanupInterval = () => {
  if (cleanupInterval) {
    return; // Already running
  }

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let removedCount = 0;

    for (const [sessionId, value] of csrfTokenStore.entries()) {
      if (now - value.createdAt > TOKEN_EXPIRATION_MS) {
        csrfTokenStore.delete(sessionId);
        removedCount++;
      }
    }

    // Silently clean up without logging
  }, TOKEN_EXPIRATION_MS);

  // Prevent the interval from keeping the process alive
  cleanupInterval.unref();
};

/**
 * Stop the cleanup interval (useful for testing)
 */
const stopCleanupInterval = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

/**
 * Generate a new CSRF token for a session
 * Creates a 32-byte random token in hex format
 * @param {string} sessionId - Unique session identifier
 * @returns {string} Generated CSRF token (32 bytes hex string)
 */
const generate = (sessionId) => {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Session ID must be a non-empty string');
  }

  // Generate 32 bytes of random data and convert to hex
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  csrfTokenStore.set(sessionId, {
    token,
    createdAt: now,
  });

  return token;
};

/**
 * Validate a CSRF token for a session
 * @param {string} sessionId - Unique session identifier
 * @param {string} token - Token to validate
 * @returns {boolean} True if token is valid and matches, false otherwise
 */
const validate = (sessionId, token) => {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Session ID must be a non-empty string');
  }
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }

  const entry = csrfTokenStore.get(sessionId);

  // No entry found
  if (!entry) {
    return false;
  }

  // Check if token has expired
  const now = Date.now();
  if (now - entry.createdAt > TOKEN_EXPIRATION_MS) {
    csrfTokenStore.delete(sessionId);
    return false;
  }

  // Compare tokens using constant-time comparison to prevent timing attacks
  // First check length to avoid timing-safe equal error
  if (entry.token.length !== token.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(entry.token),
    Buffer.from(token)
  );
};

/**
 * Revoke a CSRF token by removing it from the store
 * @param {string} sessionId - Unique session identifier
 */
const revoke = (sessionId) => {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Session ID must be a non-empty string');
  }
  csrfTokenStore.delete(sessionId);
};

/**
 * Get all current tokens (for debugging/monitoring)
 * @returns {Object} Object with all current CSRF tokens
 */
const getAll = () => {
  const result = {};
  const now = Date.now();

  for (const [sessionId, value] of csrfTokenStore.entries()) {
    const ageMs = now - value.createdAt;
    const isExpired = ageMs > TOKEN_EXPIRATION_MS;

    result[sessionId] = {
      token: value.token,
      createdAt: value.createdAt,
      ageMs,
      isExpired,
      expiresIn: Math.max(0, TOKEN_EXPIRATION_MS - ageMs),
    };
  }

  return result;
};

/**
 * Clear all tokens (useful for testing)
 */
const clear = () => {
  csrfTokenStore.clear();
};

// Start cleanup interval on module load
startCleanupInterval();

module.exports = {
  generate,
  validate,
  revoke,
  getAll,
  clear,
  startCleanupInterval,
  stopCleanupInterval,
};
