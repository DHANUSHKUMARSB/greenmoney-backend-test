import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

export const ACCENT_COLORS = [
  { name: 'Classic', color: '#2196F3' }, // Blue
  { name: 'Emerald', color: '#2E7D32' }, // Green
  { name: 'Royal',   color: '#673AB7' }, // Purple
  { name: 'Rose',    color: '#E91E63' }, // Pink
  { name: 'Amber',   color: '#FF8F00' }, // Orange
  { name: 'Slate',   color: '#455A64' }, // Grey
];

interface ThemeStore {
  themeMode: ThemeMode;
  accentColor: string;
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: string) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      themeMode: 'system',
      accentColor: '#2196F3',
      setThemeMode: (mode) => set({ themeMode: mode }),
      setAccentColor: (color) => set({ accentColor: color }),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
