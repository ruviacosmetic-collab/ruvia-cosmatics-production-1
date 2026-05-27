require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/productModel');

const testDB = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Successfully connected to MongoDB Atlas!');

    console.log('Testing Write operation...');
    const testProduct = new Product({
      name: 'Test Serum',
      price: 1999,
      category: 'Test Category',
      image: 'https://example.com/test.png',
      countInStock: 10
    });
    const savedProduct = await testProduct.save();
    console.log(`✅ Successfully wrote product to DB. ID: ${savedProduct._id}`);

    console.log('Testing Read operation...');
    const fetchedProduct = await Product.findById(savedProduct._id);
    console.log(`✅ Successfully read product from DB. Name: ${fetchedProduct.name}`);

    console.log('Cleaning up (Deleting test data)...');
    await Product.findByIdAndDelete(savedProduct._id);
    console.log('✅ Successfully deleted test data.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database Test Failed:', error);
    process.exit(1);
  }
};

testDB();
