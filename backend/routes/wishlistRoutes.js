const express = require('express');
const router = express.Router();
const { saveWishlist, getWishlist, clearWishlist } = require('../controllers/wishlistController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(protect, saveWishlist).get(protect, getWishlist).delete(protect, clearWishlist);

module.exports = router;
