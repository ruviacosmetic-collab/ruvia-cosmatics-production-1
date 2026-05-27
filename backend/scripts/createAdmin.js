const mongoose = require('mongoose');
const User = require('../models/userModel');
require('dotenv').config();

const createAdmin = async () => {
  try {
    // Check for admin password in environment variable
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('ERROR: ADMIN_PASSWORD environment variable is not set');
      console.error('Please set ADMIN_PASSWORD before running this script');
      console.error('Example: ADMIN_PASSWORD=your_secure_password node scripts/createAdmin.js');
      process.exit(1);
    }

    // Validate password strength
    if (adminPassword.length < 8) {
      console.error('ERROR: Admin password must be at least 8 characters');
      process.exit(1);
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@ruvia.com' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@ruvia.com',
      password: adminPassword,
      role: 'admin'
    });

    console.log('Admin user created successfully:');
    console.log('Email: admin@ruvia.com');
    console.log('Role: admin');
    console.log('Password: [HIDDEN - Set via ADMIN_PASSWORD environment variable]');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

createAdmin();
