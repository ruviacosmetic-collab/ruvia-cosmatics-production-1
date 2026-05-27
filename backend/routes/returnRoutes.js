const express = require('express');
const router = express.Router();
const { createReturnRequest, getMyReturns, getAllReturns, updateReturnStatus } = require('../controllers/returnController');
const { protect, admin } = require('../middleware/authMiddleware');
const { check } = require('express-validator');
const { runValidation } = require('../middleware/validateMiddleware');

router.route('/').post(
  protect,
  [
    check('orderId').notEmpty().withMessage('Order ID is required'),
    check('reason').notEmpty().withMessage('Reason is required')
  ],
  runValidation,
  createReturnRequest
);

router.route('/myreturns').get(protect, getMyReturns);
router.route('/').get(protect, admin, getAllReturns);
router.route('/:id/status').put(protect, admin, updateReturnStatus);

module.exports = router;
