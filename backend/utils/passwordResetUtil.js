const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const sendEmail = require('./sendEmail');
const { revokeToken } = require('../middleware/authMiddleware');

/**
 * Password Reset Utility
 * Handles password reset token generation and password reset flow
 */

// Token expiration time: 1 hour
const TOKEN_EXPIRATION_MS = 60 * 60 * 1000;

/**
 * Generate a unique password reset token
 * @returns {string} 32-byte random token in hex format
 */
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Send password reset email to user
 * @param {Object} options - Email options
 * @param {string} options.email - User email address
 * @param {string} options.token - Reset token
 * @param {string} options.userName - User name
 * @returns {Promise<Object>} { success: boolean, error: string }
 */
const sendResetEmail = async (options) => {
  const {
    email,
    token,
    userName,
  } = options;
  
  if (!email || !token) {
    return {
      success: false,
      error: 'Email and token are required',
    };
  }
  
  try {
    // Build reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;
    
    // Email template
    const subject = 'Reset Your Password';
    const html = `
      <h2>Password Reset Request</h2>
      <p>Hi ${userName},</p>
      <p>We received a request to reset your password. Click the link below to create a new password:</p>
      <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
      <p>Or copy and paste this link in your browser:</p>
      <p>${resetLink}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
      <p>Best regards,<br>Ruvia Cosmetics Team</p>
    `;
    
    // Send email
    await sendEmail({
      email,
      subject,
      message: `Reset your password by visiting: ${resetLink}`,
      html,
    });

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to send reset email: ${error.message}`,
    };
  }
};

/**
 * Generate and send password reset email for user
 * @param {string} email - User email address
 * @returns {Promise<Object>} { success: boolean, error: string }
 */
const generateAndSendResetEmail = async (email) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required',
    };
  }
  
  try {
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal if user exists (security best practice)
      return {
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent',
      };
    }
    
    // Generate token
    const token = generateResetToken();
    
    // Set token and expiration on user
    user.passwordResetToken = token;
    user.passwordResetExpiry = new Date(Date.now() + TOKEN_EXPIRATION_MS);
    
    await user.save();
    
    // Send reset email
    const result = await sendResetEmail({
      email: user.email,
      token,
      userName: user.name,
    });
    
    if (!result.success) {
      // Clear token if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpiry = undefined;
      await user.save();
      
      return result;
    }
    
    return {
      success: true,
      message: 'Password reset email sent',
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to generate and send reset email: ${error.message}`,
    };
  }
};

/**
 * Reset password using reset token
 * @param {Object} options - Reset options
 * @param {string} options.token - Reset token
 * @param {string} options.newPassword - New password
 * @returns {Promise<Object>} { success: boolean, error: string, user: Object }
 */
const resetPassword = async (options) => {
  const {
    token,
    newPassword,
  } = options;
  
  if (!token || !newPassword) {
    return {
      success: false,
      error: 'Token and new password are required',
    };
  }
  
  try {
    // Validate password
    if (newPassword.length < 8 || newPassword.length > 128) {
      return {
        success: false,
        error: 'Password must be between 8 and 128 characters',
      };
    }
    
    // Find user with matching token
    const user = await User.findOne({
      passwordResetToken: token,
    });
    
    if (!user) {
      return {
        success: false,
        error: 'Invalid password reset token',
      };
    }
    
    // Check if token has expired
    if (user.passwordResetExpiry && user.passwordResetExpiry < Date.now()) {
      return {
        success: false,
        error: 'Password reset token has expired',
      };
    }
    
    // Update password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    
    await user.save();
    
    // Invalidate all active tokens for this user
    // This forces the user to log in again with the new password
    // Note: In a real implementation, you would revoke all tokens for this user
    // For now, we'll just update lastLogout to invalidate tokens
    user.lastLogout = new Date();
    await user.save();
    
    return {
      success: true,
      message: 'Password has been reset successfully',
      user,
    };
  } catch (error) {
    return {
      success: false,
      error: `Password reset failed: ${error.message}`,
    };
  }
};

/**
 * Verify password reset token
 * @param {string} token - Reset token
 * @returns {Promise<Object>} { isValid: boolean, error: string }
 */
const verifyResetToken = async (token) => {
  if (!token) {
    return {
      isValid: false,
      error: 'Token is required',
    };
  }
  
  try {
    // Find user with matching token
    const user = await User.findOne({
      passwordResetToken: token,
    });
    
    if (!user) {
      return {
        isValid: false,
        error: 'Invalid password reset token',
      };
    }
    
    // Check if token has expired
    if (user.passwordResetExpiry && user.passwordResetExpiry < Date.now()) {
      return {
        isValid: false,
        error: 'Password reset token has expired',
      };
    }
    
    return {
      isValid: true,
      email: user.email,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Token verification failed: ${error.message}`,
    };
  }
};

module.exports = {
  generateResetToken,
  sendResetEmail,
  generateAndSendResetEmail,
  resetPassword,
  verifyResetToken,
  TOKEN_EXPIRATION_MS,
};
