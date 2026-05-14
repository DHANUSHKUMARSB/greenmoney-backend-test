import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { syncEvents } from './syncEvents';

// A simple async lock to prevent race conditions during concurrent DB writes
class AsyncLock {
  private promise: Promise<void> = Promise.resolve();
  async acquire(): Promise<() => void> {
    let release: () => void;
    const nextPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentPromise = this.promise;
    this.promise = nextPromise;
    await currentPromise;
    return release!;
  }
}

const dbLock = new AsyncLock();

export type SyncStatus = 'synced' | 'pending' | 'failed' | 'conflict';

export interface BaseEntity {
  id: string;
  user_id: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
  sync_status: SyncStatus;
  cloud_id?: string;
}

export interface Transaction extends BaseEntity {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  description: string;
  date: string;
  account_id?: string;
  recurring_id?: string;
}

export interface Category extends BaseEntity {
  name: string;
  type: 'income' | 'expense';
  display_order: number;
}

export interface Account extends BaseEntity {
  name: string;
  type: string;
  balance: number;
}

export interface Budget extends BaseEntity {
  category_id: string;
  category_name: string;
  amount: number;
  period: 'daily' | 'monthly' | 'yearly';
  recurrence_type: 'one_time' | 'recurring';
  spending_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'occasionally' | 'custom';
  frequency_config?: {
    custom_days?: number;
    custom_weeks?: number;
    weekdays?: number[];
  };
  start_date: string; // ISO string
  end_date?: string | null;
  amount_type: 'fixed' | 'percentage';
  percentage_value?: number;
  is_system_generated: boolean;
}

export interface Goal extends BaseEntity {
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
}

export interface RecurringTransaction extends BaseEntity {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category_id: string;
  account_id: string;
  recurring_type: 'repeat' | 'installment';
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  start_date: string;
  end_date: string | null;
  next_date: string;
  total_installments?: number;
  completed_installments?: number;
  installment_amount?: number;
  note?: string;
  status: 'active' | 'completed' | 'paused';
}

const KEYS = {
  TRANSACTIONS: 'app_transactions_v2',
  CATEGORIES: 'app_categories_v2',
  ACCOUNTS: 'app_accounts_v2',
  BUDGETS: 'app_budgets_v2',
  GOALS: 'app_goals_v2',
  RECURRING: 'app_recurring_v2',
  LAST_SYNC: 'last_sync_timestamp',
  SETTINGS: 'app_settings_v2',
};

const DEFAULT_CATEGORIES = (userId: string): Category[] => [
  { id: `def_food`, user_id: userId, name: 'Food', type: 'expense', display_order: 0, updated_at: new Date().toISOString(), version: 1, deleted_at: null, sync_status: 'pending' },
  { id: `def_transport`, user_id: userId, name: 'Transport', type: 'expense', display_order: 1, updated_at: new Date().toISOString(), version: 1, deleted_at: null, sync_status: 'pending' },
  { id: `def_shopping`, user_id: userId, name: 'Shopping', type: 'expense', display_order: 2, updated_at: new Date().toISOString(), version: 1, deleted_at: null, sync_status: 'pending' },
  { id: `def_salary`, user_id: userId, name: 'Salary', type: 'income', display_order: 3, updated_at: new Date().toISOString(), version: 1, deleted_at: null, sync_status: 'pending' },
  { id: `def_bills`, user_id: userId, name: 'Bills', type: 'expense', display_order: 4, updated_at: new Date().toISOString(), version: 1, deleted_at: null, sync_status: 'pending' },
  { id: `def_entertainment`, user_id: userId, name: 'Entertainment', type: 'expense', display_order: 5, updated_at: new Date().toISOString(), version: 1, deleted_at: null, sync_status: 'pending' },
  { id: `def_health`, user_id: userId, name: 'Health', type: 'expense', display_order: 6, updated_at: new Date().toISOString(), version: 1, deleted_at: null, sync_status: 'pending' },
  { id: `def_goals`, user_id: userId, name: 'Goal', type: 'expense', display_order: 7, updated_at: new Date().toISOString(), version: 1, deleted_at: null, sync_status: 'pending' },
];

const DEFAULT_ACCOUNTS = (userId: string): Account[] => [
  { id: `def_cash`, user_id: userId, name: 'Cash', type: 'cash', balance: 0, updated_at: new Date().toISOString(), version: 1, deleted_at: null, sync_status: 'pending' },
  { id: `def_bank`, user_id: userId, name: 'Bank', type: 'bank', balance: 0, updated_at: new Date().toISOString(), version: 1, deleted_at: null, sync_status: 'pending' },
];

