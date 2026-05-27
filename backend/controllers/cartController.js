const Cart = require('../models/cartModel');
const Product = require('../models/productModel');

// Save or replace the user's cart
const saveCart = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items) {
      return res.status(400).json({ message: 'Items are required' });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Invalid items format' });
    }

    // Verify each item exists and get correct price from database
    const verifiedItems = [];
    for (const item of items) {
      const product = await Product.findOne({ id: String(item.product || item.id) });
      if (!product) {
        return res.status(400).json({ message: `Product ${item.id} not found` });
      }
      
      verifiedItems.push({
        productId: String(product.id),
        id: String(product.id),
        name: product.name,
        price: product.price,  // ✅ Use price from database
        qty: item.quantity || item.qty || 1,
        img: product.image
      });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
      cart.items = verifiedItems;
      await cart.save();
    } else {
      cart = await Cart.create({ user: req.user._id, items: verifiedItems });
    }

    res.json(cart);
  } catch (err) {
    console.error('saveCart error', err);
    res.status(500).json({ message: 'Server error while saving cart' });
  }
};

const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    res.json(cart || { items: [] });
  } catch (err) {
    console.error('getCart error', err);
    res.status(500).json({ message: 'Server error while fetching cart' });
  }
};

module.exports = { saveCart, getCart };
