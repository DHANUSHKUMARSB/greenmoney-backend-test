import { localStorage, Transaction, Category, Budget, Goal, RecurringTransaction } from './localStorage';
import { useAuthStore } from '../store/authStore';
import { budgetEngine } from './budgetEngine';

const getUserId = () => {
  const userId = useAuthStore.getState().user?.uid;
  if (!userId) throw new Error('User not logged in');
  return userId;
};

export const setupDefaultDataForUser = async () => {
  const userId = useAuthStore.getState().user?.uid;
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
  
  // Normalize date to YYYY-MM-DD for consistent filtering
  const normalizedDate = tx.date.slice(0, 10);
  
  const newTx = await localStorage.addTransaction({
    user_id: userId,
    amount: tx.amount,
    type: tx.type,
    category: categoryName,
    description: tx.note || '',
    date: normalizedDate,
    account_id: tx.accountId.toString(),
    recurring_id: tx.recurring_id,
  });
  
  // Trigger budget sync
  await budgetEngine.syncBudgetsWithIncome(userId);
  
  return newTx.id;
};

export const updateTransaction = async (id: string, tx: TransactionInput) => {
  const userId = getUserId();
  const cats = await localStorage.getCategories(userId);
  
  const categoryObj = cats.find(c => 
    c.id.toString() === tx.categoryId?.toString() || 
    c.name === tx.categoryId?.toString()
  );
  const categoryName = categoryObj?.name || tx.categoryId?.toString() || 'Uncategorized';
  
  // Normalize date safely
  const dateStr = tx.date || new Date().toISOString();
  const normalizedDate = dateStr.slice(0, 10);
  
  await localStorage.updateTransaction(id, {
    amount: Number(tx.amount || 0),
    type: tx.type || 'expense',
    category: categoryName,
    description: tx.note || '',
    date: normalizedDate,
    account_id: (tx.accountId || '1').toString(),
  });

  // Trigger budget sync
  await budgetEngine.syncBudgetsWithIncome(userId);
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

/**
 * Checks for a potential duplicate transaction in the local database.
 * Matches on amount, date (normalized), type, and category.
 */
export const checkDuplicateTransaction = async (tx: TransactionInput, excludeId?: string) => {
  const userId = getUserId();
  const allTxs = await localStorage.getTransactions(userId);
  const normalizedDate = tx.date.slice(0, 10);
  
  // Find category name for comparison
  const cats = await localStorage.getCategories(userId);
  const categoryObj = cats.find(c => 
    c.id.toString() === tx.categoryId?.toString() || 
    c.name === tx.categoryId?.toString()
  );
  const categoryName = categoryObj?.name || 'Uncategorized';

  return allTxs.find(t => 
    t.id !== excludeId &&
    t.amount === Number(tx.amount) &&
    t.date === normalizedDate &&
    t.type === tx.type &&
    t.category === categoryName &&
    (t.description || '') === (tx.note?.trim() || '')
  );
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
  const userId = getUserId();
  await localStorage.deleteTransaction(id);
  
  // Trigger budget sync
  await budgetEngine.syncBudgetsWithIncome(userId);
};

export const getCategories = async () => {
  const userId = getUserId();
  const cats = await localStorage.getCategories(userId);
  return cats
    .filter(c => !c.deleted_at)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
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

export const updateCategoriesOrder = async (orderedCategories: any[]) => {
  const categoriesWithOrder = orderedCategories.map((cat, index) => ({
    ...cat,
    display_order: index
  }));
  await localStorage.updateCategoriesOrder(categoriesWithOrder);
};

export const getAccounts = async () => {
  const userId = getUserId();
  const accs = await localStorage.getAccounts(userId);
  return accs.filter(a => !a.deleted_at);
};

export const getTotalIncomeForMonth = async (month: string) => {
  const transactions = await getTransactions();
  return transactions
    .filter(t => t.type === 'income' && t.date?.startsWith(month))
    .reduce((sum, t) => sum + t.amount, 0);
};

export const getBudgetUsage = async (categoryId: string | number, dateStr: string, viewPeriod: 'daily' | 'monthly' | 'yearly' = 'monthly') => {
  const transactions = await getTransactions();
  const usage = transactions
    .filter(t => {
      const isExpense = t.type === 'expense';
      
      let dateMatch = false;
      const tDate = t.date?.slice(0, 10); // YYYY-MM-DD
      
      if (viewPeriod === 'daily') {
        dateMatch = tDate === dateStr.slice(0, 10);
      } else if (viewPeriod === 'monthly') {
        dateMatch = tDate?.startsWith(dateStr.slice(0, 7));
      } else if (viewPeriod === 'yearly') {
        dateMatch = tDate?.startsWith(dateStr.slice(0, 4));
      }

      const catMatch = (t.category_id?.toString() || '') === (categoryId?.toString() || '') || 
                       (t.category_name || '') === (categoryId?.toString() || '');
      return isExpense && dateMatch && catMatch;
    })
    .reduce((sum, t) => sum + t.amount, 0);
  return usage;
};

import { budgetScalingEngine, BudgetPeriod, RecurrenceType } from './budgetScalingEngine';

export const getBudgets = async (targetDate: string, viewPeriod: BudgetPeriod) => {
  const userId = getUserId();
  const allBudgets = await localStorage.getBudgets();
  
  // 1. Filter budgets for this user
  let userBudgets = allBudgets.filter(b => b.user_id === userId && !b.deleted_at);

  // 2. Migration Layer: Convert old budgets to new format if needed
  const needsMigration = userBudgets.some(b => !(b as any).recurrence_type);
  if (needsMigration) {
    console.log('[DATABASE]: Migrating legacy budgets to dynamic format...');
    for (const b of userBudgets) {
      if (!(b as any).recurrence_type) {
        await localStorage.updateBudget(b.id, {
          amount: (b as any).monthly_limit || 0,
          period: (b as any).period || 'monthly',
          recurrence_type: (b as any).is_recurring ? 'recurring' : 'one_time',
          spending_frequency: 'daily', // Default fallback
          start_date: (b as any).month ? `${(b as any).month}-01` : new Date().toISOString().slice(0, 10),
        } as any);
      }
    }
    // Re-fetch after migration
    const updatedBudgets = await localStorage.getBudgets();
    userBudgets = updatedBudgets.filter(b => b.user_id === userId && !b.deleted_at);
  }

  // 3. Filter active budgets for the target date and scale them
  return userBudgets
    .filter(b => budgetScalingEngine.isBudgetActive(b as any, targetDate, viewPeriod))
    .map(b => ({
      ...b,
      spending_frequency: b.spending_frequency || 'daily', // Safe fallback
      // The "limit" is dynamically calculated based on the current view
      display_limit: budgetScalingEngine.scaleValue(b.amount, b.period, viewPeriod, targetDate)
    }));
};

export const setBudget = async (
  categoryId: string, 
  amount: number, 
  startDate: string, 
  config: {
    period: BudgetPeriod;
    recurrence_type: RecurrenceType;
    spending_frequency: any;
    frequency_config?: any;
    amount_type?: 'fixed' | 'percentage';
    percentage_value?: number;
  }
) => {
  const userId = getUserId();
  const budgets = await localStorage.getBudgets();
  
  // Find existing budget for same category and start period to update
  const existing = budgets.find(b => 
    b.category_id === categoryId && 
    b.user_id === userId && 
    !b.deleted_at &&
    b.start_date.slice(0, 7) === startDate.slice(0, 7) &&
    b.period === config.period
  );
  
  const budgetData = {
    amount,
    period: config.period,
    recurrence_type: config.recurrence_type,
    spending_frequency: config.spending_frequency,
    frequency_config: config.frequency_config,
    amount_type: config.amount_type || 'fixed',
    percentage_value: config.percentage_value,
    is_system_generated: false,
    start_date: startDate,
  };

  if (existing) {
    await localStorage.updateBudget(existing.id, budgetData);
  } else {
    const cats = await localStorage.getCategories(userId);
    const cat = cats.find(c => c.id === categoryId);
    await localStorage.addBudget({
      user_id: userId,
      category_id: categoryId,
      category_name: cat ? cat.name : 'Unknown',
      ...budgetData,
    });
  }
};

export const deleteBudget = async (categoryId: string, targetDate: string, period: BudgetPeriod) => {
  const userId = getUserId();
  const budgets = await localStorage.getBudgets();
  const existing = budgets.find(b => 
    b.category_id === categoryId && 
    b.user_id === userId && 
    !b.deleted_at &&
    b.start_date.slice(0, 7) === targetDate.slice(0, 7) &&
    b.period === period
  );
  if (existing) {
    await localStorage.updateBudget(existing.id, { deleted_at: new Date().toISOString() } as any);
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
    const currentAmount = Number(goal.current_amount || 0);
    const addition = Number(amount || 0);
    
    await localStorage.updateGoal(goalId, {
      current_amount: currentAmount + addition
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
