const mongoose = require("mongoose");

/**
 * Gets or creates a standardized model for a shared collection.
 * @param {string} userId - UNUSED (Maintained for API compatibility during transition)
 * @param {string} collectionType - The type of data (e.g., 'transactions', 'settings').
 * @param {mongoose.Schema} schema - The Mongoose schema to use for this collection.
 */
const getUserModel = (userId, collectionType, schema) => {
  // Use a capitalized, shared collection name (e.g., 'Transaction', 'Profile')
  const collectionName = collectionType.charAt(0).toUpperCase() + collectionType.slice(0, -1); 
  
  // Return existing model if already compiled, otherwise create new one
  return mongoose.models[collectionName] || mongoose.model(collectionName, schema, collectionType);
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
  RECURRING: "recurring"
};

module.exports = {
  getUserModel,
  COLLECTION_TYPES
};
