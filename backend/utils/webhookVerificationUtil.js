const crypto = require('crypto');
const WebhookEvent = require('../models/webhookEventModel');

/**
 * Webhook Verification Utility
 * Verifies webhook authenticity and prevents replay attacks
 */

/**
 * Verify webhook HMAC-SHA256 signature
 * @param {string} payload - Raw webhook payload (JSON string)
 * @param {string} signature - Signature from webhook header
 * @param {string} secret - Webhook secret key
 * @returns {Object} { isValid: boolean, error: string }
 */
const verifySignature = (payload, signature, secret) => {
  if (!payload || !signature || !secret) {
    return {
      isValid: false,
      error: 'Missing payload, signature, or secret',
    };
  }
  
  try {
    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    // Compare signatures using constant-time comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    
    return {
      isValid,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Signature verification failed: ${error.message}`,
    };
  }
};

/**
 * Verify webhook timestamp to prevent replay attacks
 * @param {number} timestamp - Webhook timestamp (in seconds)
 * @param {number} maxAge - Maximum age in seconds (default: 5 minutes)
 * @returns {Object} { isValid: boolean, error: string }
 */
const verifyTimestamp = (timestamp, maxAge = 5 * 60) => {
  if (!timestamp) {
    return {
      isValid: false,
      error: 'Timestamp is missing',
    };
  }
  
  try {
    const timestampMs = parseInt(timestamp) * 1000;
    const now = Date.now();
    const age = (now - timestampMs) / 1000; // Convert to seconds
    
    if (age < 0) {
      return {
        isValid: false,
        error: 'Timestamp is in the future',
      };
    }
    
    if (age > maxAge) {
      return {
        isValid: false,
        error: `Webhook is too old (${age}s > ${maxAge}s)`,
      };
    }
    
    return {
      isValid: true,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Timestamp verification failed: ${error.message}`,
    };
  }
};

/**
 * Check if webhook has already been processed (duplicate detection)
 * @param {string} webhookId - Unique webhook ID
 * @returns {Promise<Object>} { isDuplicate: boolean, error: string }
 */
const checkDuplicate = async (webhookId) => {
  if (!webhookId) {
    return {
      isDuplicate: false,
      error: 'Webhook ID is missing',
    };
  }
  
  try {
    // Check if webhook event already exists
    const existingEvent = await WebhookEvent.findOne({ webhookId });
    
    if (existingEvent) {
      return {
        isDuplicate: true,
        error: 'Webhook has already been processed',
      };
    }
    
    return {
      isDuplicate: false,
    };
  } catch (error) {
    return {
      isDuplicate: false,
      error: `Duplicate check failed: ${error.message}`,
    };
  }
};

/**
 * Record webhook event to prevent duplicate processing
 * @param {string} webhookId - Unique webhook ID
 * @param {string} event - Event type
 * @param {string} status - Processing status (pending, success, failure)
 * @param {Object} data - Webhook data
 * @returns {Promise<Object>} Created webhook event
 */
const recordWebhookEvent = async (webhookId, event, status, data = {}) => {
  try {
    const webhookEvent = await WebhookEvent.create({
      webhookId,
      event,
      status,
      data,
      timestamp: new Date(),
    });
    
    return {
      success: true,
      event: webhookEvent,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to record webhook event: ${error.message}`,
    };
  }
};

/**
 * Update webhook event status
 * @param {string} webhookId - Unique webhook ID
 * @param {string} status - New status (success, failure)
 * @param {Object} result - Processing result
 * @returns {Promise<Object>} Updated webhook event
 */
const updateWebhookEventStatus = async (webhookId, status, result = {}) => {
  try {
    const webhookEvent = await WebhookEvent.findOneAndUpdate(
      { webhookId },
      {
        status,
        result,
        processedAt: new Date(),
      },
      { new: true }
    );
    
    return {
      success: true,
      event: webhookEvent,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update webhook event: ${error.message}`,
    };
  }
};

/**
 * Verify complete webhook (signature + timestamp + duplicate check)
 * @param {Object} options - Verification options
 * @param {string} options.payload - Raw webhook payload
 * @param {string} options.signature - Signature from header
 * @param {string} options.secret - Webhook secret
 * @param {number} options.timestamp - Webhook timestamp
 * @param {string} options.webhookId - Unique webhook ID
 * @returns {Promise<Object>} { isValid: boolean, error: string }
 */
const verifyWebhook = async (options) => {
  const {
    payload,
    signature,
    secret,
    timestamp,
    webhookId,
  } = options;
  
  // Verify signature
  const signatureCheck = verifySignature(payload, signature, secret);
  if (!signatureCheck.isValid) {
    return {
      isValid: false,
      error: signatureCheck.error,
    };
  }
  
  // Verify timestamp
  const timestampCheck = verifyTimestamp(timestamp);
  if (!timestampCheck.isValid) {
    return {
      isValid: false,
      error: timestampCheck.error,
    };
  }
  
  // Check for duplicates
  const duplicateCheck = await checkDuplicate(webhookId);
  if (duplicateCheck.isDuplicate) {
    return {
      isValid: false,
      isDuplicate: true,
      error: duplicateCheck.error,
    };
  }
  
  return {
    isValid: true,
  };
};

module.exports = {
  verifySignature,
  verifyTimestamp,
  checkDuplicate,
  recordWebhookEvent,
  updateWebhookEventStatus,
  verifyWebhook,
};
