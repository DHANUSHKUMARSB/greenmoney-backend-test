const mongoose = require("mongoose");
const { getUserDb } = require("./databaseManager");

/**
 * Gets or creates a standardized model for a user's isolated collection.
 * @param {string} userId - The unique identifier for the user.
 * @param {string} collectionType - The type of data (e.g., 'transactions', 'settings').
 * @param {mongoose.Schema} schema - The Mongoose schema to use for this collection.
 */
const getUserModel = async (userId, collectionType, schema) => {
  const userDb = await getUserDb(userId);
  
  // Use a capitalized, shared collection name (e.g., 'Transaction', 'Profile')
  const modelName = collectionType.charAt(0).toUpperCase() + collectionType.slice(0, -1); 
  
  // Return existing model if already compiled on this connection, otherwise create new one
  return userDb.models[modelName] || userDb.model(modelName, schema, collectionType);
};

// Supported Collection Types
const COLLECTION_TYPES = {
  TRANSACTIONS: "transactions",
  SETTINGS: "settings",
  PROFILE: "profile",
  BUDGETS: "budgets",
  GOALS: "goals",
  NOTIFICATIONS: "notifications",
  ACCOUNTS: "accounts",
  RECURRING: "recurring",
  CATEGORIES: "categories"
};

module.exports = {
  getUserModel,
  COLLECTION_TYPES
};
