import { getTransactions } from './database';

export type MoodState = 'very_happy' | 'happy' | 'neutral' | 'worried' | 'stressed';

export interface MoodData {
  state: MoodState;
  score: number; // -100 to 100
  message: string;
}

export const moodEngine = {
  calculateMood: async (monthStr: string): Promise<MoodData> => {
    const txs = await getTransactions();
    const currentMonthTxs = txs.filter(t => t.date && typeof t.date === 'string' && t.date.startsWith(monthStr));

    if (currentMonthTxs.length === 0) {
      return { state: 'neutral', score: 0, message: "Start tracking to see your financial mood!" };
    }

    const income = currentMonthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = currentMonthTxs.filter(t => t.type !== 'income').reduce((s, t) => s + t.amount, 0);
    
    const balance = income - expense;
    const savingsRatio = income > 0 ? balance / income : (expense > 0 ? -1 : 0);

    let state: MoodState = 'neutral';
    let message = "Doing okay! Keep tracking your spending.";

    if (savingsRatio >= 0.3) {
      state = 'very_happy';
      message = "Incredible! Your savings are rock solid this month.";
    } else if (savingsRatio >= 0.1) {
      state = 'happy';
      message = "Great progress! You're building healthy wealth.";
    } else if (savingsRatio >= 0) {
      state = 'neutral';
      message = "You're balancing well. Try to save a bit more!";
    } else if (savingsRatio >= -0.2) {
      state = 'worried';
      message = "Careful! You're spending slightly more than you earn.";
    } else {
      state = 'stressed';
      message = "Tight month. Let's look for ways to cut back.";
    }

    return {
      state,
      score: Math.max(-100, Math.min(100, savingsRatio * 100)),
      message
    };
  }
};
