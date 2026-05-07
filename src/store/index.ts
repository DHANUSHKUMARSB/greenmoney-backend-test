import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  isFirstLaunch: boolean;
  setFirstLaunch: (val: boolean) => void;
  transactions: any[];
  setTransactions: (transactions: any[]) => void;
  // User Preferences
  currency: string;
  pin: string | null;
  remindersEnabled: boolean;
  dailyReminderTime: string; // 'HH:mm'
  
  // Actions
  setCurrency: (currency: string) => void;
  setPin: (pin: string | null) => void;
  setRemindersEnabled: (enabled: boolean) => void;
  setDailyReminderTime: (time: string) => void;
  clearAppStore: (keysToKeep?: (keyof AppState)[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isFirstLaunch: true,
      setFirstLaunch: (val) => set({ isFirstLaunch: val }),
      transactions: [],
      setTransactions: (transactions) => set({ transactions }),
      // Default state
      currency: 'INR',
      pin: null,
      remindersEnabled: true,
      dailyReminderTime: '20:00',
      
      // Actions
      setCurrency: (currency) => set({ currency }),
      setPin: (pin) => set({ pin }),
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled }),
      setDailyReminderTime: (dailyReminderTime) => set({ dailyReminderTime }),
      
      clearAppStore: (keysToKeep = []) => set((state) => {
        const newState: any = {
          isFirstLaunch: true,
          transactions: [],
          currency: 'INR',
          pin: null,
          remindersEnabled: true,
          dailyReminderTime: '20:00',
        };
        keysToKeep.forEach(key => { newState[key] = state[key]; });
        return newState;
      }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
