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
    try {
      console.log("[AppVersionService]: Fetching from 'app_versions' (Render/Production)...");
      const appDataDb = mongoose.connection.useDb("appData", { useCache: true });
      
      const AppVersion = appDataDb.models.AppVersion || appDataDb.model("AppVersion", appVersionSchema, "app_versions");
      
      const versionInfo = await AppVersion.findOne().sort({ updatedAt: -1 }).lean();
      
      if (!versionInfo) {
        console.warn("[AppVersionService]: No version document found in appData.app_versions");
        return null;
      }

      // If appVersionData is missing (legacy), build it from root fields
      if (!versionInfo.appVersionData && versionInfo.apkUrl) {
        versionInfo.appVersionData = {
          [versionInfo.latestVersion]: {
            version: versionInfo.latestVersion,
            apkUrl: versionInfo.apkUrl,
            releaseNotes: versionInfo.releaseNotes || []
          }
        };
      }
      
      console.log(`[AppVersionService]: Returning version ${versionInfo.latestVersion} from Render Backend.`);
      return versionInfo;
    } catch (error) {
      console.error("[AppVersionService]: Fetch failed:", error);
      throw error;
    }
  }



};

module.exports = AppVersionService;
