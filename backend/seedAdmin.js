require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/userModel');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Check if admin already exists
    const adminExists = await User.findOne({ email: 'admin@ruvia.com' });
    
    if (adminExists) {
      console.log('Admin already exists! Resetting password to admin123 and ensuring role is admin.');
      adminExists.password = 'admin123';
      adminExists.role = 'admin';
      await adminExists.save();
      console.log('Admin credentials updated.');
    } else {
      console.log('Creating new admin user...');
      const adminUser = await User.create({
        name: 'Admin User',
        email: 'admin@ruvia.com',
        password: 'admin123',
        role: 'admin' // Force the role to be admin
      });
      console.log('Admin user created successfully.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
