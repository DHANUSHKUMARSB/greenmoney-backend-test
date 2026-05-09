const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const mongoose = require("mongoose");

// --- ENVIRONMENT CONFIGURATION ---
const NODE_ENV = process.env.NODE_ENV || "development";

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, `.env.${NODE_ENV}`) });
require('dotenv').config(); // Fallback

const { connectDB } = require("./config/database");
const UserService = require("./services/UserService");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// --- REQUEST LOGGER ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- DATABASE CONNECTION ---
connectDB();

// --- SECURITY ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});

// --- SYNC ENDPOINTS (DIRECT) ---

/**
 * Health Check
 */
app.get("/health", (req, res) => res.json({ 
  status: "ok", 
  env: NODE_ENV,
  db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  timestamp: new Date() 
}));

/**
 * Profile Sync
 */
app.post(["/sync/profile", "/sync/profile/"], limiter, async (req, res) => {
  try {
    const { userId, data } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const Profile = UserService.getUserProfileCollection(userId);
    let cloudProfile = await Profile.findOne({ user_id: userId }).lean();

    if (!data) return res.json(cloudProfile || {});

    const update = {
      $set: {
        settings: { ...(cloudProfile?.settings || {}), ...data.settings },
        categories: data.categories || cloudProfile?.categories || [],
        accounts: data.accounts || cloudProfile?.accounts || [],
        last_sync: new Date()
      }
    };

    const result = await Profile.findOneAndUpdate(
      { user_id: userId },
      update,
      { upsert: true, new: true }
    );
    res.json(result);
  } catch (error) {
    console.error("Profile sync error:", error);
    res.status(500).json({ error: "Profile sync failed" });
  }
});

/**
 * Push Sync
 */
app.post(["/sync/push", "/sync/push/"], limiter, async (req, res) => {
  try {
    const { userId, transactions } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    
    const UserTransaction = UserService.getUserTransactionsCollection(userId);
    const bulkOps = transactions.map(tx => ({
      updateOne: {
        filter: { local_id: tx.id },
        update: { 
          $set: { 
            ...tx, 
            local_id: tx.id,
            updated_at: new Date(tx.updated_at),
            deleted_at: tx.deleted_at ? new Date(tx.deleted_at) : null 
          } 
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) await UserTransaction.bulkWrite(bulkOps);
    res.json({ synced: transactions.map(t => t.id), conflicts: [] });
  } catch (error) {
    console.error("Push sync error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Pull Sync
 */
app.get(["/sync/pull", "/sync/pull/"], limiter, async (req, res) => {
  try {
    const { userId, lastSyncTime } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const UserTransaction = UserService.getUserTransactionsCollection(userId);
    const query = lastSyncTime ? { updated_at: { $gt: new Date(lastSyncTime) } } : {};
    const updates = await UserTransaction.find(query).lean().limit(500);
    res.json(updates);
  } catch (error) {
    console.error("Pull sync error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Generic future-proof endpoint
app.post("/sync/:collectionType", limiter, async (req, res) => {
  try {
    const { userId, data } = req.body;
    const { collectionType } = req.params;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const Collection = UserService.getGenericCollection(userId, collectionType);
    const result = await Collection.findOneAndUpdate(
      { user_id: userId },
      { $set: { ...data, last_sync: new Date() } },
      { upsert: true, new: true }
    );
    res.json(result);
  } catch (error) {
    console.error(`${req.params.collectionType} sync error:`, error);
    res.status(500).json({ error: "Sync failed" });
  }
});

// --- 404 HANDLER (With Logging) ---
app.use((req, res) => {
  console.log(`❌ 404 ERROR: Path not found - ${req.method} ${req.url}`);
  res.status(404).json({ error: `Path not found: ${req.url}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 GreenMoney Backend [${NODE_ENV}] listening on port ${PORT}`);
});
