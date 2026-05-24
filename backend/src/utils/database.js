const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required. Use the single root .env file to switch DEV/TEST.");
  }

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  });

  console.log(`[BACKEND] Connected to MongoDB: ${mongoose.connection.name}`);
};

module.exports = { connectDB };
