const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wow_interactive';
  try {
    const conn = await mongoose.connect(uri);
    console.log(`[MongoDB] Connected to database: ${conn.connection.name} at ${conn.connection.host}:${conn.connection.port}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    console.warn(`[MongoDB] Please ensure MongoDB is running at ${uri}.`);
    return null;
  }
};


module.exports = connectDB;
