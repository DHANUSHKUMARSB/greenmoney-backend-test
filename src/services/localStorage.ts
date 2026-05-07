import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export type SyncStatus = 'synced' | 'pending' | 'failed' | 'conflict';

export interface Transaction {
  id: string; // local_id (UUID)
  user_id: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  description: string;
  date: string;
  sync_status: SyncStatus;
  version: number;
  updated_at: string;
  deleted_at: string | null;
  cloud_id?: string;
  account_id?: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: 'income' | 'expense';
  display_order: number;
  updated_at: string;
  version: number;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: string;
  balance: number;
  updated_at: string;
  version: number;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  category_name: string;
  monthly_limit: number;
  month: string; 
  updated_at: string;
  version: number;
}

const TRANSACTIONS_KEY = 'app_transactions_v2';
const CATEGORIES_KEY = 'app_categories_v2';
const ACCOUNTS_KEY = 'app_accounts_v2';
const BUDGETS_KEY = 'app_budgets_v2';
const LAST_SYNC_KEY = 'last_sync_timestamp';

export const localStorage = {
  // --- Transactions ---
  getTransactions: async (): Promise<Transaction[]> => {
    const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  },

  getActiveTransactions: async (): Promise<Transaction[]> => {
    const txs = await localStorage.getTransactions();
    return txs.filter(t => !t.deleted_at);
  },

  getTransactionById: async (id: string): Promise<Transaction | undefined> => {
    const txs = await localStorage.getTransactions();
    return txs.find(t => t.id === id);
  },

  saveTransactions: async (transactions: Transaction[]) => {
    await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  },

  addTransaction: async (tx: Omit<Transaction, 'id' | 'sync_status' | 'updated_at' | 'version' | 'deleted_at'>): Promise<Transaction> => {
    const transactions = await localStorage.getTransactions();
    const newTx: Transaction = {
      ...tx,
      id: uuidv4(),
      sync_status: 'pending',
      version: 1,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    transactions.push(newTx);
    await localStorage.saveTransactions(transactions);
    return newTx;
  },

  updateTransaction: async (id: string, updates: Partial<Transaction>, isFromSync = false): Promise<void> => {
    const transactions = await localStorage.getTransactions();
    const index = transactions.findIndex((t) => t.id === id);
    
    if (index !== -1) {
      const current = transactions[index];
      transactions[index] = {
        ...current,
        ...updates,
        version: isFromSync ? (updates.version ?? current.version) : current.version + 1,
        sync_status: isFromSync ? (updates.sync_status ?? 'synced') : 'pending',
        updated_at: new Date().toISOString(),
      };
    } else if (isFromSync) {
      const newTx = {
        ...updates,
        id: id,
        sync_status: 'synced',
        version: updates.version ?? 1,
        updated_at: updates.updated_at ?? new Date().toISOString(),
        deleted_at: updates.deleted_at ?? null,
      } as Transaction;
      transactions.push(newTx);
    }
    await localStorage.saveTransactions(transactions);
  },

  deleteTransaction: async (id: string): Promise<void> => {
    const transactions = await localStorage.getTransactions();
    const index = transactions.findIndex((t) => t.id === id);
    if (index !== -1) {
      transactions[index] = {
        ...transactions[index],
        deleted_at: new Date().toISOString(),
        sync_status: 'pending',
        version: transactions[index].version + 1,
      };
      await localStorage.saveTransactions(transactions);
    }
  },

  getPendingTransactions: async (): Promise<Transaction[]> => {
    const txs = await localStorage.getTransactions();
    return txs.filter((t) => t.sync_status === 'pending' || t.sync_status === 'failed');
  },

  // --- Sync Metadata ---
  getLastSyncTimestamp: async (): Promise<string | null> => {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  },

  setLastSyncTimestamp: async (timestamp: string): Promise<void> => {
    await AsyncStorage.setItem(LAST_SYNC_KEY, timestamp);
  },

  // --- Categories ---
  getCategories: async (): Promise<Category[]> => {
    const data = await AsyncStorage.getItem(CATEGORIES_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveCategories: async (categories: Category[]) => {
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  },

  // --- Accounts ---
  getAccounts: async (): Promise<Account[]> => {
    const data = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveAccounts: async (accounts: Account[]) => {
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  },

  // --- Budgets ---
  getBudgets: async (): Promise<Budget[]> => {
    const data = await AsyncStorage.getItem(BUDGETS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveBudgets: async (budgets: Budget[]) => {
    await AsyncStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
  },

  // --- Seed Data (PRODUCTION GRADE) ---
  seedDefaultData: async (userId: string) => {
    const allCats = await localStorage.getCategories();
    const userCats = allCats.filter(c => c.user_id === userId);
    
    if (userCats.length === 0) {
      const defaultCategories: Category[] = [
        { id: `cat_food_${userId}`, user_id: userId, name: 'Food', type: 'expense', display_order: 0, updated_at: new Date().toISOString(), version: 1 },
        { id: `cat_transport_${userId}`, user_id: userId, name: 'Transport', type: 'expense', display_order: 1, updated_at: new Date().toISOString(), version: 1 },
        { id: `cat_shopping_${userId}`, user_id: userId, name: 'Shopping', type: 'expense', display_order: 2, updated_at: new Date().toISOString(), version: 1 },
        { id: `cat_salary_${userId}`, user_id: userId, name: 'Salary', type: 'income', display_order: 3, updated_at: new Date().toISOString(), version: 1 },
        { id: `cat_bills_${userId}`, user_id: userId, name: 'Bills', type: 'expense', display_order: 4, updated_at: new Date().toISOString(), version: 1 },
      ];
      await localStorage.saveCategories([...allCats, ...defaultCategories]);
    }

    const allAccs = await localStorage.getAccounts();
    const userAccs = allAccs.filter(a => a.user_id === userId);
    
    if (userAccs.length === 0) {
      const defaultAccounts: Account[] = [
        { id: `acc_cash_${userId}`, user_id: userId, name: 'Cash', type: 'cash', balance: 0, updated_at: new Date().toISOString(), version: 1 },
        { id: `acc_bank_${userId}`, user_id: userId, name: 'Bank', type: 'bank', balance: 0, updated_at: new Date().toISOString(), version: 1 },
      ];
      await localStorage.saveAccounts([...allAccs, ...defaultAccounts]);
    }
  },

  garbageCollect: async () => {
    const transactions = await localStorage.getTransactions();
    const cleanTxs = transactions.filter(t => !t.deleted_at || t.sync_status === 'pending');
    if (cleanTxs.length < transactions.length) {
      await localStorage.saveTransactions(cleanTxs);
    }
  },

  migrateFromV1: async () => {
    const OLD_TX_KEY = 'app_transactions';
    const oldData = await AsyncStorage.getItem(OLD_TX_KEY);
    if (oldData) {
      const oldTxs = JSON.parse(oldData);
      const currentV2 = await localStorage.getTransactions();
      const newTxs = [...currentV2];
      for (const otx of oldTxs) {
        if (!newTxs.find(t => t.id === otx.id)) {
          newTxs.push({ ...otx, sync_status: 'pending', version: otx.version || 1, updated_at: otx.updated_at || new Date().toISOString(), deleted_at: otx.deleted_at || null });
        }
      }
      await localStorage.saveTransactions(newTxs);
    }
  }
};
