const mongoose = require("mongoose");

const dbCache = new Map();

/**
 * Resolves a sanitized database name for a specific user.
 * @param {string} userId 
 * @returns {string}
 */
const getDbName = (userId) => {
  const prefix = process.env.NODE_ENV === "production" ? "GreenMoneyProd" : "GreenMoneyDev";
  // Sanitize userId - remove non-alphanumeric
  const sanitizedId = userId.replace(/[^a-zA-Z0-9]/g, "");
  return `${prefix}_${sanitizedId}`;
};

/**
 * Gets a database connection for a specific user, creating it if necessary.
 * @param {string} userId 
 * @returns {mongoose.Connection}
 */
const getUserDb = (userId) => {
  const dbName = getDbName(userId);
  
  if (dbCache.has(dbName)) {
    return dbCache.get(dbName);
  }

  // useDb creates a new connection that shares the same pool
  const userDb = mongoose.connection.useDb(dbName, { useCache: true });
  dbCache.set(dbName, userDb);
  
  console.log(`[DB-MANAGER]: Initialized isolated DB context for user: ${userId} -> ${dbName}`);
  return userDb;
};

module.exports = {
  getUserDb,
  getDbName
};
