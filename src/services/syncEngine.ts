import NetInfo from '@react-native-community/netinfo';
import { localStorage, Transaction, Category, Account, Budget, Goal, RecurringTransaction, BaseEntity } from './localStorage';
import { api, SyncPayload } from './api';
import { toastService } from './toastService';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store';
import { syncEvents } from './syncEvents';
import { logger } from '../utils/logger';
import { settingsSyncService } from './settingsSyncService';
import { syncQueueService } from './syncQueueService';

let isProcessing = false;
let debounceTimer: any = null;

export const syncEngine = {
  /**
   * REAL-TIME TRIGGER
   * Fired immediately after any local mutation.
   */
  triggerSync() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      this.processQueue();
    }, 500); // 500ms debounce for Notion-like real-time feel
  },

  /**
   * COMPATIBILITY ALIAS
   * Used by App.tsx, syncService.ts and AuthProvider.ts
   */
  async runSync(isManual = false) {
    return await this.processQueue(isManual);
  },

  /**
   * BACKGROUND QUEUE PROCESSOR
   * Orchestrates the push of pending changes and pull of cloud updates.
   */
  async processQueue(isManual = false) {
    if (isProcessing) return;

    const user = useAuthStore.getState().user;
    if (!user) return;

    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    try {
      isProcessing = true;
      logger.sync(`[REAL-TIME]: Processing sync queue...`);

      // 1. Gather all local entities that need syncing (Primary Source of Truth)
      const [txs, cats, accs, budgets, goals, recurring] = await Promise.all([
        localStorage.getTransactions(),
        localStorage.getCategories(),
        localStorage.getAccounts(),
        localStorage.getBudgets(),
        localStorage.getGoals(),
        localStorage.getRecurringTransactions(),
      ]);

      // 2. Build Payload (Focus on anything NOT marked as 'synced')
      const payload: SyncPayload = {
        transactions: txs.filter(t => t.sync_status !== 'synced'),
        categories: cats.filter(c => c.sync_status !== 'synced'),
        accounts: accs.filter(a => a.sync_status !== 'synced'),
        budgets: budgets.filter(b => b.sync_status !== 'synced'),
        goals: goals.filter(g => g.sync_status !== 'synced'),
        recurring: recurring.filter(r => r.sync_status !== 'synced'),
        settings: settingsSyncService.getSettingsPayload(),
      };

      // 3. Universal Sync Trip (Atomic Push/Pull)
      const response = await api.universalSync(user.id, payload);

      // 4. Update Sync Status based on server confirmation
      const sIds = response.success_ids;
      if (sIds) {
        if (sIds.transactions) await this.updateLocalStatus('TRANSACTIONS', sIds.transactions, 'synced');
        if (sIds.categories) await this.updateLocalStatus('CATEGORIES', sIds.categories, 'synced');
        if (sIds.accounts) await this.updateLocalStatus('ACCOUNTS', sIds.accounts, 'synced');
        if (sIds.budgets) await this.updateLocalStatus('BUDGETS', sIds.budgets, 'synced');
        if (sIds.goals) await this.updateLocalStatus('GOALS', sIds.goals, 'synced');
        if (sIds.recurring) await this.updateLocalStatus('RECURRING', sIds.recurring, 'synced');
      }

      // 5. Reconcile Cloud Updates (Apply changes from other devices)
      const updates = response.updates;
      if (updates) {
        if (updates.transactions) await this.reconcile('TRANSACTIONS', updates.transactions);
        if (updates.categories) await this.reconcile('CATEGORIES', updates.categories);
        if (updates.accounts) await this.reconcile('ACCOUNTS', updates.accounts);
        if (updates.budgets) await this.reconcile('BUDGETS', updates.budgets);
        if (updates.goals) await this.reconcile('GOALS', updates.goals);
        if (updates.recurring) await this.reconcile('RECURRING', updates.recurring);
        if (updates.settings) {
          await localStorage.saveSettings(updates.settings);
          await settingsSyncService.applyCloudSettings(updates.settings);
        }
      }

      // 6. Finalize
      await localStorage.setLastSyncTimestamp(new Date().toISOString());
      syncEvents.emitSyncCompleted();
      logger.sync('[REAL-TIME]: Sync completed successfully.');
      if (isManual) toastService.show('Cloud Backup Complete', 'success');

    } catch (error: any) {
      logger.error('[REAL-TIME]: Sync failed', error);
      if (isManual) toastService.show('Sync failed - saved locally', 'error');
    } finally {
      isProcessing = false;
    }
  },

  /**
   * Helper to update local sync_status after successful cloud push
   */
  async updateLocalStatus(collection: string, ids: string[], status: 'synced' | 'failed') {
    const methodMap: any = {
      TRANSACTIONS: localStorage.updateTransaction,
      CATEGORIES: localStorage.updateCategory,
      ACCOUNTS: localStorage.updateAccount,
      BUDGETS: localStorage.updateBudget,
      GOALS: localStorage.updateGoal,
      RECURRING: localStorage.updateRecurring,
    };
    const update = methodMap[collection];
    if (update) {
      for (const id of ids) await update(id, { sync_status: status }, true);
    }
  },

  /**
   * RECONCILIATION: Intelligent Cloud -> Local Sync
   */
  async reconcile(collection: string, cloudItems: BaseEntity[]) {
    const methodMap: any = {
      TRANSACTIONS: { get: localStorage.getTransactionById, update: localStorage.updateTransaction },
      CATEGORIES: { get: async (id: string) => (await localStorage.getCategories()).find(c => c.id === id), update: localStorage.updateCategory },
      ACCOUNTS: { get: async (id: string) => (await localStorage.getAccounts()).find(a => a.id === id), update: localStorage.updateAccount },
      BUDGETS: { get: async (id: string) => (await localStorage.getBudgets()).find(b => b.id === id), update: localStorage.updateBudget },
      GOALS: { get: async (id: string) => (await localStorage.getGoals()).find(g => g.id === id), update: localStorage.updateGoal },
      RECURRING: { get: async (id: string) => (await localStorage.getRecurringTransactions()).find(r => r.id === id), update: localStorage.updateRecurring },
    };

    const target = methodMap[collection];
    if (!target) return;

    for (const cloudItem of cloudItems) {
      const localItem = await target.get(cloudItem.id);

      if (!localItem) {
        // Missing locally -> Pull from cloud
        await target.update(cloudItem.id, { ...cloudItem, sync_status: 'synced' }, true);
      } else {
        // Exists on both -> Version check
        if (cloudItem.version > localItem.version) {
          await target.update(cloudItem.id, { ...cloudItem, sync_status: 'synced' }, true);
        } else if (localItem.sync_status === 'synced' && cloudItem.version === localItem.version) {
          // Already synced, do nothing
        }
      }
    }
  }
};

// Start the processor on mutation
syncEvents.on('mutation_detected', () => {
  syncEngine.triggerSync();
});
