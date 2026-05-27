const express = require('express');
const router = express.Router();
const { addOrderItems, getOrderById, updateOrderToPaid, getMyOrders, getAllOrders, updateOrderStatus, getOrderTracking, addOrderTrackingEvent } = require('../controllers/orderController');
const { quoteOrder } = require('../controllers/quoteController');
const { protect, admin } = require('../middleware/authMiddleware');
const { check } = require('express-validator');
const { runValidation } = require('../middleware/validateMiddleware');
const {
  validateOrderListQuery,
  validateObjectId,
  handleValidationErrors,
} = require('../middleware/inputValidationMiddleware');

router.route('/quote').post(
  protect,
  [
    check('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
    check('promoCode').optional().isString().trim().isLength({ min: 2, max: 32 }).withMessage('Invalid promo code'),
  ],
  runValidation,
  quoteOrder
);

router.route('/').post(
	protect,
	[
		check('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
		// Totals are computed server-side. Do not require client-provided totals.
		check('promoCode').optional().isString().trim().isLength({ min: 2, max: 32 }).withMessage('Invalid promo code'),
		check('paymentMethod')
			.customSanitizer((value) => {
				if (typeof value !== 'string') return value;
				const normalized = value.trim().toLowerCase();
				if (normalized === 'cod') return 'COD';
				if (normalized === 'razorpay' || normalized === 'upi' || normalized === 'card') return 'Razorpay';
				return value;
			})
			.isIn(['Razorpay', 'COD'])
			.withMessage('Invalid payment method')
	],
	runValidation,
	addOrderItems
);
router.route('/myorders').get(protect, validateOrderListQuery, getMyOrders);
router.route('/all').get(protect, admin, validateOrderListQuery, getAllOrders);
router.route('/:id').get(protect, validateObjectId, handleValidationErrors, getOrderById);
router.route('/:id/pay').put(protect, validateObjectId, handleValidationErrors, updateOrderToPaid);
router.route('/:id/status').put(protect, admin, validateObjectId, handleValidationErrors, updateOrderStatus);
router.route('/:id/tracking')
  .get(protect, validateObjectId, handleValidationErrors, getOrderTracking)
  .post(protect, admin, validateObjectId, handleValidationErrors, addOrderTrackingEvent);

module.exports = router;
