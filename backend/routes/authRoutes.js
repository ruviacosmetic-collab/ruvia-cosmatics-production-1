const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  authUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  requestPasswordReset,
  resetPassword,
  logoutUser,
  addAddress,
  removeAddress,
  getCsrfToken,
  verifyEmailHandler,
  resendVerificationEmailHandler,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { runValidation } = require('../middleware/validateMiddleware');
const { getTokenCookieOptions } = require('../utils/cookieOptions');
const {
  loginRateLimiter,
  registerRateLimiter,
  passwordResetRateLimiter,
  verificationResendRateLimiter,
} = require('../middleware/authRateLimiter');

// Login validation
const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

// Register validation with strong password requirements
const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('password')
    .isLength({ min: 12 })
    .withMessage('Password must be at least 12 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character (@$!%*?&)'),
];

// Profile update validation
const profileValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone('en-IN'),
  body('password')
    .optional()
    .isLength({ min: 12 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  body('oldPassword').if(() => body('password').exists()).notEmpty().withMessage('Old password required to change password'),
];

// Password reset validation
const passwordResetValidation = [
  body('password')
    .isLength({ min: 12 })
    .withMessage('Password must be at least 12 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
];

// Routes
router.get('/csrf-token', getCsrfToken);
router.post('/register', registerRateLimiter, registerValidation, runValidation, registerUser);
router.post('/login', loginRateLimiter, loginValidation, runValidation, authUser);
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getUserProfile);
router.put('/profile', protect, profileValidation, runValidation, updateUserProfile);
router.post('/forgot-password', passwordResetRateLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address')
], runValidation, requestPasswordReset);
router.post('/reset-password/:token', passwordResetRateLimiter, passwordResetValidation, runValidation, resetPassword);

// Email verification endpoints (Req 19)
router.get('/verify-email/:token', verifyEmailHandler);
router.post(
  '/resend-verification',
  verificationResendRateLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Invalid email address')],
  runValidation,
  resendVerificationEmailHandler
);

router.post('/address', protect, addAddress);
router.delete('/address/:addressId', protect, removeAddress);

module.exports = router;
