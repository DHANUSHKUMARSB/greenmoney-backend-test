import { getBudgets, setBudget, getTotalIncomeForMonth, getCategories } from './database';
import { localStorage, Budget } from './localStorage';

export const budgetRuleEngine = {
  /**
   * Processes budgets for a specific month.
   * Generates recurring budgets from previous months if they don't exist.
   * Recalculates percentage-based budgets.
   */
  processMonthlyBudgets: async (month: string) => {
    try {
      const currentBudgets = await getBudgets(month);
      const categories = await getCategories();
      const expenseCats = categories.filter(c => c.type === 'expense');
      
      // 1. If no budgets exist for this month, try to clone from previous month
      if (currentBudgets.length === 0) {
        const prevMonth = budgetRuleEngine.getPreviousMonth(month);
        const prevBudgets = await getBudgets(prevMonth);
        
        const recurringBudgets = prevBudgets.filter(b => b.is_recurring);
        
        if (recurringBudgets.length > 0) {
          console.log(`[BUDGET ENGINE]: Found ${recurringBudgets.length} recurring budgets from ${prevMonth}. Generating for ${month}...`);
          for (const rb of recurringBudgets) {
            await setBudget(rb.category_id, rb.monthly_limit, month, {
              amount_type: rb.amount_type,
              percentage_value: rb.percentage_value,
              is_recurring: true,
              recurring_interval: rb.recurring_interval
            });
            // Mark as system generated
            const newlyCreated = (await getBudgets(month)).find(b => b.category_id === rb.category_id);
            if (newlyCreated) {
              await localStorage.updateBudget(newlyCreated.id, { is_system_generated: true });
            }
          }
        }
      }
      
      // 2. Recalculate Percentage Budgets
      const budgetsToUpdate = await getBudgets(month);
      const monthlyIncome = await getTotalIncomeForMonth(month);
      
      for (const budget of budgetsToUpdate) {
        if (budget.amount_type === 'percentage' && budget.percentage_value) {
          const newLimit = Math.round((monthlyIncome * budget.percentage_value) / 100);
          if (newLimit !== budget.monthly_limit) {
            console.log(`[BUDGET ENGINE]: Updating percentage budget for ${budget.category_name}: ${budget.percentage_value}% of ${monthlyIncome} = ${newLimit}`);
            await localStorage.updateBudget(budget.id, { monthly_limit: newLimit }, false, true);
          }
        }
      }
    } catch (error) {
      console.error('[BUDGET ENGINE]: Error processing budgets:', error);
    }
  },

  getPreviousMonth: (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    return date.toISOString().slice(0, 7);
  },

  getNextMonth: (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month, 1);
    return date.toISOString().slice(0, 7);
  }
};
