const express = require('express');
const router = express.Router();
const { saveCart, getCart } = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, saveCart);
router.get('/', protect, getCart);

module.exports = router;
