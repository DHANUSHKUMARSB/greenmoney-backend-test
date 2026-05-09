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
  remindersEnabled: boolean;
  dailyReminderTime: string;
  language: string;
  hideBalance: boolean;
  autoSync: boolean;
  settingsUpdatedAt: string;
  
  // Actions
  setCurrency: (currency: string) => void;
  setRemindersEnabled: (enabled: boolean) => void;
  setDailyReminderTime: (time: string) => void;
  setLanguage: (lang: string) => void;
  setHideBalance: (hidden: boolean) => void;
  setAutoSync: (enabled: boolean) => void;
  setSettingsUpdatedAt: (date: string) => void;
  clearAppStore: (keysToKeep?: (keyof AppState)[]) => void;
  
  // Centralized update function
  updateSetting: (key: keyof AppState, value: any) => void;
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
      remindersEnabled: true,
      dailyReminderTime: '20:00',
      language: 'en',
      hideBalance: false,
      autoSync: true,
      settingsUpdatedAt: new Date(0).toISOString(), // Epoch for new installs
      
      // Individual setters (maintained for compatibility, but should use updateSetting)
      setCurrency: (currency) => set({ currency, settingsUpdatedAt: new Date().toISOString() }),
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled, settingsUpdatedAt: new Date().toISOString() }),
      setDailyReminderTime: (dailyReminderTime) => set({ dailyReminderTime, settingsUpdatedAt: new Date().toISOString() }),
      setLanguage: (language) => set({ language, settingsUpdatedAt: new Date().toISOString() }),
      setHideBalance: (hideBalance) => set({ hideBalance, settingsUpdatedAt: new Date().toISOString() }),
      setAutoSync: (autoSync) => set({ autoSync, settingsUpdatedAt: new Date().toISOString() }),
      setSettingsUpdatedAt: (settingsUpdatedAt) => set({ settingsUpdatedAt }),
      
      // The centralized function for real-time sync
      updateSetting: (key, value) => set((state) => ({
        ...state,
        [key]: value,
        settingsUpdatedAt: new Date().toISOString()
      })),

      clearAppStore: (keysToKeep = []) => set((state) => {
        const newState: any = {
          isFirstLaunch: true,
          transactions: [],
          currency: 'INR',
          remindersEnabled: true,
          dailyReminderTime: '20:00',
          language: 'en',
          hideBalance: false,
          autoSync: true,
          settingsUpdatedAt: new Date(0).toISOString(),
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
