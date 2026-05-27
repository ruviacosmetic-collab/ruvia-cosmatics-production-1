const mongoose = require('mongoose');

const productSchema = mongoose.Schema({
  name: { type: String, required: true },
  id: { type: String, required: true, unique: true, index: true },
  tag: { type: String },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  reviewsCount: { type: Number, default: 0 },
  category: { type: String, required: true },
  image: { type: String, required: true }, // Will store Cloudinary URL
  description: { type: String },
  concern: { type: String },
  ingredients: [{ type: String }],
  usage: { type: String },
  benefits: [{ type: String }],
  countInStock: { type: Number, required: true, default: 0 }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
