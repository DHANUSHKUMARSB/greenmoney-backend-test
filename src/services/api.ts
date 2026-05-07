import axios from 'axios';
import { Transaction } from './localStorage';
import { logger } from '../utils/logger';

/**
 * PRODUCTION API CONFIGURATION
 * We use EXPO_PUBLIC_ prefix so Expo automatically loads this from your .env file.
 * Fallback is provided for local development.
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.17:3000';

export const api = {
  pushSync: async (userId: string, transactions: Transaction[]) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/sync/push`, {
        userId,
        transactions
      });
      return response.data;
    } catch (error: any) {
      logger.error('API pushSync failed', error);
      throw error;
    }
  },

  pullSync: async (userId: string, lastSyncTime: string | null): Promise<Transaction[]> => {
    try {
      const res = await axios.get(`${API_BASE_URL}/sync/pull`, { params: { userId, lastSyncTime } });
      return res.data;
    } catch (error: any) {
      logger.error('API pullSync failed', error);
      throw error;
    }
  },

  syncProfile: async (userId: string, profileData: any | null): Promise<any> => {
    try {
      const res = await axios.post(`${API_BASE_URL}/sync/profile`, { userId, data: profileData });
      return res.data;
    } catch (error: any) {
      logger.error('API syncProfile failed', error);
      throw error;
    }
  },

  checkHealth: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      return response.data.status === 'ok';
    } catch (error: any) {
      logger.warn('API Health Check Failed', error.message);
      return false;
    }
  }
};
