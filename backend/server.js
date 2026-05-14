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
const DatabaseInitializer = require("./services/DatabaseInitializer");
const AppVersionService = require("./services/AppVersionService");
const UserTrackingService = require("./services/UserTrackingService");

const app = express();

// Required for express-rate-limit to work behind Render/proxies
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: "50mb" }));


// --- REQUEST LOGGER ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get("/", (req, res) => res.json({ status: "GreenMoney Backend Alive" }));


// --- DATABASE CONNECTION ---
connectDB().then(async () => {
  console.log("🚀 Server database initialization complete.");
});

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
 * App Version Check (For Force Updates)
 */
app.get("/app-version", async (req, res) => {
  try {
    const versionInfo = await AppVersionService.getLatestVersion();
    console.log("[SERVER]: Sending version info response...");
    res.json(versionInfo);
    console.log("[SERVER]: Response sent.");
  } catch (error) {
    console.error("App version fetch error:", error);
    res.status(500).json({ error: "Failed to fetch app version" });
  }
});


/**
 * User Registration Tracking
 */
app.post("/register-tracking", limiter, async (req, res) => {
  try {
    const { userId, email, platform, version } = req.body;
    if (!userId || !email) return res.status(400).json({ error: "userId and email are required" });

    const result = await UserTrackingService.trackUserRegistration({
      userId,
      email,
      signupPlatform: platform,
      appVersion: version
    });

    res.json({
      success: true,
      userNumber: result.userNumber,
      rewardEligible: result.rewardEligible
    });
  } catch (error) {
    console.error("Registration tracking error:", error);
    res.status(500).json({ error: "Failed to track registration" });
  }
});

/**
 * Admin: User Stats
 */
app.get("/user-stats", async (req, res) => {
  try {
    const stats = await UserTrackingService.getUserStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

/**
 * Admin: User Count (Quick)
 */
app.get("/user-count", async (req, res) => {
  try {
    const stats = await UserTrackingService.getUserStats();
    res.json({ count: stats.totalUsers });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch count" });
  }
});

/**
 * Profile Sync
 */
app.post(["/sync/profile", "/sync/profile/"], limiter, async (req, res) => {
  try {
    const { userId, data } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    // Ensure user DB is initialized
    await DatabaseInitializer.initUserDatabase(userId);

    const Profile = await UserService.getUserProfileCollection(userId);
    let cloudProfile = await Profile.findOne({}).lean();

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
        profile_image: data.profile_image || cloudProfile?.profile_image || "",
        settings: { ...(cloudProfile?.settings || {}), ...data.settings },
        last_sync: new Date()
      }
    };

    const result = await Profile.findOneAndUpdate(
      {},
      update,
      { upsert: true, new: true }
    );
    res.json(result);
  } catch (error) {
    console.error("Profile sync error:", error);
    res.status(500).json({ 
      error: "Profile sync failed", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Push Sync
 */
app.post(["/sync/push", "/sync/push/"], limiter, async (req, res) => {
  try {
    const { userId, transactions } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    
    const UserTransaction = await UserService.getUserTransactionsCollection(userId);
    const bulkOps = transactions.map(tx => {
      if (tx.deleted_at) {
        return {
          deleteOne: {
            filter: { 
              $or: [{ id: tx.id }, { local_id: tx.id }]
            }
          }
        };
      }
      return {
        updateOne: {
          filter: { 
            $or: [{ id: tx.id }, { local_id: tx.id }]
          },
          update: { 
            $set: { 
              ...tx, 
              id: tx.id,
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

    const UserTransaction = await UserService.getUserTransactionsCollection(userId);
    const query = { deleted_at: null }; // Filter out soft-deleted items if any
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
      const Collection = await UserService[ServiceMethod](userId);
      
      const bulkOps = items.map(item => {
        const filter = { 
          $or: [{ id: item.id }, { local_id: item.id }]
        };

        if (item.deleted_at) {
          return {
            deleteOne: { filter }
          };
        }
        
        const updateData = { ...item, id: item.id };
        if (item.updated_at) updateData.updated_at = new Date(item.updated_at);
        
        return {
          updateOne: {
            filter,
            update: { $set: updateData },
            upsert: true
          }
        };
      });

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

        // Process Profile (Settings, Username, Avatar)
        if (payload.settings || payload.username || payload.profile_image) {
          const Profile = await UserService.getUserProfileCollection(userId);
          const cloudProfile = await Profile.findOne({}).lean();
          
          const update = { $set: { updated_at: new Date() } };
          let shouldUpdate = false;

          // Only update settings if the incoming payload is newer than the cloud version
          if (payload.settings) {
            const incomingTime = new Date(payload.settings.updated_at || 0).getTime();
            const cloudTime = new Date(cloudProfile?.settings?.updated_at || 0).getTime();
            
            if (incomingTime > cloudTime || !cloudProfile) {
              Object.keys(payload.settings).forEach(key => {
                update.$set[`settings.${key}`] = payload.settings[key];
              });
              shouldUpdate = true;
            }
          }

          if (payload.username && payload.username !== cloudProfile?.username) {
            update.$set.username = payload.username;
            shouldUpdate = true;
          }
          if (payload.profile_image && payload.profile_image !== cloudProfile?.profile_image) {
            update.$set.profile_image = payload.profile_image;
            shouldUpdate = true;
          }

          if (shouldUpdate) {
            const updatedProfile = await Profile.findOneAndUpdate(
              {},
              update,
              { upsert: true, returnDocument: 'after' }
            );
            results.updates.settings = updatedProfile.settings;
            results.updates.username = updatedProfile.username;
            results.updates.profile_image = updatedProfile.profile_image;
          } else if (cloudProfile) {
            // Return cloud data if it was newer
            results.updates.settings = cloudProfile.settings;
            results.updates.username = cloudProfile.username;
            results.updates.profile_image = cloudProfile.profile_image;
          }
        }

    }

    // 2. Process Pulls (Fetch latest items for this user specifically)
    const pullCollection = async (ServiceMethod, resultKey) => {
      const Collection = await UserService[ServiceMethod](userId);
      results.updates[resultKey] = await Collection.find({}).lean().limit(1000);
    };

    await Promise.all([
      pullCollection('getUserTransactionsCollection', 'transactions'),
      pullCollection('getUserCategoriesCollection', 'categories'),
      pullCollection('getUserAccountsCollection', 'accounts'),
      pullCollection('getUserBudgetsCollection', 'budgets'),
      pullCollection('getUserGoalsCollection', 'goals'),
      pullCollection('getUserRecurringTransactionsCollection', 'recurring'),
      // Always pull latest profile/settings to ensure multi-device consistency
      (async () => {
        const Profile = await UserService.getUserProfileCollection(userId);
        const profile = await Profile.findOne({}).lean();
        if (profile) {
          results.updates.settings = profile.settings;
          results.updates.username = profile.username;
          results.updates.profile_image = profile.profile_image;
        }
      })()
    ]);


    res.json(results);
  } catch (error) {
    console.error("Universal sync error:", error);
    res.status(500).json({ 
      error: "Universal sync failed", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
});

// Generic future-proof endpoint
app.post("/sync/:collectionType", limiter, async (req, res) => {
  try {
    const { userId, data } = req.body;
    const { collectionType } = req.params;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const Collection = await UserService.getGenericCollection(userId, collectionType);
    const result = await Collection.findOneAndUpdate(
      {},
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
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 GreenMoney Backend [${NODE_ENV}] listening on port ${PORT} at 0.0.0.0`);
});

