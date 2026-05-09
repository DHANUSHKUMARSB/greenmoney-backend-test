const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

// --- ENVIRONMENT CONFIGURATION ---
const NODE_ENV = process.env.NODE_ENV || "development";

// Load local .env file if it exists (mainly for local development)
const envPath = path.resolve(__dirname, `.env.${NODE_ENV}`);
require('dotenv').config({ path: envPath });

// Fallback to standard .env if specific one not found
require('dotenv').config(); 

const { connectDB } = require("./config/database");
const UserService = require("./services/UserService");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Support large sync batches

// --- DATABASE CONNECTION ---
connectDB();

// --- SECURITY & PERFORMANCE MIDDLEWARE ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // Limit each IP to 1000 requests per window
});
app.use("/sync", limiter);

// --- SYNC ENDPOINTS ---

/**
 * Profile/Settings Sync
 */
app.post("/sync/profile", async (req, res) => {
  try {
    const { userId, data } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const Profile = UserService.getUserProfileCollection(userId);
    let cloudProfile = await Profile.findOne({ user_id: userId }).lean();

    if (!data) return res.json(cloudProfile || {});

    // Bulk Update Pattern
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
 * Transactions Push (Upload to Cloud)
 */
app.post("/sync/push", async (req, res) => {
  try {
    const { userId, transactions } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    
    const UserTransaction = UserService.getUserTransactionsCollection(userId);
    
    // Optimization: Bulk Write Operation (MUCH faster than one-by-one)
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

    if (bulkOps.length > 0) {
      await UserTransaction.bulkWrite(bulkOps);
    }
    
    res.json({ synced: transactions.map(t => t.id), conflicts: [] });
  } catch (error) {
    console.error("Push sync error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Transactions Pull (Download from Cloud)
 */
app.get("/sync/pull", async (req, res) => {
  try {
    const { userId, lastSyncTime } = req.query;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const UserTransaction = UserService.getUserTransactionsCollection(userId);
    const query = lastSyncTime ? { updated_at: { $gt: new Date(lastSyncTime) } } : {};
    
    // Performance: use .lean() for faster, read-only JSON fetching
    const updates = await UserTransaction.find(query).lean().limit(500);
    res.json(updates);
  } catch (error) {
    console.error("Pull sync error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generic Sync for future collections (Budgets, Goals, etc.)
 */
app.post("/sync/:collectionType", async (req, res) => {
  try {
    const { userId, data } = req.body;
    const { collectionType } = req.params;
    
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const Collection = UserService.getGenericCollection(userId, collectionType);
    
    // Simple upsert logic for generic data
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

app.get("/health", (req, res) => res.json({ 
  status: "ok", 
  env: NODE_ENV,
  timestamp: new Date() 
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 GreenMoney Backend [${NODE_ENV}] listening on port ${PORT}`);
  if (NODE_ENV === "production") {
    console.log("!!! ATTENTION: SERVER IS RUNNING IN PRODUCTION MODE !!!");
  }
});

