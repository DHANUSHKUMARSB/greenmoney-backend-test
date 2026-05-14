/**
 * Computes the intelligent default date for a new transaction based on the current viewing context.
 * 
 * @param context - The current view context (mode, date, month, year)
 * @returns A Date object representing the contextual default
 */
export const getContextualDefaultDate = (context: {
  viewMode: string;
  selectedDate: string;
  selectedMonth: number;
  selectedYear: number;
}): Date => {
  const today = new Date();
  
  try {
    switch (context.viewMode) {
      case 'daily':
      case 'calendar':
        // Use the exact date being viewed
        const viewedDate = new Date(context.selectedDate);
        return isNaN(viewedDate.getTime()) ? today : viewedDate;

      case 'monthly':
        // Keep today's day, but use viewed month and year
        // e.g. Today is May 15, Viewing March 2026 -> Default March 15, 2026
        const targetMonthDate = new Date(context.selectedYear, context.selectedMonth, today.getDate());
        
        // Handle invalid days (e.g. Feb 31st)
        // If the month changed during Date construction, it means the day overflowed
        if (targetMonthDate.getMonth() !== context.selectedMonth) {
          // Fallback to last day of that month
          return new Date(context.selectedYear, context.selectedMonth + 1, 0);
        }
        return targetMonthDate;

      case 'annually':
      case 'yearly':
        // Keep today's month and day, but use viewed year
        const targetYearDate = new Date(context.selectedYear, today.getMonth(), today.getDate());
        
        // Handle Leap Year edge cases (e.g. Feb 29th)
        if (targetYearDate.getMonth() !== today.getMonth()) {
          return new Date(context.selectedYear, today.getMonth() + 1, 0);
        }
        return targetYearDate;

      default:
        return today;
    }
  } catch (e) {
    console.error('[DATE-UTILS]: Failed to compute contextual date', e);
    return today;
  }
};
