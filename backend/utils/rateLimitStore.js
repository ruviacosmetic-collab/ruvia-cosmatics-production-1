/**
 * In-memory rate limit store for tracking request counters
 * Implements automatic cleanup of expired entries every 5 minutes
 */

// Map structure: Map<string, { count: number, resetTime: number }>
const rateLimitStore = new Map();

// Cleanup interval reference for testing/cleanup
let cleanupInterval = null;

/**
 * Start the cleanup interval that removes expired entries
 * Runs every 5 minutes
 */
const startCleanupInterval = () => {
  if (cleanupInterval) {
    return; // Already running
  }

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key);
        removedCount++;
      }
    }

    // Silently clean up without logging
  }, 5 * 60 * 1000); // 5 minutes

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
 * Increment the counter for a given key
 * @param {string} key - Unique identifier (e.g., IP address or user ID)
 * @param {number} limit - Maximum allowed requests in the window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} { count: number, remaining: number, resetTime: number }
 */
const increment = (key, limit, windowMs) => {
  if (!key || typeof key !== 'string') {
    throw new Error('Key must be a non-empty string');
  }
  if (typeof limit !== 'number' || limit <= 0) {
    throw new Error('Limit must be a positive number');
  }
  if (typeof windowMs !== 'number' || windowMs <= 0) {
    throw new Error('Window must be a positive number');
  }

  const now = Date.now();
  let entry = rateLimitStore.get(key);

  // Create new entry if doesn't exist or window has expired
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, entry);
  } else {
    entry.count++;
  }

  const remaining = Math.max(0, limit - entry.count);

  return {
    count: entry.count,
    remaining,
    resetTime: entry.resetTime,
  };
};

/**
 * Check if the limit has been exceeded for a given key
 * @param {string} key - Unique identifier (e.g., IP address or user ID)
 * @param {number} limit - Maximum allowed requests in the window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} { allowed: boolean, remaining: number, resetTime: number }
 */
const check = (key, limit, windowMs) => {
  if (!key || typeof key !== 'string') {
    throw new Error('Key must be a non-empty string');
  }
  if (typeof limit !== 'number' || limit <= 0) {
    throw new Error('Limit must be a positive number');
  }
  if (typeof windowMs !== 'number' || windowMs <= 0) {
    throw new Error('Window must be a positive number');
  }

  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No entry or window expired - allowed
  if (!entry || entry.resetTime < now) {
    return {
      allowed: true,
      remaining: limit,
      resetTime: now + windowMs,
    };
  }

  const allowed = entry.count < limit;
  const remaining = Math.max(0, limit - entry.count);

  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  };
};

/**
 * Reset the counter for a given key
 * @param {string} key - Unique identifier
 */
const reset = (key) => {
  if (!key || typeof key !== 'string') {
    throw new Error('Key must be a non-empty string');
  }
  rateLimitStore.delete(key);
};

/**
 * Get all current counters (for debugging/monitoring)
 * @returns {Object} Object with all current rate limit entries
 */
const getAll = () => {
  const result = {};
  for (const [key, value] of rateLimitStore.entries()) {
    result[key] = {
      count: value.count,
      resetTime: value.resetTime,
      expiresIn: Math.max(0, value.resetTime - Date.now()),
    };
  }
  return result;
};

/**
 * Clear all entries (useful for testing)
 */
const clear = () => {
  rateLimitStore.clear();
};

// Start cleanup interval on module load
startCleanupInterval();

module.exports = {
  increment,
  check,
  reset,
  getAll,
  clear,
  startCleanupInterval,
  stopCleanupInterval,
};
