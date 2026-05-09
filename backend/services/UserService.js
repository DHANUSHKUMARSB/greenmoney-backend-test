const { getUserModel, COLLECTION_TYPES } = require("../utils/collectionHelpers");
const { transactionSchema, profileSchema, genericSchema } = require("../models/Schemas");

/**
 * Reusable services to get specific user collections.
 * These ensure the correct schema is always applied to the dynamic model.
 */

const UserService = {
  getUserTransactionsCollection: (userId) => {
    return getUserModel(userId, COLLECTION_TYPES.TRANSACTIONS, transactionSchema);
  },

  getUserSettingsCollection: (userId) => {
    return getUserModel(userId, COLLECTION_TYPES.SETTINGS, profileSchema);
  },

  getUserProfileCollection: (userId) => {
    return getUserModel(userId, COLLECTION_TYPES.PROFILE, profileSchema);
  },

  getUserBudgetsCollection: (userId) => {
    return getUserModel(userId, COLLECTION_TYPES.BUDGETS, genericSchema);
  },

  getUserGoalsCollection: (userId) => {
    return getUserModel(userId, COLLECTION_TYPES.GOALS, genericSchema);
  },

  getUserNotificationsCollection: (userId) => {
    return getUserModel(userId, COLLECTION_TYPES.NOTIFICATIONS, genericSchema);
  },

  getUserAccountsCollection: (userId) => {
    return getUserModel(userId, COLLECTION_TYPES.ACCOUNTS, genericSchema);
  },

  getUserCategoriesCollection: (userId) => {
    return getUserModel(userId, COLLECTION_TYPES.CATEGORIES, genericSchema);
  },

  getUserRecurringTransactionsCollection: (userId) => {
    return getUserModel(userId, COLLECTION_TYPES.RECURRING, genericSchema);
  },

  // Generic helper for future collections
  getGenericCollection: (userId, collectionType) => {
    return getUserModel(userId, collectionType, genericSchema);
  }
};

module.exports = UserService;
