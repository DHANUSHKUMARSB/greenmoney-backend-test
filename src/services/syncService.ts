import NetInfo from '@react-native-community/netinfo';
import { syncEngine } from './syncEngine';

export const syncService = {
  /**
   * Run the production sync engine
   */
  async syncAll() {
    return await syncEngine.runSync();
  },

  /**
   * Compatibility alias
   */
  async syncPendingTransactions() {
    return await syncEngine.runSync();
  },

  /**
   * Initialize sync listeners
   */
  init() {
    console.log('Sync: Initializing production listeners...');
    
    // Listen for internet connection changes
    NetInfo.addEventListener(state => {
      if (state.isConnected) {
        console.log('Sync: Back online, triggering engine...');
        syncEngine.runSync();
      }
    });
    
    // Initial sync
    syncEngine.runSync();
  }
};
