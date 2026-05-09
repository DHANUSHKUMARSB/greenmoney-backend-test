require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Support large sync batches

// --- SECURITY & PERFORMANCE MIDDLEWARE ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // Limit each IP to 1000 requests per window
});
app.use("/sync/", limiter);

// MongoDB Connection with Performance Tuning
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log("Connected to MongoDB Atlas (Optimized)"))
  .catch(err => console.error("MongoDB connection error:", err));

// --- SCHEMAS (With Optimized Indexing) ---

const transactionSchema = new mongoose.Schema({
  local_id: { type: String, required: true },
  user_id: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['income', 'expense', 'transfer'], required: true },
  category: { type: String, required: true },
  description: { type: String, default: "" },
  date: { type: String, required: true },
  version: { type: Number, default: 1 },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null }
}, { timestamps: true });

// CRITICAL: High-performance indexes
transactionSchema.index({ local_id: 1 }, { unique: true });
transactionSchema.index({ user_id: 1 });
transactionSchema.index({ updated_at: -1 });

const profileSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  settings: {
    theme: { type: String, default: 'system' },
    accent_color: { type: String, default: '#2196F3' },
    currency: { type: String, default: 'INR' },
    reminders_enabled: { type: Boolean, default: false },
    reminder_time: { type: String, default: '09:00' },
    pin_enabled: { type: Boolean, default: false }
  },
  categories: Array,
  accounts: Array,
  last_sync: { type: Date, default: Date.now }
}, { timestamps: true });

profileSchema.index({ user_id: 1 });

// --- DYNAMIC MODEL HELPERS ---

const getTransactionModel = (userId) => {
  const sanitizedId = userId.replace(/[^a-zA-Z0-9]/g, '');
  const collectionName = `transactions_${sanitizedId}`;
  return mongoose.models[collectionName] || mongoose.model(collectionName, transactionSchema, collectionName);
};

const getProfileModel = (userId) => {
  const sanitizedId = userId.replace(/[^a-zA-Z0-9]/g, '');
  const collectionName = `profile_${sanitizedId}`;
  return mongoose.models[collectionName] || mongoose.model(collectionName, profileSchema, collectionName);
};

// --- SYNC ENDPOINTS ---

app.post("/sync/profile", async (req, res) => {
  try {
    const { userId, data } = req.body;
    const Profile = getProfileModel(userId);
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
    res.status(500).json({ error: "Profile sync failed" });
  }
});

app.post("/sync/push", async (req, res) => {
  try {
    const { userId, transactions } = req.body;
    const UserTransaction = getTransactionModel(userId);
    
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

    await UserTransaction.bulkWrite(bulkOps);
    res.json({ synced: transactions.map(t => t.id), conflicts: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/sync/pull", async (req, res) => {
  try {
    const { userId, lastSyncTime } = req.query;
    const UserTransaction = getTransactionModel(userId);
    const query = lastSyncTime ? { updated_at: { $gt: new Date(lastSyncTime) } } : {};
    
    // Performance: use .lean() for faster, read-only JSON fetching
    const updates = await UserTransaction.find(query).lean().limit(500);
    res.json(updates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Production Sync Server listening on port ${PORT}`));
