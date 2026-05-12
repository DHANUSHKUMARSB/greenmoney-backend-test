const mongoose = require("mongoose");
const appVersionSchema = require("../models/AppVersion");

/**
 * Service to handle app versioning and force updates.
 * Uses the shared 'appData' database instead of user-specific isolated databases.
 */
const AppVersionService = {
  /**
   * Fetches the latest app version information.
   * @returns {Promise<Object>}
   */
  getLatestVersion: async () => {
    // Connect to the shared 'appData' database
    const appDataDb = mongoose.connection.useDb("appData", { useCache: true });
    
    // Get the model
    const AppVersion = appDataDb.models.AppVersion || appDataDb.model("AppVersion", appVersionSchema, "app_versions");
    
    // Fetch the most recent version document
    const versionInfo = await AppVersion.findOne().sort({ updatedAt: -1 }).lean();
    
    if (!versionInfo) {
      // Return a default if no version is found in DB yet
      return {
        latestVersion: "1.0.0",
        minimumSupportedVersion: "1.0.0",
        apkUrl: "",
        forceUpdate: false,
        releaseNotes: ["Initial Release"]
      };
    }
    
    return versionInfo;
  }
};

module.exports = AppVersionService;
