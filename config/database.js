const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      // Database connection error
    });

    mongoose.connection.on('disconnected', () => {
      // Database disconnected
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      process.exit(0);
    });

  } catch (error) {
    process.exit(1);
  }
};

module.exports = connectDB;