import { 
  differenceInDays, 
  startOfMonth, 
  endOfMonth, 
  getDaysInMonth, 
  startOfWeek, 
  endOfWeek,
  parseISO,
  isSameDay,
  differenceInWeeks
} from 'date-fns';

export type SpendingFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'occasionally' | 'custom';

export interface PacingResult {
  pacingPercentage: number; // How much of the "currently allowed" budget is used
  status: 'healthy' | 'warning' | 'critical' | 'occasional';
  message: string;
  expectedAmountToDate: number;
}

export const budgetFrequencyEngine = {
  /**
   * Calculates the "Expected Spending" up to the targetDate based on frequency.
   */
  getExpectedSpendingToDate(
    totalLimit: number,
    basePeriod: 'daily' | 'monthly' | 'yearly',
    frequency: SpendingFrequency,
    startDate: string,
    targetDate: string
  ): number {
    const start = parseISO(startDate);
    const target = parseISO(targetDate);
    
    // Safety check: if target is before start
    if (target < start) return 0;

    if (frequency === 'daily') {
      // Linear distribution is actually correct for daily habits
      return totalLimit; // In daily view, it's just the limit
    }

    if (frequency === 'monthly') {
      // Monthly frequency usually happens in one big chunk or is spread.
      // We'll allow the full amount if we're in the month.
      return totalLimit;
    }

    if (frequency === 'weekly') {
      // Calculate how many weeks into the period we are
      const weekStart = startOfWeek(target);
      const daysIntoWeek = differenceInDays(target, weekStart) + 1;
      // We assume weekly budget is usable anytime during the week, 
      // but for pacing we can divide by 7
      return totalLimit; // For now, keep it simple: allow full limit if in the active window
    }

    if (frequency === 'occasionally') {
      // Occasional spending allows 100% of the budget anytime
      return totalLimit;
    }

    return totalLimit;
  },

  /**
   * Calculates the health of the budget based on frequency-aware pacing.
   */
  calculatePacing(
    used: number,
    totalLimit: number,
    frequency: SpendingFrequency,
    basePeriod: string,
    targetDate: string,
    categoryName: string
  ): PacingResult {
    const today = new Date();
    const target = parseISO(targetDate);
    const isCurrentPeriod = isSameDay(target, today) || target < today;

    // 1. Calculate the "Temporal Progress" of the period
    let temporalProgress = 1;
    if (basePeriod === 'monthly') {
      const daysInMonth = getDaysInMonth(target);
      const dayOfMonth = target.getDate();
      temporalProgress = dayOfMonth / daysInMonth;
    } else if (basePeriod === 'yearly') {
      const dayOfYear = Math.floor((target.getTime() - startOfMonth(target).getTime()) / 86400000); // simplified
      temporalProgress = dayOfYear / 365;
    }

    // 2. Adjust Expected Budget based on Frequency
    let expectedProgress = temporalProgress;
    
    if (frequency === 'daily') expectedProgress = temporalProgress;
    else if (frequency === 'weekly') {
      // We allow a bit more flexibility for weekly spending
      expectedProgress = Math.min(1, temporalProgress + 0.15); 
    }
    else if (frequency === 'monthly' || frequency === 'occasionally') {
      expectedProgress = 1; // Full budget available anytime
    }

    const expectedAmount = totalLimit * expectedProgress;
    const usedRatio = expectedAmount > 0 ? used / expectedAmount : 0;
    const totalRatio = totalLimit > 0 ? used / totalLimit : 0;

    let status: PacingResult['status'] = 'healthy';
    let message = `${categoryName} spending healthy`;

    if (frequency === 'occasionally') {
      status = 'occasional';
      message = `${categoryName} (Occasional) usage tracked`;
    } else if (totalRatio >= 1) {
      status = 'critical';
      message = `Overspent ${categoryName}!`;
    } else if (usedRatio > 1.2) {
      status = 'critical';
      message = `${categoryName} pacing very high!`;
    } else if (usedRatio > 0.9) {
      status = 'warning';
      message = `${categoryName} usage high for this ${frequency}`;
    }

    // Specialized messages
    if (status === 'healthy') {
      if (frequency === 'daily') message = `${categoryName} daily pace on track`;
      if (frequency === 'weekly') message = `${categoryName} weekly pacing healthy`;
    }

    return {
      pacingPercentage: totalRatio * 100,
      status,
      message,
      expectedAmountToDate: expectedAmount
    };
  },

  /**
   * Suggests a frequency based on category name.
   */
  getSuggestedFrequency(categoryName: string): SpendingFrequency {
    const name = categoryName.toLowerCase();
    if (name.includes('food') || name.includes('grocery') || name.includes('dining')) return 'daily';
    if (name.includes('fuel') || name.includes('transport') || name.includes('commute')) return 'weekly';
    if (name.includes('rent') || name.includes('subscription') || name.includes('insurance')) return 'monthly';
    if (name.includes('shopping') || name.includes('travel') || name.includes('gift')) return 'occasionally';
    if (name.includes('entertainment') || name.includes('hobby')) return 'weekly';
    return 'monthly'; // Default
  }
};
