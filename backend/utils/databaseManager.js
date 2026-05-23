const mongoose = require("mongoose");

const dbCache = new Map();

/**
 * Resolves a sanitized database name for a specific user.
 * @param {string} userId 
 * @returns {string}
 */
const getDbName = (userId) => {
  const prefix = "GM";
  // Sanitize userId - remove non-alphanumeric
  const sanitizedId = userId.replace(/[^a-zA-Z0-9]/g, "");
  return `${prefix}_${sanitizedId}`;
};

/**
 * Gets a database connection for a specific user, creating it if necessary.
 * Dynamically checks the database cluster for legacy naming conventions (GM_P_ or GM_D_)
 * to avoid losing existing user accounts.
 * @param {string} userId 
 * @returns {Promise<mongoose.Connection>}
 */
const getUserDb = async (userId) => {
  if (dbCache.has(userId)) {
    return dbCache.get(userId);
  }

  const sanitizedId = userId.replace(/[^a-zA-Z0-9]/g, "");
  let dbName = `GM_${sanitizedId}`; // Default new format

  // Safely check for legacy databases in the cluster
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const admin = mongoose.connection.db.admin();
      const dbs = await admin.listDatabases();
      const dbNamesInCluster = dbs.databases.map(d => d.name);

      const prodLegacy = `GM_P_${sanitizedId}`;
      const devLegacy = `GM_D_${sanitizedId}`;

      if (dbNamesInCluster.includes(prodLegacy)) {
        dbName = prodLegacy;
      } else if (dbNamesInCluster.includes(devLegacy)) {
        dbName = devLegacy;
      }
    } catch (error) {
      console.error(`[DB-MANAGER]: Failed to list databases, defaulting to ${dbName}. Error:`, error.message);
    }
  }

  // useDb creates a new connection that shares the same pool
  const userDb = mongoose.connection.useDb(dbName, { useCache: true });
  dbCache.set(userId, userDb);
  
  console.log(`[DB-MANAGER]: Initialized isolated DB context for user: ${userId} -> ${dbName}`);
  return userDb;
};

module.exports = {
  getUserDb,
  getDbName
};
