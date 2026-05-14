import { create } from 'zustand';
import { User } from 'firebase/auth';
import { UserProfile } from '../services/firebaseProfileService';

interface AuthState {
  user: User | null;
  username: string | null;
  profileImage: string | null;
  firebaseProfile: UserProfile | null;
  savedAccounts: Array<{ id: string, email: string, username: string | null, avatar: string | null }>;
  isLoading: boolean;
  loadingMessage: string;
  setUser: (user: User | null) => void;
  setUsername: (username: string | null) => void;
  setProfileImage: (image: string | null) => void;
  setFirebaseProfile: (profile: UserProfile | null) => void;
  setSavedAccounts: (accounts: Array<{ id: string, email: string, username: string | null, avatar: string | null }>) => void;
  setLoading: (isLoading: boolean, message?: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  username: null,
  profileImage: null,
  firebaseProfile: null,
  savedAccounts: [],
  isLoading: true,
  loadingMessage: 'Initializing...',
  setUser: (user) => set({ user }),
  setUsername: (username) => set({ username }),
  setProfileImage: (profileImage) => set({ profileImage }),
  setFirebaseProfile: (firebaseProfile) => set({ firebaseProfile }),
  setSavedAccounts: (savedAccounts) => set({ savedAccounts }),
  setLoading: (isLoading, message) => set((state) => ({ 
    isLoading, 
    loadingMessage: message || state.loadingMessage 
  })),
}));
