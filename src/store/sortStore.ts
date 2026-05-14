import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SortField = 'date' | 'amount' | 'type' | 'category' | 'created_at';
export type SortOrder = 'asc' | 'desc';

interface SortState {
  sortField: SortField;
  sortOrder: SortOrder;
  
  // Actions
  setSortField: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  toggleOrder: () => void;
  setSort: (field: SortField, order: SortOrder) => void;
}

export const useSortStore = create<SortState>()(
  persist(
    (set) => ({
      sortField: 'date',
      sortOrder: 'desc',

      setSortField: (sortField) => set({ sortField }),
      setSortOrder: (sortOrder) => set({ sortOrder }),
      toggleOrder: () => set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' })),
      setSort: (sortField, sortOrder) => set({ sortField, sortOrder }),
    }),
    {
      name: 'app-sort-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
