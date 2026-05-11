const { getUserDb } = require("../utils/databaseManager");
const { COLLECTION_TYPES } = require("../utils/collectionHelpers");
const { transactionSchema, profileSchema, genericSchema } = require("../models/Schemas");

const initializedDbs = new Set();

/**
 * Service to initialize a user's isolated database with required collections and indexes.
 */
const DatabaseInitializer = {
  /**
   * Initializes all standard collections and indexes for a user.
   * @param {string} userId 
   */
  initUserDatabase: async (userId) => {
    if (initializedDbs.has(userId)) return;

    console.log(`[DB-INIT]: Initializing isolated database for user: ${userId}`);
    const userDb = getUserDb(userId);

    try {
      // 1. Transactions Collection & Indexes
      const Transaction = userDb.model("Transaction", transactionSchema, COLLECTION_TYPES.TRANSACTIONS);
      await Transaction.createIndexes(); // Applies indexes from schema
      
      // 2. Profile Collection
      const Profile = userDb.model("Profile", profileSchema, COLLECTION_TYPES.PROFILE);
      await Profile.createIndexes();

      // 3. Other Collections (Initialize them to ensure they exist)
      const otherCollections = [
        { name: "Account", type: COLLECTION_TYPES.ACCOUNTS },
        { name: "Category", type: COLLECTION_TYPES.CATEGORIES },
        { name: "Budget", type: COLLECTION_TYPES.BUDGETS },
        { name: "Goal", type: COLLECTION_TYPES.GOALS },
        { name: "Recurring", type: COLLECTION_TYPES.RECURRING },
        { name: "Notification", type: COLLECTION_TYPES.NOTIFICATIONS }
      ];

      for (const col of otherCollections) {
        const Model = userDb.model(col.name, genericSchema, col.type);
        await Model.createIndexes();
      }
      
      initializedDbs.add(userId);
      console.log(`[DB-INIT]: Successfully initialized collections for user: ${userId}`);
    } catch (error) {
      console.error(`[DB-INIT]: Failed to initialize database for user ${userId}:`, error);
      throw error;
    }
  }
};

module.exports = DatabaseInitializer;
