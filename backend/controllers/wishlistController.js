const Wishlist = require('../models/wishlistModel');

// @desc    Save or replace user's wishlist
// @route   POST /api/wishlist
// @access  Private
const saveWishlist = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items) {
      return res.status(400).json({ message: 'Items are required' });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Invalid items format' });
    }

    let wishlist = await Wishlist.findOne({ user: req.user._id });

    if (wishlist) {
      wishlist.items = items;
      await wishlist.save();
    } else {
      wishlist = await Wishlist.create({ user: req.user._id, items });
    }

    res.json(wishlist);
  } catch (error) {
    console.error('Save wishlist error:', error);
    res.status(500).json({ message: 'Server error while saving wishlist' });
  }
};

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    res.json(wishlist || { items: [] });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ message: 'Server error while fetching wishlist' });
  }
};

// @desc    Clear user's wishlist
// @route   DELETE /api/wishlist
// @access  Private
const clearWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ user: req.user._id });
    
    if (wishlist) {
      wishlist.items = [];
      await wishlist.save();
    }

    res.json({ message: 'Wishlist cleared successfully' });
  } catch (error) {
    console.error('Clear wishlist error:', error);
    res.status(500).json({ message: 'Server error while clearing wishlist' });
  }
};

module.exports = {
  saveWishlist,
  getWishlist,
  clearWishlist
};
