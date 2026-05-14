import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';

const ACCOUNTS_KEY = 'gm_saved_accounts';

export const accountService = {
  async saveCurrentAccount() {
    const { user, username, profileImage } = useAuthStore.getState();
    if (!user) return;

    try {
      const existing = await this.getSavedAccounts();
      const accounts = [...existing];
      
      const index = accounts.findIndex(a => a.id === user.uid);
      const accountData = {
        id: user.uid,
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
    } catch (e) {
      console.error('Failed to save account', e);
    }
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
