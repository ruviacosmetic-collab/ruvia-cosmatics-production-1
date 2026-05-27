const mongoose = require('mongoose');
const { setupConnectionEventHandlers } = require('./connectionMonitor');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      console.error('FATAL ERROR: MONGO_URI is not defined in environment variables');
      console.error('Please set MONGO_URI in your .env file before starting the server');
      process.exit(1);
    }

    // Connection pooling configuration
    const options = {
      minPoolSize: 5,
      maxPoolSize: 10,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority',
    };

    const conn = await mongoose.connect(mongoUri, options);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Connection Pool: min=${options.minPoolSize}, max=${options.maxPoolSize}`);

    // Setup connection event handlers
    setupConnectionEventHandlers();
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
