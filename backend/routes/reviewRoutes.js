const express = require('express');
const router = express.Router();
const { createReview, getProductReviews, getMyReviews, deleteReview, getAllReviews } = require('../controllers/reviewController');
const { protect, admin } = require('../middleware/authMiddleware');
const { check } = require('express-validator');
const { runValidation } = require('../middleware/validateMiddleware');

router.route('/').post(
  protect,
  [
    check('productId').notEmpty().withMessage('Product ID is required'),
    check('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    check('comment').notEmpty().withMessage('Comment is required'),
    check('name').notEmpty().withMessage('Name is required')
  ],
  runValidation,
  createReview
);

router.route('/product/:productId').get(getProductReviews);
router.route('/myreviews').get(protect, getMyReviews);
router.route('/all').get(protect, admin, getAllReviews);
router.route('/:id').delete(protect, deleteReview);

module.exports = router;
