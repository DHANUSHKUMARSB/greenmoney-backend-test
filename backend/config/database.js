const mongoose = require("mongoose");

/**
 * Centralized Database Configuration
 * Connects to the MongoDB cluster and enables dynamic database switching.
 */

const NODE_ENV = process.env.NODE_ENV || "development";

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not defined in environment variables.");
    process.exit(1);
  }

  try {
    // Production Safety Warning
    if (NODE_ENV === "production") {
      console.log("\x1b[41m\x1b[37m%s\x1b[0m", "⚠️  WARNING: CONNECTING TO PRODUCTION CLUSTER  ⚠️");
    }

    // Connect to the cluster
    const dbName = NODE_ENV === "production" ? "GreenMoneyProd" : "GreenMoneyDev";
    await mongoose.connect(uri, {
      dbName: dbName,
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ Connected to MongoDB Cluster (${NODE_ENV} mode)`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = { connectDB };
