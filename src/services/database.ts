import { localStorage, Transaction, Category, Budget } from './localStorage';
import { useAuthStore } from '../store/authStore';

const getUserId = () => {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error('User not logged in');
  return userId;
};

export const setupDefaultDataForUser = async () => {
  const userId = useAuthStore.getState().user?.id;
  if (userId) {
    await localStorage.migrateFromV1(); // Migrate old data first
    await localStorage.seedDefaultData(userId);
  }
};

export const initDatabase = async () => {
  await setupDefaultDataForUser();
  console.log('Local storage initialized.');
};

export type TransactionInput = {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string | number;
  accountId: string | number;
  date: string;
  note?: string;
};

export const insertTransaction = async (tx: TransactionInput) => {
  const userId = getUserId();
  const cats = await localStorage.getCategories();
  const category = cats.find(c => c.id === tx.categoryId?.toString())?.name || 'Uncategorized';
  
  const newTx = await localStorage.addTransaction({
    user_id: userId,
    amount: tx.amount,
    type: tx.type,
    category: category,
    description: tx.note || '',
    date: tx.date,
    account_id: tx.accountId.toString(),
  });
  return newTx.id;
};

export const updateTransaction = async (id: string, tx: TransactionInput) => {
  const cats = await localStorage.getCategories();
  const category = cats.find(c => c.id === tx.categoryId?.toString())?.name || 'Uncategorized';
  
  await localStorage.updateTransaction(id, {
    amount: tx.amount,
    type: tx.type,
    category: category,
    description: tx.note || '',
    date: tx.date,
    account_id: tx.accountId.toString(),
  });
};

export const getTransactionById = async (id: string) => {
  return await localStorage.getTransactionById(id);
};

export const getTransactions = async () => {
  const userId = getUserId();
  const txs = await localStorage.getActiveTransactions();
  return txs
    .filter(t => t.user_id === userId)
    .map(t => ({
      ...t,
      category_name: t.category,
      note: t.description,
      category_id: t.category, 
      account_id: t.account_id
    }));
};

export const deleteTransaction = async (id: string) => {
  await localStorage.deleteTransaction(id);
};

export const getCategories = async () => {
  const userId = getUserId();
  const cats = await localStorage.getCategories();
  return cats.filter(c => c.user_id === userId);
};

export const getAccounts = async () => {
  const userId = getUserId();
  const accs = await localStorage.getAccounts();
  return accs.filter(a => a.user_id === userId);
};

// --- Budgets ---
export const getBudgets = async (month?: string) => {
  const userId = getUserId();
  const budgets = await localStorage.getBudgets();
  let filtered = budgets.filter(b => b.user_id === userId);
  if (month) {
    filtered = filtered.filter(b => b.month === month);
  }
  return filtered;
};

export const getBudgetUsage = async (categoryId: string | number, month: string) => {
  const transactions = await getTransactions();
  // Filter transactions for this category and month
  const usage = transactions
    .filter(t => t.type === 'expense' && t.category_id === categoryId.toString() && t.date.startsWith(month))
    .reduce((sum, t) => sum + t.amount, 0);
  return usage;
};

export const saveBudget = async (budget: Omit<Budget, 'id' | 'updated_at' | 'version'>) => {
  const userId = getUserId();
  const budgets = await localStorage.getBudgets();
  const newBudget: Budget = {
    ...budget,
    id: uuidv4(),
    user_id: userId,
    updated_at: new Date().toISOString(),
    version: 1,
  };
  budgets.push(newBudget);
  await localStorage.saveBudgets(budgets);
};

// --- Recurring ---
export const getRecurringTransactions = async () => [];
export const updateRecurringNextDate = async (id: string, date: string) => {};

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
