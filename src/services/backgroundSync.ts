import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { syncService } from './syncService';
import { useAuthStore } from '../store/authStore';

const BACKGROUND_SYNC_TASK = 'background-sync-task';

// 1. Define the task
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const user = useAuthStore.getState().user;
    if (user) {
      console.log('Background: Starting periodic sync...');
      await syncService.syncAll();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('Background Sync Error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// 2. Helper to register/unregister
export const registerBackgroundSync = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60, // 15 minutes
      stopOnTerminate: false,   // android only
      startOnBoot: true,        // android only
    });
    console.log('Background: Sync task registered.');
  } catch (err) {
    console.log('Background: Registration failed:', err);
  }
};

export const unregisterBackgroundSync = async () => {
  if (TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    console.log('Background: Sync task unregistered.');
  }
};
