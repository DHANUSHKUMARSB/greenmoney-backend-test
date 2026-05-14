import { api } from './api';
import { firebaseProfileService } from './firebaseProfileService';
import { logger } from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATION_KEY = 'profile_migration_v1_complete';

export const profileMigrationService = {
  /**
   * Migrates profile data from MongoDB to Firebase Firestore.
   * Only runs once per user per device.
   */
  async migrateIfNeeded(userId: string) {
    try {
      const isComplete = await AsyncStorage.getItem(`${MIGRATION_KEY}_${userId}`);
      if (isComplete === 'true') return;

      logger.sync(`[MIGRATION]: Checking for MongoDB profile data for ${userId}...`);
      
      // 1. Fetch from MongoDB (null payload signals a fetch)
      let mongoProfile;
      try {
        mongoProfile = await api.syncProfile(userId, null);
      } catch (e) {
        logger.warn('[MIGRATION]: Could not reach MongoDB for migration. Will retry later.');
        return; // Exit and retry next time
      }
      
      if (mongoProfile) {
        logger.sync(`[MIGRATION]: Found profile in MongoDB. Migrating to Firebase...`);
        
        // 2. Ensure Firebase profile exists with MongoDB data
        try {
          await firebaseProfileService.ensureProfile(userId, {
            email: mongoProfile.email,
            username: mongoProfile.username || 'User',
            displayName: mongoProfile.username || 'User',
            profilePhoto: mongoProfile.profile_image || null,
          });
        } catch (e) {
          logger.warn('[MIGRATION]: Firebase unreachable for migration. Will retry later.');
          return; // Exit and retry next time
        }

        logger.sync(`[MIGRATION]: Profile migration complete for ${userId}.`);
      } else {
        logger.sync(`[MIGRATION]: No legacy profile found in MongoDB. Skipping.`);
      }

      // 3. Mark as complete
      await AsyncStorage.setItem(`${MIGRATION_KEY}_${userId}`, 'true');
    } catch (error) {
      logger.error('[MIGRATION]: Profile migration failed', error);
      // We don't block app startup for migration failure, but we log it.
    }
  }
};
