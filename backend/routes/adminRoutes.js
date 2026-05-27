const express = require('express');
const router = express.Router();

const { protect, admin } = require('../middleware/authMiddleware');
const {
  validateObjectId,
  handleValidationErrors,
} = require('../middleware/inputValidationMiddleware');
const {
  getAdminDashboard,
  blockUser,
  unblockUser,
} = require('../controllers/adminController');

// @desc    Admin dashboard aggregated stats
// @route   GET /api/admin/dashboard?range=7d|30d|90d&lowStockThreshold=5
// @access  Private/Admin
router.get('/dashboard', protect, admin, getAdminDashboard);

// @desc    Block a user account
// @route   POST /api/admin/users/:id/block
// @access  Private/Admin
router.post(
  '/users/:id/block',
  protect,
  admin,
  validateObjectId,
  handleValidationErrors,
  blockUser
);

// @desc    Unblock a user account
// @route   POST /api/admin/users/:id/unblock
// @access  Private/Admin
router.post(
  '/users/:id/unblock',
  protect,
  admin,
  validateObjectId,
  handleValidationErrors,
  unblockUser
);

module.exports = router;
