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
  hideIncome: boolean;
  hideExpense: boolean;
  autoSync: boolean;
  swipeAnimation: 'standard' | 'cube';
  swipeBehavior: 'screens' | 'dates' | 'none';
  // Advanced Sound Settings
// ... (lines 40-42)
  activeTab: number;
  setActiveTab: (index: number) => void;
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
      hideIncome: false,
      hideExpense: false,
      autoSync: true,
      swipeAnimation: 'standard',
      swipeBehavior: 'screens',
      soundEnabled: false,
      hapticsEnabled: true,
      feedbackIntensity: 0.6,
      soundTheme: 'modern',
      buttonSoundsEnabled: false,
      swipeSoundsEnabled: false,
      emotionalSoundsEnabled: false,
      notificationSound: 'modern',
      settingsUpdatedAt: new Date(0).toISOString(), // Epoch for new installs
      
      // Individual setters (maintained for compatibility, but should use updateSetting)
      setCurrency: (currency) => set({ currency, settingsUpdatedAt: new Date().toISOString() }),
      setRemindersEnabled: (remindersEnabled) => set({ remindersEnabled, settingsUpdatedAt: new Date().toISOString() }),
      setDailyReminderTime: (dailyReminderTime) => set({ dailyReminderTime, settingsUpdatedAt: new Date().toISOString() }),
      setLanguage: (language) => set({ language, settingsUpdatedAt: new Date().toISOString() }),
      setHideBalance: (hideBalance) => set({ hideBalance, settingsUpdatedAt: new Date().toISOString() }),
      setAutoSync: (autoSync) => set({ autoSync, settingsUpdatedAt: new Date().toISOString() }),
      setSettingsUpdatedAt: (settingsUpdatedAt) => set({ settingsUpdatedAt }),
      
      activeTab: 0,
      setActiveTab: (index) => set({ activeTab: index }),
      
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
          hideIncome: false,
          hideExpense: false,
          autoSync: true,
          soundEnabled: false,
          buttonSoundsEnabled: false,
          swipeSoundsEnabled: false,
          emotionalSoundsEnabled: false,
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
