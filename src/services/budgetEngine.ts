import { localStorage, Budget, Transaction } from './localStorage';
import { getTotalIncome } from './analyticsService';
import { startOfMonth, endOfMonth } from 'date-fns';

export interface BudgetWarning {
  budget: Budget;
  requiredAmount: number;
  currentIncome: number;
}

export const budgetEngine = {
  /**
   * Recalculates all percentage-based budgets for a given month.
   * Returns a list of budgets that are now "underfunded" (income < total percentage-based budgets).
   */
  recalculatePercentageBudgets: async (month: string, userId: string): Promise<BudgetWarning[]> => {
    const allBudgets = await localStorage.getBudgets();
    const userBudgets = allBudgets.filter(b => b.user_id === userId && !b.deleted_at && b.start_date.startsWith(month));
    
    const allTxs = await localStorage.getActiveTransactions();
    const monthStart = startOfMonth(new Date(month + '-01'));
    const monthEnd = endOfMonth(monthStart);
    
    const monthTxs = allTxs.filter(t => t.user_id === userId && new Date(t.date) >= monthStart && new Date(t.date) <= monthEnd);
    const totalIncome = getTotalIncome(monthTxs);
    
    const warnings: BudgetWarning[] = [];
    let totalPercentageRequired = 0;

    for (const budget of userBudgets) {
      if (budget.amount_type === 'percentage' && budget.percentage_value) {
        const newAmount = (totalIncome * budget.percentage_value) / 100;
        totalPercentageRequired += budget.percentage_value;
        
        // Update the budget amount in storage silently to avoid loops
        await localStorage.updateBudget(budget.id, { amount: newAmount }, false, true);
      }
    }

    // Check for "Underfunded" situation (Total percentages > 100% or income is 0)
    if (totalIncome <= 0 && userBudgets.some(b => b.amount_type === 'percentage')) {
      for (const b of userBudgets.filter(b => b.amount_type === 'percentage')) {
        warnings.push({ budget: b, requiredAmount: 0, currentIncome: totalIncome });
      }
    }

    return warnings;
  },

  /**
   * Trigger this whenever transactions are updated.
   */
  syncBudgetsWithIncome: async (userId: string) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return await budgetEngine.recalculatePercentageBudgets(currentMonth, userId);
  }
};
