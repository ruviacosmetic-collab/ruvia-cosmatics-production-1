const crypto = require('crypto');
const User = require('../models/userModel');
const sendEmail = require('./sendEmail');

/**
 * Email Verification Utility
 * Handles email verification token generation and verification
 */

// Token expiration time: 24 hours
const TOKEN_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a unique email verification token
 * @returns {string} 32-byte random token in hex format
 */
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Send verification email to user
 * @param {Object} options - Email options
 * @param {string} options.email - User email address
 * @param {string} options.token - Verification token
 * @param {string} options.userName - User name
 * @returns {Promise<Object>} { success: boolean, error: string }
 */
const sendVerificationEmail = async (options) => {
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
    // Build verification link
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${token}`;
    
    // Email template
    const subject = 'Verify Your Email Address';
    const html = `
      <h2>Welcome to Ruvia Cosmetics!</h2>
      <p>Hi ${userName},</p>
      <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
      <p>Or copy and paste this link in your browser:</p>
      <p>${verificationLink}</p>
      <p>This link will expire in 24 hours.</p>
      <p>If you did not create this account, please ignore this email.</p>
      <p>Best regards,<br>Ruvia Cosmetics Team</p>
    `;
    
    // Send email
    await sendEmail({
      email,
      subject,
      message: `Please verify your email by visiting: ${verificationLink}`,
      html,
    });

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to send verification email: ${error.message}`,
    };
  }
};

/**
 * Verify email token and mark email as verified
 * @param {string} token - Verification token
 * @returns {Promise<Object>} { success: boolean, error: string, user: Object }
 */
const verifyEmail = async (token) => {
  if (!token) {
    return {
      success: false,
      error: 'Verification token is required',
    };
  }
  
  try {
    // Find user with matching token
    const user = await User.findOne({
      emailVerificationToken: token,
    });
    
    if (!user) {
      return {
        success: false,
        error: 'Invalid verification token',
      };
    }
    
    // Check if token has expired
    if (user.emailVerificationExpiry && user.emailVerificationExpiry < Date.now()) {
      return {
        success: false,
        error: 'Verification token has expired',
      };
    }
    
    // Mark email as verified
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;
    
    await user.save();
    
    return {
      success: true,
      user,
    };
  } catch (error) {
    return {
      success: false,
      error: `Email verification failed: ${error.message}`,
    };
  }
};

/**
 * Generate and send verification email for user
 * @param {Object} user - User object
 * @returns {Promise<Object>} { success: boolean, error: string }
 */
const generateAndSendVerificationEmail = async (user) => {
  if (!user || !user.email) {
    return {
      success: false,
      error: 'User and email are required',
    };
  }
  
  try {
    // Generate token
    const token = generateVerificationToken();
    
    // Set token and expiration on user
    user.emailVerificationToken = token;
    user.emailVerificationExpiry = new Date(Date.now() + TOKEN_EXPIRATION_MS);
    
    await user.save();
    
    // Send verification email
    const result = await sendVerificationEmail({
      email: user.email,
      token,
      userName: user.name,
    });
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: `Failed to generate and send verification email: ${error.message}`,
    };
  }
};

/**
 * Resend verification email
 * @param {string} email - User email address
 * @returns {Promise<Object>} { success: boolean, error: string }
 */
const resendVerificationEmail = async (email) => {
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
      return {
        success: false,
        error: 'User not found',
      };
    }
    
    // Check if email is already verified
    if (user.emailVerified) {
      return {
        success: false,
        error: 'Email is already verified',
      };
    }
    
    // Generate new token
    const token = generateVerificationToken();
    
    // Update user
    user.emailVerificationToken = token;
    user.emailVerificationExpiry = new Date(Date.now() + TOKEN_EXPIRATION_MS);
    
    await user.save();
    
    // Send verification email
    const result = await sendVerificationEmail({
      email: user.email,
      token,
      userName: user.name,
    });
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: `Failed to resend verification email: ${error.message}`,
    };
  }
};

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  verifyEmail,
  generateAndSendVerificationEmail,
  resendVerificationEmail,
  TOKEN_EXPIRATION_MS,
};
