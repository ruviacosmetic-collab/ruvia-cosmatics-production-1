const express = require('express');
const router = express.Router();
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { protect, admin } = require('../middleware/authMiddleware');
const { validateUpload } = require('../middleware/uploadMiddleware');
const {
  validateProductListQuery,
  validateObjectId,
  handleValidationErrors,
} = require('../middleware/inputValidationMiddleware');

router
  .route('/')
  .get(validateProductListQuery, getProducts)
  .post(protect, admin, validateUpload('image'), createProduct);

router
  .route('/:id')
  .get(validateObjectId, handleValidationErrors, getProductById)
  .put(protect, admin, validateObjectId, handleValidationErrors, validateUpload('image'), updateProduct)
  .delete(protect, admin, validateObjectId, handleValidationErrors, deleteProduct);

module.exports = router;
