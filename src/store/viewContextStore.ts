import { create } from 'zustand';

export type ViewMode = 'daily' | 'monthly' | 'yearly' | 'calendar' | 'all';

interface ViewContextState {
  viewMode: ViewMode;
  selectedDate: string; // ISO String for Daily/Calendar
  selectedMonth: number; // 0-11
  selectedYear: number;
  
  // Actions
  setViewMode: (mode: ViewMode) => void;
  setSelectedDate: (date: string) => void;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  setContext: (context: Partial<ViewContextState>) => void;
}

export const useViewContextStore = create<ViewContextState>((set) => ({
  viewMode: 'daily',
  selectedDate: new Date().toISOString(),
  selectedMonth: new Date().getMonth(),
  selectedYear: new Date().getFullYear(),

  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  setSelectedYear: (selectedYear) => set({ selectedYear }),
  setContext: (context) => set((state) => ({ ...state, ...context })),
}));