export const localStorage = {
  // --- Generic Helpers ---
  _getItems: async <T extends BaseEntity>(key: string): Promise<T[]> => {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(`[DATABASE]: Error reading ${key}`, e);
      return [];
    }
  },

  _saveItems: async <T extends BaseEntity>(key: string, items: T[]) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(items));
    } catch (e) {
      console.error(`[DATABASE]: Error saving ${key}`, e);
      throw e;
    }
  },

  _add: async <T extends BaseEntity>(key: string, item: Omit<T, 'id' | 'sync_status' | 'version' | 'updated_at' | 'deleted_at'>): Promise<T> => {
    const release = await dbLock.acquire();
    try {
      const items = await localStorage._getItems<T>(key);
      const newItem = {
        ...item,
        id: uuidv4(),
        sync_status: 'pending',
        version: 1,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      } as T;
      await localStorage._saveItems(key, [newItem, ...items]);
      syncEvents.emitMutation();
      return newItem;
    } finally { release(); }
  },

  _update: async <T extends BaseEntity>(key: string, id: string, updates: Partial<T>, isFromSync = false, isSilent = false): Promise<void> => {
    const release = await dbLock.acquire();
    try {
      const items = await localStorage._getItems<T>(key);
      const index = items.findIndex(i => i.id === id);
      let updatedList = [...items];

      if (index !== -1) {
        const current = items[index];
        updatedList[index] = {
          ...current,
          ...updates,
          version: isFromSync ? (updates.version ?? current.version) : current.version + 1,
          sync_status: isFromSync ? (updates.sync_status ?? 'synced') : 'pending',
          updated_at: new Date().toISOString(),
        };
      } else if (isFromSync) {
        const newItem = {
          ...updates,
          id: id,
          sync_status: 'synced',
          version: updates.version ?? 1,
          updated_at: updates.updated_at ?? new Date().toISOString(),
          deleted_at: updates.deleted_at ?? null,
        } as T;
        updatedList = [newItem, ...updatedList];
      }
      await localStorage._saveItems(key, updatedList);
      if (!isFromSync && !isSilent) syncEvents.emitMutation();
    } finally { release(); }
  },

  _delete: async <T extends BaseEntity>(key: string, id: string): Promise<void> => {
    const release = await dbLock.acquire();
    try {
      const items = await localStorage._getItems<T>(key);
      const index = items.findIndex(i => i.id === id);
      if (index !== -1) {
        const updatedList = [...items];
        updatedList[index] = {
          ...items[index],
          deleted_at: new Date().toISOString(),
          sync_status: 'pending',
          version: items[index].version + 1,
        };
        await localStorage._saveItems(key, updatedList);
        syncEvents.emitMutation();
      }
    } finally { release(); }
  },

  _deleteFromStorage: async (key: string, id: string): Promise<void> => {
    const release = await dbLock.acquire();
    try {
      const items = await localStorage._getItems(key);
      const filtered = items.filter(i => i.id !== id);
      if (filtered.length < items.length) {
        await localStorage._saveItems(key, filtered);
        syncEvents.emitMutation();
      }
    } finally { release(); }
  },

  // --- Transactions ---
  getTransactions: () => localStorage._getItems<Transaction>(KEYS.TRANSACTIONS),
  getActiveTransactions: async () => (await localStorage.getTransactions()).filter(t => !t.deleted_at),
  getTransactionById: async (id: string, includeDeleted = true) => {
    const items = await localStorage.getTransactions();
    const item = items.find(t => t.id === id);
    if (!item) return undefined;
    if (!includeDeleted && item.deleted_at) return undefined;
    return item;
  },
  addTransaction: (tx: any) => localStorage._add<Transaction>(KEYS.TRANSACTIONS, tx),
  updateTransaction: (id: string, updates: any, isFromSync = false) => localStorage._update<Transaction>(KEYS.TRANSACTIONS, id, updates, isFromSync),
  deleteTransaction: (id: string) => localStorage._delete<Transaction>(KEYS.TRANSACTIONS, id),
  getPendingTransactions: async () => (await localStorage.getTransactions()).filter(t => t.sync_status === 'pending' || t.sync_status === 'failed'),

  // --- Sync Metadata ---
  getLastSyncTimestamp: () => AsyncStorage.getItem(KEYS.LAST_SYNC),
  setLastSyncTimestamp: (ts: string) => AsyncStorage.setItem(KEYS.LAST_SYNC, ts),

  // --- Categories ---
  getCategories: async (userId?: string): Promise<Category[]> => {
    const cats = await localStorage._getItems<Category>(KEYS.CATEGORIES);
    if (userId) {
      const userCats = cats.filter(c => c.user_id === userId);
      return userCats.length ? userCats : DEFAULT_CATEGORIES(userId);
    }
    return cats;
  },
  saveCategories: (cats: Category[]) => localStorage._saveItems(KEYS.CATEGORIES, cats),
  addCategory: (cat: any) => localStorage._add<Category>(KEYS.CATEGORIES, cat),
  updateCategory: (id: string, updates: any, isFromSync = false) => localStorage._update<Category>(KEYS.CATEGORIES, id, updates, isFromSync),
  updateCategoriesOrder: async (categories: Category[]) => {
    const release = await dbLock.acquire();
    try {
      const allCats = await localStorage._getItems<Category>(KEYS.CATEGORIES);
      const updatedList = [...allCats];
      
      for (const cat of categories) {
        const index = updatedList.findIndex(i => i.id === cat.id);
        if (index !== -1) {
          updatedList[index] = {
            ...updatedList[index],
            display_order: cat.display_order,
            updated_at: new Date().toISOString(),
            version: updatedList[index].version + 1,
            sync_status: 'pending'
          };
        }
      }
      
      await localStorage._saveItems(KEYS.CATEGORIES, updatedList);
      syncEvents.emitMutation();
    } finally { release(); }
  },
  deleteCategory: (id: string) => localStorage._delete<Category>(KEYS.CATEGORIES, id),

  // --- Accounts ---
  getAccounts: async (userId?: string): Promise<Account[]> => {
    const accs = await localStorage._getItems<Account>(KEYS.ACCOUNTS);
    if (userId) {
      const userAccs = accs.filter(a => a.user_id === userId);
      return userAccs.length ? userAccs : DEFAULT_ACCOUNTS(userId);
    }
    return accs;
  },
  saveAccounts: (accs: Account[]) => localStorage._saveItems(KEYS.ACCOUNTS, accs),
  addAccount: (acc: any) => localStorage._add<Account>(KEYS.ACCOUNTS, acc),
  updateAccount: (id: string, updates: any, isFromSync = false) => localStorage._update<Account>(KEYS.ACCOUNTS, id, updates, isFromSync),

  // --- Budgets ---
  getBudgets: () => localStorage._getItems<Budget>(KEYS.BUDGETS),
  saveBudgets: (budgets: Budget[]) => localStorage._saveItems(KEYS.BUDGETS, budgets),
  addBudget: (budget: any) => localStorage._add<Budget>(KEYS.BUDGETS, budget),
  updateBudget: (id: string, updates: any, isFromSync = false, isSilent = false) => localStorage._update<Budget>(KEYS.BUDGETS, id, updates, isFromSync, isSilent),

  // --- Goals ---
  getGoals: () => localStorage._getItems<Goal>(KEYS.GOALS),
  saveGoals: (goals: Goal[]) => localStorage._saveItems(KEYS.GOALS, goals),
  addGoal: (goal: any) => localStorage._add<Goal>(KEYS.GOALS, goal),
  updateGoal: (id: string, updates: any, isFromSync = false) => localStorage._update<Goal>(KEYS.GOALS, id, updates, isFromSync),

  // --- Recurring ---
  getRecurringTransactions: async (userId?: string) => {
    const all = await localStorage._getItems<RecurringTransaction>(KEYS.RECURRING);
    return userId ? all.filter(r => r.user_id === userId) : all;
  },
  saveRecurringTransactions: (recurring: RecurringTransaction[]) => localStorage._saveItems(KEYS.RECURRING, recurring),
  addRecurringTransaction: (tx: any) => localStorage._add<RecurringTransaction>(KEYS.RECURRING, tx),
  updateRecurring: (id: string, updates: any, isFromSync = false) => localStorage._update<RecurringTransaction>(KEYS.RECURRING, id, updates, isFromSync),

  // --- Settings (Syncable Object) ---
  getSettings: async () => {
    const data = await AsyncStorage.getItem(KEYS.SETTINGS);
    return data ? JSON.parse(data) : null;
  },
  saveSettings: (settings: any) => AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings)),

  // --- Seed & Utilities ---
  seedDefaultData: async (userId: string) => {
    const release = await dbLock.acquire();
    try {
      const allCats = await localStorage.getCategories();
      if (!allCats.some(c => c.user_id === userId)) {
        await localStorage.saveCategories([...allCats, ...DEFAULT_CATEGORIES(userId)]);
      }
      const allAccs = await localStorage.getAccounts();
      if (!allAccs.some(a => a.user_id === userId)) {
        await localStorage.saveAccounts([...allAccs, ...DEFAULT_ACCOUNTS(userId)]);
      }
    } finally { release(); }
  },

  garbageCollect: async () => {
    const release = await dbLock.acquire();
    try {
      const keys = [KEYS.TRANSACTIONS, KEYS.CATEGORIES, KEYS.ACCOUNTS, KEYS.BUDGETS, KEYS.GOALS, KEYS.RECURRING];
      for (const key of keys) {
        const items = await localStorage._getItems(key);
        const clean = items.filter(t => !t.deleted_at || t.sync_status === 'pending');
        if (clean.length < items.length) await localStorage._saveItems(key, clean);
      }
    } finally { release(); }
  },

  migrateFromV1: async (userId: string) => {
    const release = await dbLock.acquire();
    try {
      const oldData = await AsyncStorage.getItem('app_transactions');
      if (oldData) {
        const oldTxs = JSON.parse(oldData);
        const current = await localStorage.getTransactions();
        const merged = [...current];
        for (const otx of oldTxs) {
          if (!merged.find(t => t.id === otx.id)) {
            // Apply current userId if it's missing in v1 data
            merged.push({ 
              ...otx, 
              user_id: otx.user_id || userId, 
              sync_status: 'pending', 
              version: 1, 
              updated_at: new Date().toISOString(), 
              deleted_at: null 
            });
          }
        }
        await localStorage._saveItems(KEYS.TRANSACTIONS, merged);
      }
    } finally { release(); }
  }
};
