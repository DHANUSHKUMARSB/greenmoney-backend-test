import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, subMonths } from 'date-fns';
import { getTransactions, getBudgets, getRecurringTransactions, getGoals } from './database';

export interface SurplusData {
  safeToSpend: number;
  monthlySurplus: number;
  weeklySurplus: number;
  dailySurplus: number;
  savingsOpportunity: number;
  message: string;
  recommendation: string;
  status: 'excellent' | 'good' | 'warning' | 'critical';
}

export const calculateSmartSurplus = async (transactions: any[], budgets: any[], recurring: any[], goals: any[]): Promise<SurplusData> => {
  const now = new Date();
  const startMonth = startOfMonth(now);
  const endMonth = endOfMonth(now);
  
  // 1. Calculate Monthly Budget Cap
  let totalMonthlyBudget = budgets.reduce((sum, b) => sum + (b.monthly_limit || 0), 0);
  
  // Fallback: If no budgets are set, use 80% of income as target budget
  if (totalMonthlyBudget === 0) {
    const monthlyIncome = transactions
      .filter(tx => tx.type === 'income' && new Date(tx.date) >= startMonth && new Date(tx.date) <= endMonth)
      .reduce((sum, tx) => sum + tx.amount, 0);
    totalMonthlyBudget = monthlyIncome > 0 ? monthlyIncome * 0.8 : 50000;
  }
  
  // 2. Current Month Spending
  const monthlyExpenses = transactions
    .filter(tx => tx.type === 'expense' && new Date(tx.date) >= startMonth && new Date(tx.date) <= endMonth)
    .reduce((sum, tx) => sum + tx.amount, 0);
    
  // 3. Upcoming Recurring Expenses
  const remainingDaysInMonth = endMonth.getDate() - now.getDate();
  const upcomingRecurring = recurring
    .filter(r => {
      if (!r.next_date) return false;
      const nextDate = new Date(r.next_date);
      return nextDate > now && nextDate <= endMonth;
    })
    .reduce((sum, r) => sum + r.amount, 0);

  // 4. Smart Rollover
  const lastMonthUnspent = Math.max(0, totalMonthlyBudget * 0.05);

  // 5. Safe to Spend Calculation
  const monthlyRemaining = totalMonthlyBudget - monthlyExpenses - upcomingRecurring;
  const safeToSpend = Math.max(0, monthlyRemaining + lastMonthUnspent);
  
  // 6. Pacing
  const daysLeft = Math.max(1, remainingDaysInMonth);
  const dailyPacing = safeToSpend / daysLeft;
  const weeklyPacing = dailyPacing * 7;

  // 7. Savings Opportunity
  const savingsOpportunity = Math.max(0, safeToSpend * 0.3);

  // 8. Intelligence Messaging
  let message = '';
  let recommendation = '';
  let status: SurplusData['status'] = 'good';

  if (safeToSpend > totalMonthlyBudget * 0.4) {
    message = `You have ${formatCurrency(safeToSpend)} safe surplus.`;
    recommendation = `Excellent! You can safely add ${formatCurrency(savingsOpportunity)} to your goals today.`;
    status = 'excellent';
  } else if (safeToSpend > totalMonthlyBudget * 0.1) {
    message = `You safely have ${formatCurrency(dailyPacing)} available for today.`;
    recommendation = "Your spending is healthy. You're on track for your savings goal.";
    status = 'good';
  } else {
    message = `Careful, only ${formatCurrency(safeToSpend)} surplus left.`;
    recommendation = "Suggest sticking to essentials for the next few days.";
    status = 'warning';
  }

  return { safeToSpend, monthlySurplus: monthlyRemaining, weeklySurplus: weeklyPacing, dailySurplus: dailyPacing, savingsOpportunity, message, recommendation, status };
};

const formatCurrency = (amount: number) => {
  // This will be replaced by dynamic formatting in the UI, 
  // but we keep it simple for the engine's internal messages
  return `₹${Math.round(amount).toLocaleString()}`;
};
