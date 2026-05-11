import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/authStore';
import { supabase } from './supabase';

const ACCOUNTS_KEY = 'gm_saved_accounts';

export const accountService = {
  async saveCurrentAccount() {
    const { user, username, profileImage } = useAuthStore.getState();
    if (!user) return;

    try {
      const existing = await this.getSavedAccounts();
      const accounts = [...existing];
      
      const index = accounts.findIndex(a => a.id === user.id);
      const accountData = {
        id: user.id,
        email: user.email || '',
        username: username,
        avatar: profileImage
      };

      if (index > -1) {
        accounts[index] = accountData;
      } else {
        accounts.push(accountData);
      }

      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      useAuthStore.getState().setSavedAccounts(accounts);

      // Save session (using AsyncStorage for simplicity and to avoid 2048 byte limit on Android)
      const session = useAuthStore.getState().session;
      if (session) {
        await AsyncStorage.setItem(`gm_session_${user.id}`, JSON.stringify(session));
      }
    } catch (e) {
      console.error('Failed to save account', e);
    }
  },

  async getSession(userId: string) {
    try {
      const data = await AsyncStorage.getItem(`gm_session_${userId}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  async clearSession(userId: string) {
    try {
      await AsyncStorage.removeItem(`gm_session_${userId}`);
    } catch (e) {}
  },

  async getSavedAccounts() {
    try {
      const data = await AsyncStorage.getItem(ACCOUNTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  async removeAccount(userId: string) {
    try {
      const existing = await this.getSavedAccounts();
      const filtered = existing.filter((a: any) => a.id !== userId);
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(filtered));
      useAuthStore.getState().setSavedAccounts(filtered);
    } catch (e) {
      console.error('Failed to remove account', e);
    }
  }
};
