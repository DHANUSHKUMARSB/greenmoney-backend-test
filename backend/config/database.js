const mongoose = require("mongoose");

/**
 * Centralized Database Configuration
 * Connects to the MongoDB cluster and enables dynamic database switching.
 */

const connectDB = async () => {
  let uri = process.env.MONGODB_URI;

  // Force override to test database cluster if it still points to the old dev cluster or if none is specified
  if (!uri || uri.includes("greenmoneydev.mwqbnor.mongodb.net")) {
    console.log("⚠️  Overriding MONGODB_URI to test cluster db: mongodb+srv://GreenMoneyTest:9788@greenmoneytest.ps3cgtb.mongodb.net/");
    uri = "mongodb+srv://GreenMoneyTest:9788@greenmoneytest.ps3cgtb.mongodb.net/";
  }

  try {
    // Connect to the cluster
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ Connected to MongoDB Cluster: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = { connectDB };
