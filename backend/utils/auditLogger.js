const AuditLog = require('../models/auditLogModel');

/**
 * Audit Logging Utility
 * Records sensitive operations for compliance and security monitoring
 */

/**
 * Log a login attempt
 * @param {Object} options - Logging options
 * @param {string} options.userId - User ID (optional for failed attempts)
 * @param {string} options.ipAddress - IP address of the request
 * @param {string} options.userAgent - User agent string
 * @param {string} options.status - 'success' or 'failure'
 * @param {string} options.reason - Failure reason (if status is 'failure')
 */
const logLogin = async (options) => {
  try {
    const {
      userId = null,
      ipAddress,
      userAgent,
      status,
      reason = null,
    } = options;

    await AuditLog.create({
      userId,
      action: 'login',
      resource: 'user',
      resourceId: userId,
      details: {
        ipAddress,
        userAgent,
        status,
        reason,
      },
    });
  } catch (error) {
    console.error('Failed to log login:', error.message);
    // Don't throw - audit logging should not break the application
  }
};

/**
 * Log a logout event
 * @param {Object} options - Logging options
 * @param {string} options.userId - User ID
 * @param {string} options.ipAddress - IP address of the request
 * @param {string} options.userAgent - User agent string
 */
const logLogout = async (options) => {
  try {
    const {
      userId,
      ipAddress,
      userAgent,
    } = options;

    await AuditLog.create({
      userId,
      action: 'logout',
      resource: 'user',
      resourceId: userId,
      details: {
        ipAddress,
        userAgent,
        status: 'success',
      },
    });
  } catch (error) {
    console.error('Failed to log logout:', error.message);
  }
};

/**
 * Log a payment transaction
 * @param {Object} options - Logging options
 * @param {string} options.userId - User ID
 * @param {string} options.orderId - Order ID
 * @param {number} options.amount - Payment amount
 * @param {string} options.method - Payment method (Razorpay, COD, UPI)
 * @param {string} options.status - 'success' or 'failure'
 * @param {string} options.transactionId - Transaction ID (if available)
 * @param {string} options.reason - Failure reason (if status is 'failure')
 * @param {string} options.ipAddress - IP address of the request
 */
const logPayment = async (options) => {
  try {
    const {
      userId,
      orderId,
      amount,
      method,
      status,
      transactionId = null,
      reason = null,
      ipAddress,
    } = options;

    await AuditLog.create({
      userId,
      action: 'payment',
      resource: 'order',
      resourceId: orderId,
      details: {
        amount,
        method,
        status,
        transactionId,
        reason,
        ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to log payment:', error.message);
  }
};

/**
 * Log a password change
 * @param {Object} options - Logging options
 * @param {string} options.userId - User ID
 * @param {string} options.ipAddress - IP address of the request
 * @param {string} options.userAgent - User agent string
 * @param {string} options.reason - Reason for password change (e.g., 'user_request', 'admin_reset', 'security_incident')
 */
const logPasswordChange = async (options) => {
  try {
    const {
      userId,
      ipAddress,
      userAgent,
      reason = 'user_request',
    } = options;

    await AuditLog.create({
      userId,
      action: 'password_change',
      resource: 'user',
      resourceId: userId,
      details: {
        ipAddress,
        userAgent,
        status: 'success',
        reason,
      },
    });
  } catch (error) {
    console.error('Failed to log password change:', error.message);
  }
};

/**
 * Log an admin action (create, update, delete)
 * @param {Object} options - Logging options
 * @param {string} options.adminId - Admin user ID
 * @param {string} options.action - 'create', 'update', or 'delete'
 * @param {string} options.resource - Resource type (e.g., 'product', 'user', 'order')
 * @param {string} options.resourceId - ID of the resource being modified
 * @param {Object} options.changes - Before/after values for updates
 * @param {string} options.ipAddress - IP address of the request
 */
const logAdminAction = async (options) => {
  try {
    const {
      adminId,
      action,
      resource,
      resourceId,
      changes = null,
      ipAddress,
    } = options;

    await AuditLog.create({
      userId: adminId,
      action: `admin_${action}`,
      resource,
      resourceId,
      details: {
        changes,
        ipAddress,
        status: 'success',
      },
    });
  } catch (error) {
    console.error('Failed to log admin action:', error.message);
  }
};

/**
 * Log account status change (block, suspend, unblock)
 * @param {Object} options - Logging options
 * @param {string} options.adminId - Admin user ID who performed the action
 * @param {string} options.targetUserId - User ID being blocked/suspended
 * @param {string} options.action - 'block', 'suspend', or 'unblock'
 * @param {string} options.reason - Reason for the action
 * @param {string} options.ipAddress - IP address of the request
 */
const logAccountStatus = async (options) => {
  try {
    const {
      adminId,
      targetUserId,
      action,
      reason,
      ipAddress,
    } = options;

    await AuditLog.create({
      userId: adminId,
      action: `account_${action}`,
      resource: 'user',
      resourceId: targetUserId,
      details: {
        targetUserId,
        reason,
        ipAddress,
        status: 'success',
      },
    });
  } catch (error) {
    console.error('Failed to log account status change:', error.message);
  }
};

/**
 * Log email verification
 * @param {Object} options - Logging options
 * @param {string} options.userId - User ID
 * @param {string} options.status - 'success' or 'failure'
 * @param {string} options.reason - Failure reason (if status is 'failure')
 */
const logEmailVerification = async (options) => {
  try {
    const {
      userId,
      status,
      reason = null,
    } = options;

    await AuditLog.create({
      userId,
      action: 'email_verification',
      resource: 'user',
      resourceId: userId,
      details: {
        status,
        reason,
      },
    });
  } catch (error) {
    console.error('Failed to log email verification:', error.message);
  }
};

/**
 * Log password reset request
 * @param {Object} options - Logging options
 * @param {string} options.userId - User ID (optional for failed attempts)
 * @param {string} options.email - Email address
 * @param {string} options.status - 'success' or 'failure'
 * @param {string} options.reason - Failure reason (if status is 'failure')
 * @param {string} options.ipAddress - IP address of the request
 */
const logPasswordReset = async (options) => {
  try {
    const {
      userId = null,
      email,
      status,
      reason = null,
      ipAddress,
    } = options;

    await AuditLog.create({
      userId,
      action: 'password_reset',
      resource: 'user',
      resourceId: userId,
      details: {
        email,
        status,
        reason,
        ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to log password reset:', error.message);
  }
};

module.exports = {
  logLogin,
  logLogout,
  logPayment,
  logPasswordChange,
  logAdminAction,
  logAccountStatus,
  logEmailVerification,
  logPasswordReset,
};
