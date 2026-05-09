import { localStorage, Transaction, Category, Budget, Goal, RecurringTransaction } from './localStorage';
import { useAuthStore } from '../store/authStore';

const getUserId = () => {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error('User not logged in');
  return userId;
};

export const setupDefaultDataForUser = async () => {
  const userId = useAuthStore.getState().user?.id;
  if (userId) {
    console.log(`[DATABASE]: Setting up default data for user ${userId}...`);
    await localStorage.migrateFromV1(userId); 
    await localStorage.seedDefaultData(userId);

    // Repair Step: Assign current userId to any orphan transactions (from failed migrations)
    const allTxs = await localStorage.getTransactions();
    const orphans = allTxs.filter(t => !t.user_id);
    if (orphans.length > 0) {
      console.log(`[DATABASE]: Repairing ${orphans.length} orphan transactions...`);
      for (const t of orphans) {
        await localStorage.updateTransaction(t.id, { user_id: userId }, true);
      }
    }
  }
};

export const initDatabase = async () => {
  try {
    await setupDefaultDataForUser();
    console.log('[DATABASE]: Local storage initialized.');
  } catch (e) {
    console.error('[DATABASE]: Initialization failed:', e);
  }
};

export type TransactionInput = {
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string | number;
  accountId: string | number;
  date: string;
  note?: string;
  recurring_id?: string;
};

export const insertTransaction = async (tx: TransactionInput) => {
  const userId = getUserId();
  const cats = await localStorage.getCategories(userId);
  
  const categoryObj = cats.find(c => 
    c.id.toString() === tx.categoryId?.toString() || 
    c.name === tx.categoryId?.toString()
  );
  const categoryName = categoryObj?.name || 'Uncategorized';
  
  const newTx = await localStorage.addTransaction({
    user_id: userId,
    amount: tx.amount,
    type: tx.type,
    category: categoryName,
    description: tx.note || '',
    date: tx.date,
    account_id: tx.accountId.toString(),
    recurring_id: tx.recurring_id,
  });
  return newTx.id;
};

export const updateTransaction = async (id: string, tx: TransactionInput) => {
  const userId = getUserId();
  const cats = await localStorage.getCategories(userId);
  
  const categoryObj = cats.find(c => 
    c.id.toString() === tx.categoryId?.toString() || 
    c.name === tx.categoryId?.toString()
  );
  const categoryName = categoryObj?.name || 'Uncategorized';
  
  await localStorage.updateTransaction(id, {
    amount: tx.amount,
    type: tx.type,
    category: categoryName,
    description: tx.note || '',
    date: tx.date,
    account_id: tx.accountId.toString(),
  });
};

export const getTransactionById = async (id: string) => {
  const tx = await localStorage.getTransactionById(id);
  if (!tx) return undefined;
  
  const cats = await localStorage.getCategories(tx.user_id);
  const cat = cats.find(c => c.name === tx.category);
  
  return {
    ...tx,
    category_name: tx.category,
    note: tx.description,
    category_id: cat ? cat.id : tx.category,
    account_id: tx.account_id
  };
};

export const getTransactions = async () => {
  const userId = getUserId();
  const txs = await localStorage.getActiveTransactions();
  const cats = await localStorage.getCategories(userId);

  return txs
    .filter(t => t.user_id === userId)
    .map(t => {
      const cat = cats.find(c => c.name === t.category);
      return {
        ...t,
        category_name: t.category,
        note: t.description,
        category_id: cat ? cat.id : t.category, 
        account_id: t.account_id
      };
    });
};

export const deleteTransaction = async (id: string) => {
  await localStorage.deleteTransaction(id);
};

export const getCategories = async () => {
  const userId = getUserId();
  const cats = await localStorage.getCategories(userId);
  return cats.filter(c => !c.deleted_at);
};

export const addCategory = async (name: string, type: 'income' | 'expense') => {
  const userId = getUserId();
  const cats = await getCategories();
  await localStorage.addCategory({
    user_id: userId,
    name,
    type,
    display_order: cats.length,
  });
};

export const deleteCategory = async (id: string) => {
  await localStorage.deleteCategory(id);
};

export const getAccounts = async () => {
  const userId = getUserId();
  const accs = await localStorage.getAccounts(userId);
  return accs.filter(a => !a.deleted_at);
};

export const getBudgetUsage = async (categoryId: string | number, month: string) => {
  const transactions = await getTransactions();
  const usage = transactions
    .filter(t => {
      const isExpense = t.type === 'expense';
      const dateMatch = t.date.startsWith(month);
      const catMatch = t.category_id.toString() === categoryId.toString() || t.category_name === categoryId.toString();
      return isExpense && dateMatch && catMatch;
    })
    .reduce((sum, t) => sum + t.amount, 0);
  return usage;
};

export const getBudgets = async (month?: string) => {
  const userId = getUserId();
  const budgets = await localStorage.getBudgets();
  let filtered = budgets.filter(b => b.user_id === userId && !b.deleted_at);
  if (month) {
    filtered = filtered.filter(b => b.month === month);
  }
  return filtered;
};

export const setBudget = async (categoryId: string, limit: number, month: string) => {
  const userId = getUserId();
  const budgets = await localStorage.getBudgets();
  const existing = budgets.find(b => b.category_id === categoryId && b.month === month && b.user_id === userId && !b.deleted_at);
  
  if (existing) {
    await localStorage.updateBudget(existing.id, { monthly_limit: limit });
  } else {
    const cats = await localStorage.getCategories(userId);
    const cat = cats.find(c => c.id === categoryId);
    await localStorage.addBudget({
      user_id: userId,
      category_id: categoryId,
      category_name: cat ? cat.name : 'Unknown',
      monthly_limit: limit,
      month: month,
    });
  }
};

export const getGoals = async () => {
  const userId = getUserId();
  const goals = await localStorage.getGoals();
  return goals.filter(g => g.user_id === userId && !g.deleted_at);
};

export const addGoal = async (name: string, targetAmount: number, deadline?: string) => {
  const userId = getUserId();
  await localStorage.addGoal({
    user_id: userId,
    name,
    target_amount: targetAmount,
    current_amount: 0,
    deadline,
  });
};

export const updateGoalProgress = async (goalId: string, amount: number) => {
  const goals = await localStorage.getGoals();
  const goal = goals.find(g => g.id === goalId);
  if (goal) {
    await localStorage.updateGoal(goalId, {
      current_amount: goal.current_amount + amount
    });
  }
};

export const deleteGoal = async (goalId: string) => {
  await localStorage._delete('app_goals_v2', goalId); // Using internal delete for goal
};

export const getRecurringTransactions = async () => {
  const userId = getUserId();
  const rec = await localStorage.getRecurringTransactions(userId);
  return rec.filter(r => !r.deleted_at);
};

export const insertRecurringTransaction = async (tx: TransactionInput, config: any) => {
  const userId = getUserId();
  await localStorage.addRecurringTransaction({
    user_id: userId,
    amount: tx.amount,
    type: tx.type,
    category_id: tx.categoryId?.toString() || '0',
    account_id: tx.accountId.toString(),
    recurring_type: config.recurring_type,
    frequency: config.frequency,
    interval: config.interval,
    start_date: tx.date,
    end_date: null,
    next_date: config.next_date,
    total_installments: config.total_installments,
    completed_installments: 0,
    installment_amount: tx.amount,
    note: tx.note,
    status: 'active',
  });
};
