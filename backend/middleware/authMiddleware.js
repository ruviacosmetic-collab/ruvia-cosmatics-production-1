const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// In-memory token blacklist (use Redis in production)
// Structure: Set<string> of revoked JWT tokens (matches design.md)
const tokenBlacklist = new Set();

// Cleanup interval reference for testing/cleanup
let cleanupInterval = null;

// Cleanup cadence: every 5 minutes (Requirement 16)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Remove expired tokens from the blacklist.
 * A token is considered expired when its `exp` claim (seconds since epoch)
 * is in the past. Tokens that cannot be decoded are kept in the blacklist
 * to fail safe on unparseable input.
 */
const cleanupExpiredTokens = () => {
  const now = Date.now();

  for (const token of tokenBlacklist) {
    try {
      const decoded = jwt.decode(token);

      // If decode fails or no exp claim, keep the token (fail safe)
      if (!decoded || !decoded.exp) {
        continue;
      }

      // exp is in seconds, Date.now() is in ms
      if (decoded.exp * 1000 < now) {
        tokenBlacklist.delete(token);
      }
    } catch (_error) {
      // Decode errors are non-fatal; leave token in blacklist
    }
  }
};

/**
 * Start the cleanup interval that removes expired tokens from blacklist.
 * Runs every 5 minutes. The interval is unref'd so it does not keep the
 * Node.js process alive on its own.
 */
const startCleanupInterval = () => {
  if (cleanupInterval) {
    return; // Already running
  }

  cleanupInterval = setInterval(cleanupExpiredTokens, CLEANUP_INTERVAL_MS);

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

const protect = async (req, res, next) => {
  let token;

  // Try to get token from cookie first (HTTP-only cookie)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // Fallback to Authorization header for backward compatibility
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  // Check if token is blacklisted
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ message: 'Token has been revoked' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    // Check if user is blocked/suspended
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Account has been suspended' });
    }

    // Check if token was issued before last logout
    if (user.lastLogout && decoded.iat < Math.floor(user.lastLogout.getTime() / 1000)) {
      return res.status(401).json({ message: 'Token has been revoked' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    console.error('Auth error:', error.message);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

/**
 * Add token to blacklist (for logout).
 * The token will be automatically removed once expired by the
 * cleanup interval (every 5 minutes).
 * @param {string} token - JWT token to revoke
 */
const revokeToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }
  tokenBlacklist.add(token);
};

/**
 * Clear all tokens from blacklist (useful for testing)
 */
const clearBlacklist = () => {
  tokenBlacklist.clear();
};

// Start cleanup interval on module load
startCleanupInterval();

module.exports = {
  protect,
  admin,
  revokeToken,
  tokenBlacklist,
  startCleanupInterval,
  stopCleanupInterval,
  cleanupExpiredTokens,
  clearBlacklist,
};
