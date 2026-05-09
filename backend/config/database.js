const mongoose = require("mongoose");

/**
 * Centralized Database Configuration
 * Supports dynamic production/test database switching based on NODE_ENV
 */

const NODE_ENV = process.env.NODE_ENV || "development";
const DB_NAME = NODE_ENV === "production" ? "production" : "test";

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not defined in environment variables.");
    process.exit(1);
  }

  try {
    // Production Safety Warning
    if (NODE_ENV === "production") {
      console.log("\x1b[41m\x1b[37m%s\x1b[0m", "⚠️  WARNING: CONNECTING TO PRODUCTION DATABASE  ⚠️");
    }

    await mongoose.connect(uri, {
      dbName: DB_NAME,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ Connected to MongoDB [${DB_NAME}] (${NODE_ENV} mode)`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = { connectDB, DB_NAME };
