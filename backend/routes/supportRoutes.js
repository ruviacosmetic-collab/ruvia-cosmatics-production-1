const express = require('express');
const router = express.Router();
const { submitContactMessage } = require('../controllers/supportController');

// Public contact endpoint. No auth, no CSRF token required.
router.post('/contact', submitContactMessage);

module.exports = router;
