const Product = require('../models/productModel');
const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose');
const auditLogger = require('../utils/auditLogger');
const {
  calculatePagination,
  formatSimplePaginatedResponse,
} = require('../utils/paginationUtil');

// Fields captured in audit logs for product create/update/delete events.
// Excludes binary/large fields and any system-managed metadata.
const AUDITABLE_PRODUCT_FIELDS = [
  'id',
  'name',
  'price',
  'originalPrice',
  'category',
  'description',
  'countInStock',
  'tag',
  'rating',
  'reviews',
  'reviewsCount',
  'concern',
  'ingredients',
  'usage',
  'benefits',
  'image',
];

const snapshotProduct = (product) => {
  if (!product) return null;
  const source = typeof product.toObject === 'function' ? product.toObject() : product;
  const snapshot = {};
  for (const field of AUDITABLE_PRODUCT_FIELDS) {
    if (source[field] !== undefined) snapshot[field] = source[field];
  }
  return snapshot;
};

const slugify = (value = '') => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const { skip, limit, page } = calculatePagination(req.query.page, req.query.limit);
    const sort = req.query.sort || '-createdAt';
    const { category, search } = req.query;

    const query = {};
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query).sort(sort).skip(skip).limit(limit),
    ]);

    res.json(formatSimplePaginatedResponse(products, page, limit, total));
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error while fetching products' });
  }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id });

    if (product) {
      res.json(product);
      return;
    }

    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      const fallbackProduct = await Product.findById(req.params.id);

      if (fallbackProduct) {
        res.json(fallbackProduct);
        return;
      }
    }

    res.status(404).json({ message: 'Product not found' });
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({ message: 'Server error while fetching product' });
  }
};

// @desc    Create a product (Admin)
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({ message: 'Image upload is disabled (Cloudinary not configured)' });
    }

    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    // Validate file type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: 'Only JPEG, PNG, and WebP images are allowed' });
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return res.status(400).json({ message: 'Image size must be less than 5MB' });
    }

    let imageUrl = '';

    try {
      // Convert buffer to base64 for Cloudinary upload
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

      const uploadResponse = await cloudinary.uploader.upload(dataURI, {
        folder: 'ruvia_products',
        resource_type: 'auto',
        quality: 'auto',
        fetch_format: 'auto'
      });

      imageUrl = uploadResponse.secure_url;
      console.log('✅ Image uploaded to Cloudinary:', imageUrl);
    } catch (cloudinaryError) {
      console.error('Cloudinary upload error:', cloudinaryError);
      return res.status(500).json({ message: 'Failed to upload image to Cloudinary', error: cloudinaryError.message });
    }

    const { name, price, category, description, countInStock, originalPrice, tag, id, rating, reviews, reviewsCount, concern, ingredients, usage, benefits } = req.body;

    // Validate required fields
    if (!name || !price || !category) {
      return res.status(400).json({ message: 'Name, price, and category are required' });
    }

    const product = new Product({
      id: id || slugify(name),
      name,
      price: parseFloat(price),
      category,
      image: imageUrl,
      description,
      countInStock: parseInt(countInStock) || 0,
      originalPrice: originalPrice ? parseFloat(originalPrice) : parseFloat(price),
      tag,
      rating: rating ? parseFloat(rating) : 0,
      reviews: reviews ? parseInt(reviews) : 0,
      reviewsCount: reviewsCount ? parseInt(reviewsCount) : 0,
      concern,
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      usage,
      benefits: Array.isArray(benefits) ? benefits : []
    });

    const createdProduct = await product.save();

    auditLogger.logAdminAction({
      adminId: req.user?._id,
      action: 'create',
      resource: 'product',
      resourceId: createdProduct._id,
      changes: { after: snapshotProduct(createdProduct) },
      ipAddress: req.ip,
    });

    res.status(201).json(createdProduct);

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
};

// @desc    Update a product (Admin)
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(503).json({ message: 'Image upload is disabled (Cloudinary not configured)' });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const beforeSnapshot = snapshotProduct(product);

    let imageUrl = product.image;

    // Handle image update if provided
    if (req.file) {
      // Validate file type
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Only JPEG, PNG, and WebP images are allowed' });
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({ message: 'Image size must be less than 5MB' });
      }

      try {
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const uploadResponse = await cloudinary.uploader.upload(dataURI, {
          folder: 'ruvia_products',
          resource_type: 'auto',
          quality: 'auto',
          fetch_format: 'auto'
        });

        imageUrl = uploadResponse.secure_url;
        console.log('✅ Image updated in Cloudinary:', imageUrl);
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        return res.status(500).json({ message: 'Failed to upload image to Cloudinary', error: cloudinaryError.message });
      }
    }

    const { name, price, category, description, countInStock, originalPrice, tag, id, rating, reviews, reviewsCount, concern, ingredients, usage, benefits } = req.body;

    // Update only provided fields
    if (name) product.name = name;
    if (price) product.price = parseFloat(price);
    if (category) product.category = category;
    if (description) product.description = description;
    if (countInStock !== undefined) product.countInStock = parseInt(countInStock);
    if (originalPrice) product.originalPrice = parseFloat(originalPrice);
    if (tag) product.tag = tag;
    if (id) product.id = id;
    if (rating !== undefined) product.rating = parseFloat(rating);
    if (reviews !== undefined) product.reviews = parseInt(reviews);
    if (reviewsCount !== undefined) product.reviewsCount = parseInt(reviewsCount);
    if (concern) product.concern = concern;
    if (ingredients) product.ingredients = Array.isArray(ingredients) ? ingredients : [];
    if (usage) product.usage = usage;
    if (benefits) product.benefits = Array.isArray(benefits) ? benefits : [];

    product.image = imageUrl;

    const updatedProduct = await product.save();

    auditLogger.logAdminAction({
      adminId: req.user?._id,
      action: 'update',
      resource: 'product',
      resourceId: updatedProduct._id,
      changes: { before: beforeSnapshot, after: snapshotProduct(updatedProduct) },
      ipAddress: req.ip,
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error while updating product', error: error.message });
  }
};

// @desc    Delete a product (Admin)
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await Product.findByIdAndDelete(req.params.id);

    auditLogger.logAdminAction({
      adminId: req.user?._id,
      action: 'delete',
      resource: 'product',
      resourceId: product._id,
      changes: { before: snapshotProduct(product) },
      ipAddress: req.ip,
    });

    res.json({ message: 'Product removed successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error while deleting product' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
