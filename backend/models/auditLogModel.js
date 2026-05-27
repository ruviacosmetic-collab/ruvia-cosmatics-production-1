const mongoose = require('mongoose');

/**
 * Audit Log Schema
 * Immutable collection for tracking all user actions and system events
 * Automatically expires after 90 days via TTL index
 */
const auditLogSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'LOGIN',
      'LOGOUT',
      'LOGIN_FAILED',
      'PASSWORD_RESET',
      'EMAIL_VERIFICATION',
      'PROFILE_UPDATE',
      'ORDER_CREATE',
      'ORDER_UPDATE',
      'ORDER_CANCEL',
      'PAYMENT_INITIATED',
      'PAYMENT_SUCCESS',
      'PAYMENT_FAILED',
      'PRODUCT_VIEW',
      'PRODUCT_REVIEW',
      'WISHLIST_ADD',
      'WISHLIST_REMOVE',
      'CART_UPDATE',
      'ADMIN_ACTION',
      'SECURITY_EVENT',
      'DATA_ACCESS'
    ],
    index: true
  },
  resource: {
    type: String,
    required: true,
    enum: ['User', 'Order', 'Product', 'Payment', 'Admin', 'System']
  },
  resourceId: {
    type: String,
    required: true
  },
  details: {
    ipAddress: String,
    userAgent: String,
    status: {
      type: String,
      enum: ['success', 'failure', 'pending'],
      default: 'success'
    },
    reason: String,
    changes: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: false,
  collection: 'auditLogs'
});

// Compound indexes for efficient querying
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// TTL index: automatically delete documents 90 days after creation
// 90 days = 7776000 seconds
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Make collection immutable - prevent updates and deletes
auditLogSchema.pre('findOneAndUpdate', function (next) {
  throw new Error('Audit logs are immutable and cannot be updated');
});

auditLogSchema.pre('updateOne', function (next) {
  throw new Error('Audit logs are immutable and cannot be updated');
});

auditLogSchema.pre('updateMany', function (next) {
  throw new Error('Audit logs are immutable and cannot be updated');
});

auditLogSchema.pre('findOneAndDelete', function (next) {
  throw new Error('Audit logs are immutable and cannot be deleted');
});

auditLogSchema.pre('deleteOne', function (next) {
  throw new Error('Audit logs are immutable and cannot be deleted');
});

auditLogSchema.pre('deleteMany', function (next) {
  throw new Error('Audit logs are immutable and cannot be deleted');
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
