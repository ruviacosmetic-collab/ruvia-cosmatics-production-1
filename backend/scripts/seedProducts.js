const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const Product = require('../models/productModel');
const { products } = require('../../ruvia-cosmatics-main/data/products');

const seedProducts = async () => {
  try {
    await connectDB();

    await Product.deleteMany({});

    const normalizedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      tag: product.tag,
      price: product.price,
      originalPrice: product.originalPrice,
      rating: product.rating,
      reviews: product.reviews,
      reviewsCount: product.reviews,
      category: product.category,
      image: product.image,
      description: product.description,
      concern: product.concern,
      ingredients: product.ingredients,
      usage: product.usage,
      benefits: product.benefits,
      countInStock: product.countInStock || 100,
    }));

    await Product.insertMany(normalizedProducts);

    console.log(`Seeded ${normalizedProducts.length} products`);
    process.exit(0);
  } catch (error) {
    console.error('Seed products failed:', error);
    process.exit(1);
  }
};

seedProducts();
