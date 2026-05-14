import * as BackgroundTask from 'expo-background-task';
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
      return BackgroundTask.BackgroundTaskResult.NewData;
    }
    return BackgroundTask.BackgroundTaskResult.NoData;
  } catch (error) {
    console.error('Background Sync Error:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// 2. Helper to register/unregister
export const registerBackgroundSync = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 15 * 60, // 15 minutes (in seconds)
      });
      console.log('Background: Sync task registered.');
    }
  } catch (err) {
    console.log('Background: Registration failed:', err);
  }
};

export const unregisterBackgroundSync = async () => {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      console.log('Background: Sync task unregistered.');
    }
  } catch (err) {
    console.log('Background: Unregistration failed:', err);
  }
};

