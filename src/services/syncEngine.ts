import NetInfo from '@react-native-community/netinfo';
import { localStorage, Transaction } from './localStorage';
import { api } from './api';
import { toastService } from './toastService';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store';
import { syncEvents } from './syncEvents';
import { logger } from '../utils/logger';
import { useThemeStore } from '../store/themeStore';

let isSyncing = false;
let lastAutoSync = 0;
const AUTO_SYNC_THROTTLE = 30000; 

const isDataIdentical = (t1: Transaction, t2: Transaction) => {
  return (
    t1.amount === t2.amount &&
    t1.category === t2.category &&
    t1.type === t2.type &&
    t1.description === t2.description &&
    t1.date === t2.date &&
    t1.deleted_at === t2.deleted_at
  );
};

export const syncEngine = {
  async runSync(isManual = false) {
    if (isSyncing) return;
    
    if (!isManual && Date.now() - lastAutoSync < AUTO_SYNC_THROTTLE) {
      return;
    }

    const user = useAuthStore.getState().user;
    if (!user) return;

    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      if (isManual) toastService.show('No internet connection', 'error');
      return;
    }

    try {
      isSyncing = true;
      logger.sync(`Starting ${isManual ? 'manual' : 'automatic'} sync session`);

      // 0. MIGRATION
      await localStorage.migrateFromV1();

      // 1. PROFILE SYNC
      const appStore = useAppStore.getState();
      const themeStore = useThemeStore.getState();
      
      const profileData = {
        settings: {
          currency: appStore.currency,
          reminders_enabled: appStore.remindersEnabled,
          reminder_time: appStore.dailyReminderTime,
          pin_enabled: !!appStore.pin,
          accent_color: themeStore.accentColor || '#2196F3'
        },
        categories: await localStorage.getCategories(),
        accounts: await localStorage.getAccounts()
      };

      const cloudProfile = await api.syncProfile(user.id, profileData);
      if (cloudProfile && cloudProfile.categories) {
        await Promise.all([
          localStorage.saveCategories(cloudProfile.categories),
          localStorage.saveAccounts(cloudProfile.accounts)
        ]);
        
        if (appStore.isFirstLaunch && cloudProfile.settings) {
          appStore.setCurrency(cloudProfile.settings.currency);
          appStore.setRemindersEnabled(cloudProfile.settings.reminders_enabled);
          appStore.setDailyReminderTime(cloudProfile.settings.reminder_time);
          if (cloudProfile.settings.accent_color) {
            themeStore.setAccentColor(cloudProfile.settings.accent_color);
          }
          appStore.setFirstLaunch(false);
          logger.info('Cloud profile restored successfully.');
        }
      }

      // 2. TRANSACTION PULL
      const lastSyncTime = isManual ? null : await localStorage.getLastSyncTimestamp();
      const cloudUpdates = await api.pullSync(user.id, lastSyncTime);
      
      if (cloudUpdates.length > 0) {
        for (const cloudTx of cloudUpdates) {
          const localTx = await localStorage.getTransactionById(cloudTx.local_id);
          if (!localTx || cloudTx.version > localTx.version) {
            await localStorage.updateTransaction(cloudTx.local_id, { ...cloudTx, id: cloudTx.local_id, sync_status: 'synced' }, true);
          }
        }
      }

      // 3. TRANSACTION PUSH
      const pending = await localStorage.getPendingTransactions();
      if (pending.length > 0) {
        const pushResult = await api.pushSync(user.id, pending);
        if (pushResult.synced.length > 0) {
          for (const localId of pushResult.synced) {
            await localStorage.updateTransaction(localId, { sync_status: 'synced' }, true);
          }
        }
      }

      // 4. STORAGE OPTIMIZATION
      await localStorage.garbageCollect();

      // 5. FINISH
      lastAutoSync = Date.now();
      await localStorage.setLastSyncTimestamp(new Date().toISOString());
      syncEvents.emitSyncCompleted();
      
      logger.sync('Sync session completed.');
      if (isManual) toastService.show('Data Synced', 'success');
    } catch (error: any) {
      logger.error('Sync failed', error);
    } finally {
      isSyncing = false;
    }
  }
};
