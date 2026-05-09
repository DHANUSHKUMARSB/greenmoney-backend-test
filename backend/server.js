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

    // --- INITIALIZE DEFAULT DATA FOR NEW USERS ---
    const defaultCategories = [
      { id: `cat_food_${userId}`, user_id: userId, name: 'Food', type: 'expense', display_order: 0, updated_at: new Date().toISOString(), version: 1 },
      { id: `cat_transport_${userId}`, user_id: userId, name: 'Transport', type: 'expense', display_order: 1, updated_at: new Date().toISOString(), version: 1 },
      { id: `cat_shopping_${userId}`, user_id: userId, name: 'Shopping', type: 'expense', display_order: 2, updated_at: new Date().toISOString(), version: 1 },
      { id: `cat_salary_${userId}`, user_id: userId, name: 'Salary', type: 'income', display_order: 3, updated_at: new Date().toISOString(), version: 1 },
      { id: `cat_bills_${userId}`, user_id: userId, name: 'Bills', type: 'expense', display_order: 4, updated_at: new Date().toISOString(), version: 1 },
    ];

    const defaultAccounts = [
      { id: `acc_cash_${userId}`, user_id: userId, name: 'Cash', type: 'cash', balance: 0, updated_at: new Date().toISOString(), version: 1 },
      { id: `acc_bank_${userId}`, user_id: userId, name: 'Bank', type: 'bank', balance: 0, updated_at: new Date().toISOString(), version: 1 },
    ];

    if (!data && !cloudProfile) {
      // First time access with no data - Return defaults
      return res.json({
        user_id: userId,
        settings: { theme: 'system', accent_color: '#2196F3', currency: 'INR' },
        categories: defaultCategories,
        accounts: defaultAccounts
      });
    }

    if (!data) return res.json(cloudProfile || {});

    // Bulk Update Pattern
    const update = {
      $set: {
        username: data.username || cloudProfile?.username || "",
        settings: { ...(cloudProfile?.settings || {}), ...data.settings },
        categories: (data.categories && data.categories.length > 0) 
          ? data.categories 
          : ((cloudProfile?.categories && cloudProfile.categories.length > 0) ? cloudProfile.categories : defaultCategories),
        accounts: (data.accounts && data.accounts.length > 0) 
          ? data.accounts 
          : ((cloudProfile?.accounts && cloudProfile.accounts.length > 0) ? cloudProfile.accounts : defaultAccounts),
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
    const bulkOps = transactions.map(tx => {
      if (tx.deleted_at) {
        return {
          deleteOne: {
            filter: { local_id: tx.id, user_id: userId }
          }
        };
      }
      return {
        updateOne: {
          filter: { local_id: tx.id, user_id: userId },
          update: { 
            $set: { 
              ...tx, 
              user_id: userId,
              local_id: tx.id,
              updated_at: new Date(tx.updated_at),
              deleted_at: null 
            } 
          },
          upsert: true
        }
      };
    });

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
    const query = { user_id: userId };
    if (lastSyncTime) query.updated_at = { $gt: new Date(lastSyncTime) };
    
    const updates = await UserTransaction.find(query).lean().limit(500);
    res.json(updates);
  } catch (error) {
    console.error("Pull sync error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * UNIVERSAL SYNC (Real-Time Engine)
 * Handles all collections in a single atomic trip.
 */
app.post("/sync/universal", limiter, async (req, res) => {
  try {
    const { userId, payload } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const results = {
      success_ids: {
        transactions: [],
        categories: [],
        accounts: [],
        budgets: [],
        goals: [],
        recurring: []
      },
      updates: {
        transactions: [],
        categories: [],
        accounts: [],
        budgets: [],
        goals: [],
        recurring: [],
        settings: null
      }
    };

    // Helper to process bulk updates for a collection
    const processCollection = async (items, collectionType, ServiceMethod, resultKey) => {
      if (!items || items.length === 0) return;
      const Collection = UserService[ServiceMethod](userId);
      
      const bulkOps = items.map(item => ({
        updateOne: {
          filter: { id: item.id },
          update: { $set: { ...item, user_id: userId, updated_at: new Date(item.updated_at) } },
          upsert: true
        }
      }));

      await Collection.bulkWrite(bulkOps);
      results.success_ids[resultKey] = items.map(i => i.id);
    };

    // 1. Process Pushes
    if (payload) {
      await Promise.all([
        processCollection(payload.transactions, 'transactions', 'getUserTransactionsCollection', 'transactions'),
        processCollection(payload.categories, 'categories', 'getUserCategoriesCollection', 'categories'),
        processCollection(payload.accounts, 'accounts', 'getUserAccountsCollection', 'accounts'),
        processCollection(payload.budgets, 'budgets', 'getUserBudgetsCollection', 'budgets'),
        processCollection(payload.goals, 'goals', 'getUserGoalsCollection', 'goals'),
        processCollection(payload.recurring, 'recurring', 'getUserRecurringTransactionsCollection', 'recurring'),
      ]);

      // Process Settings separately (Profile Collection)
      if (payload.settings) {
        const Profile = UserService.getUserProfileCollection(userId);
        const updatedProfile = await Profile.findOneAndUpdate(
          { user_id: userId },
          { $set: { settings: payload.settings, updated_at: new Date() } },
          { upsert: true, new: true }
        );
        results.updates.settings = updatedProfile.settings;
      }
    }

    // 2. Process Pulls (Fetch latest items for this user specifically)
    const pullCollection = async (ServiceMethod, resultKey) => {
      const Collection = UserService[ServiceMethod](userId);
      results.updates[resultKey] = await Collection.find({ user_id: userId }).lean().limit(1000);
    };

    await Promise.all([
      pullCollection('getUserTransactionsCollection', 'transactions'),
      pullCollection('getUserCategoriesCollection', 'categories'),
      pullCollection('getUserAccountsCollection', 'accounts'),
      pullCollection('getUserBudgetsCollection', 'budgets'),
      pullCollection('getUserGoalsCollection', 'goals'),
      pullCollection('getUserRecurringTransactionsCollection', 'recurring'),
    ]);

    res.json(results);
  } catch (error) {
    console.error("Universal sync error:", error);
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
