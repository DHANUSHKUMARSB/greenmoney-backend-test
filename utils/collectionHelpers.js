const mongoose = require("mongoose");

/**
 * Validates and sanitizes the userId to prevent injection attacks
 * and ensure it's safe for use in collection names.
 */
const sanitizeUserId = (userId) => {
  if (!userId || typeof userId !== 'string') {
    throw new Error("Invalid or missing userId");
  }
  // Allow only alphanumeric characters to prevent injection
  return userId.replace(/[^a-zA-Z0-9]/g, '');
};

/**
 * Generates a dynamic collection name based on userId and type.
 * Format: user_<userId>_<collectionType>
 */
const getUserCollectionName = (userId, collectionType) => {
  const sanitizedId = sanitizeUserId(userId);
  return `user_${sanitizedId}_${collectionType}`;
};

/**
 * Gets or creates a dynamic model for a user-specific collection.
 * @param {string} userId - The unique identifier for the user.
 * @param {string} collectionType - The type of data (e.g., 'transactions', 'settings').
 * @param {mongoose.Schema} schema - The Mongoose schema to use for this collection.
 */
const getUserModel = (userId, collectionType, schema) => {
  const collectionName = getUserCollectionName(userId, collectionType);
  
  // Return existing model if already compiled, otherwise create new one
  return mongoose.models[collectionName] || mongoose.model(collectionName, schema, collectionName);
};

// Supported Collection Types (for reference and validation if needed)
const COLLECTION_TYPES = {
  TRANSACTIONS: "transactions",
  SETTINGS: "settings",
  PROFILE: "profile",
  BUDGETS: "budgets",
  GOALS: "goals",
  NOTIFICATIONS: "notifications",
  ACCOUNTS: "accounts",
  SYNC_METADATA: "sync_metadata",
  FEATURE_FLAGS: "feature_flags",
  AI_INSIGHTS: "ai_insights"
};

module.exports = {
  getUserCollectionName,
  getUserModel,
  COLLECTION_TYPES
};
