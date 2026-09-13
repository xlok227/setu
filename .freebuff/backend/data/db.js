const mongoose = require('mongoose');

/**
 * Connects to MongoDB using MONGO_URI from the environment.
 * Falls back to a local development database when not configured.
 */
async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/setu_works';

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = { connectDB };
