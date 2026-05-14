import { settingsSyncService } from './settingsSyncService';
import { useAppStore } from '../store';
import { useThemeStore } from '../store/themeStore';

import { logger } from '../utils/logger';
import { syncEvents } from './syncEvents';

export const settingsService = {
  /**
   * Initializes settings on app startup.
   * Priority: Cloud > Local Cache > Defaults
   */
  async initializeSettings() {
    console.log('[SETTINGS]: Service initializing...');
    try {
      // 1. Try to sync with cloud immediately
      const success = await settingsSyncService.sync(false);
      
      if (success) {
        console.log('[SETTINGS]: Cloud sync successful.');
      } else {
        console.log('[SETTINGS]: Cloud sync failed or offline. Using local cache.');
      }
    } catch (error) {
      console.log('[SETTINGS]: Initialization failed', error);
    }
  },

  /**
   * Centralized update function for any setting change.
   * Immediately updates local state and triggers a debounced cloud sync.
   */
  async updateUserSetting(key: string, value: any) {
    const appStore = useAppStore.getState();
    const themeStore = useThemeStore.getState();
    console.log(`[SETTINGS]: Updating ${key} -> ${value}`);
    
    // 1. Update the appropriate store
    if (key === 'themeMode') {
      themeStore.setThemeMode(value);
    } else if (key === 'accentColor') {
      themeStore.setAccentColor(value);
    } else {
      // Normal app settings
      appStore.updateSetting(key as any, value);
    }
    
    // 2. Trigger cloud sync immediately
    syncEvents.emitMutation();
  },


  /**
   * Manual force-restore from cloud.
   */
  async restoreFromCloud() {
    return await settingsSyncService.sync(true);
  }
};
