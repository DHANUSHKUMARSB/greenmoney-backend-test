import { 
  startOfMonth, 
  endOfMonth, 
  getDaysInMonth, 
  getDaysInYear, 
  isLeapYear, 
  startOfYear, 
  endOfYear,
  parseISO,
  format,
  isSameMonth,
  isSameYear,
  isSameDay
} from 'date-fns';

export type BudgetPeriod = 'daily' | 'monthly' | 'yearly';
export type RecurrenceType = 'one_time' | 'recurring';

export interface BudgetContext {
  viewPeriod: BudgetPeriod;
  activeDate: string; // YYYY-MM-DD
}

export const budgetScalingEngine = {
  /**
   * Scales a budget value from its base period to the current view period.
   * Handles leap years and varying month lengths.
   */
  scaleValue(
    baseAmount: number, 
    basePeriod: BudgetPeriod, 
    viewPeriod: BudgetPeriod, 
    targetDate: string
  ): number {
    const date = parseISO(targetDate);
    
    // 1. Convert Base to Daily Rate (Normalization)
    let dailyRate = 0;
    if (basePeriod === 'daily') {
      dailyRate = baseAmount;
    } else if (basePeriod === 'monthly') {
      const daysInMonth = getDaysInMonth(date);
      dailyRate = baseAmount / daysInMonth;
    } else if (basePeriod === 'yearly') {
      const daysInYear = isLeapYear(date) ? 366 : 365;
      dailyRate = baseAmount / daysInYear;
    }

    // 2. Convert Daily Rate to View Period
    if (viewPeriod === 'daily') {
      return dailyRate;
    } else if (viewPeriod === 'monthly') {
      const daysInMonth = getDaysInMonth(date);
      return dailyRate * daysInMonth;
    } else if (viewPeriod === 'yearly') {
      const daysInYear = isLeapYear(date) ? 366 : 365;
      return dailyRate * daysInYear;
    }

    return baseAmount;
  },

  /**
   * Determines if a budget is active for a specific date context.
   * Handles One-Time vs Recurring logic.
   */
  isBudgetActive(
    budget: {
      recurrence_type: RecurrenceType;
      start_date: string;
      period: BudgetPeriod;
      created_for_period: string;
    },
    targetDate: string,
    viewPeriod: BudgetPeriod
  ): boolean {
    const target = parseISO(targetDate);
    const start = parseISO(budget.start_date);

    // One-Time logic
    if (budget.recurrence_type === 'one_time') {
      if (budget.period === 'daily') {
        return isSameDay(target, start);
      }
      if (budget.period === 'monthly') {
        return isSameMonth(target, start);
      }
      if (budget.period === 'yearly') {
        return isSameYear(target, start);
      }
    }

    // Recurring logic: Active if target is same or after start
    return target >= start;
  }
};
