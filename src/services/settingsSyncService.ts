import { useAppStore } from '../store';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { api } from './api';
import { UserSettings } from '../types/settings';
import { logger } from '../utils/logger';
import { toastService } from './toastService';

export const settingsSyncService = {
  /**
   * Maps current local state to the cloud schema payload.
   */
  getSettingsPayload(): UserSettings {
    const appStore = useAppStore.getState();
    const themeStore = useThemeStore.getState();
    
    return {
      theme: themeStore.themeMode,
      accent_color: themeStore.accentColor,
      currency: appStore.currency,
      language: appStore.language,
      notification_enabled: appStore.remindersEnabled,
      notification_sound: appStore.notificationSound || 'modern',
      reminder_settings: {
        enabled: appStore.remindersEnabled,
        time: appStore.dailyReminderTime,
      },
      backup_preferences: {
        auto_sync: appStore.autoSync,
        sync_on_wifi_only: false,
      },
      premium_preferences: {
        hide_ads: true,
      },
      privacy_settings: {
        hide_balance: appStore.hideBalance,
        hide_income: appStore.hideIncome,
        hide_expense: appStore.hideExpense,
      },
      interaction_settings: {
        haptics_enabled: appStore.hapticsEnabled,
        sound_enabled: appStore.soundEnabled,
        feedback_intensity: appStore.feedbackIntensity,
        sound_theme: appStore.soundTheme,
        button_sounds: appStore.buttonSoundsEnabled,
        swipe_sounds: appStore.swipeSoundsEnabled,
        emotional_sounds: appStore.emotionalSoundsEnabled,
        swipe_animation: appStore.swipeAnimation,
        swipe_behavior: appStore.swipeBehavior,
      },
      version: 1, 
      updated_at: appStore.settingsUpdatedAt,
    };
  },

  /**
   * Restores cloud settings to local storage.
   */
  applyCloudSettings(settings: any) {
    const appStore = useAppStore.getState();
    const themeStore = useThemeStore.getState();
    
    if (!settings) return;

    // 1. Core Settings
    if (settings.currency) appStore.setCurrency(settings.currency);
    if (typeof settings.notification_enabled === 'boolean') appStore.setRemindersEnabled(settings.notification_enabled);
    if (settings.reminder_settings?.time) appStore.setDailyReminderTime(settings.reminder_settings.time);
    if (settings.theme) themeStore.setThemeMode(settings.theme);
    if (settings.accent_color) themeStore.setAccentColor(settings.accent_color);
    if (settings.language) appStore.setLanguage(settings.language);
    if (settings.notification_sound) appStore.updateSetting('notificationSound', settings.notification_sound);
    
    // 2. Privacy
    if (settings.privacy_settings) {
      appStore.setHideBalance(settings.privacy_settings.hide_balance);
      appStore.updateSetting('hideIncome', settings.privacy_settings.hide_income);
      appStore.updateSetting('hideExpense', settings.privacy_settings.hide_expense);
    }
    
    // 3. Interactions & Preferences
    if (settings.interaction_settings) {
      const s = settings.interaction_settings;
      appStore.updateSetting('hapticsEnabled', s.haptics_enabled);
      appStore.updateSetting('soundEnabled', s.sound_enabled);
      appStore.updateSetting('feedbackIntensity', s.feedback_intensity);
      appStore.updateSetting('soundTheme', s.sound_theme);
      appStore.updateSetting('buttonSoundsEnabled', s.button_sounds);
      appStore.updateSetting('swipeSoundsEnabled', s.swipe_sounds);
      appStore.updateSetting('emotionalSoundsEnabled', s.emotional_sounds);
      appStore.updateSetting('swipeAnimation', s.swipe_animation);
      appStore.updateSetting('swipeBehavior', s.swipe_behavior);
    }

    if (settings.backup_preferences) appStore.setAutoSync(settings.backup_preferences.auto_sync);

    
    // Crucial: After applying cloud settings, update our local timestamp to match cloud
    if (settings.updated_at) {
      appStore.setSettingsUpdatedAt(settings.updated_at);
    }
    
    logger.sync('Cloud settings applied to local state.');
  },

  /**
   * Main sync function: Handles upload, download, and conflict resolution.
   */
  async sync(isManual = false) {
    const user = useAuthStore.getState().user;
    if (!user) return;

    try {
      const appStore = useAppStore.getState();
      const localSettings = this.getSettingsPayload();
      const isFreshInstall = localSettings.updated_at === new Date(0).toISOString();

      console.log(`[SETTINGS]: Sync started. Manual: ${isManual}, Fresh Install: ${isFreshInstall}`);
      
      // STEP 1: If it's a fresh install or manual restore, PULL FIRST to avoid overwriting cloud with defaults
      if (isFreshInstall || isManual) {
        console.log('[SETTINGS]: Performing PULL from cloud (initial restore/manual)...');
        // We use POST with data: null to signal a fetch-only request
        const cloudData = await api.syncProfile(user.uid, null);
        
        if (cloudData) {
          console.log('[SETTINGS]: Cloud settings found. APPLYING IMMEDIATELY.');
          if (cloudData.settings) this.applyCloudSettings(cloudData.settings);
          
          if (isManual) toastService.show('Settings restored from cloud', 'success');
          return true;
        } else {
          console.log('[SETTINGS]: No cloud data found. Using local defaults.');
        }
      }

      // STEP 2: Normal two-way sync/push for existing sessions
      const authState = useAuthStore.getState();
      const cloudProfile = await api.syncProfile(user.uid, {
        settings: localSettings,
        updated_at: localSettings.updated_at
      });

      if (cloudProfile && cloudProfile.settings) {
        const cloudTime = new Date(cloudProfile.settings.updated_at || 0).getTime();
        const localTime = new Date(localSettings.updated_at).getTime();

        if (cloudTime > localTime) {
          console.log('[SETTINGS]: Cloud settings are newer. RESTORING...');
          this.applyCloudSettings(cloudProfile.settings);
        } else {
          console.log('[SETTINGS]: Local settings are newer. Cloud updated.');
        }
      }
      
      return true;
    } catch (error: any) {
      // Handle 404 as "No Profile Found" - this is expected for new accounts
      if (error?.response?.status === 404) {
        console.log('[SETTINGS]: No cloud profile found (404). This is normal for new users.');
        return true; // Continue as success so app loads with defaults
      }

      console.log('[SETTINGS]: Sync session failed.', error.message);
      return false;
    }
  },
};
