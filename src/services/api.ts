import axios from 'axios';
import { BaseEntity } from './localStorage';
import { logger } from '../utils/logger';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.17:3000';

export interface SyncPayload {
  transactions?: any[];
  categories?: any[];
  accounts?: any[];
  budgets?: any[];
  goals?: any[];
  recurring?: any[];
  settings?: any;
  username?: string | null;
  profile_image?: string | null;
}

export interface SyncResponse {
  updates: SyncPayload;
  success_ids: { [collection: string]: string[] };
}

export const api = {
  /**
   * UNIVERSAL BIDIRECTIONAL SYNC API
   * Pushes local changes and pulls cloud updates for all collections in one trip.
   */
  universalSync: async (userId: string, payload: SyncPayload): Promise<SyncResponse> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/sync/universal`, {
        userId,
        payload
      });
      return response.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      logger.error(`API universalSync failed: ${errorMsg}`, error.response?.data || error);
      throw error;
    }
  },
  
  syncProfile: async (userId: string, profileData: any | null): Promise<any> => {
    try {
      const res = await axios.post(`${API_BASE_URL}/sync/profile`, { userId, data: profileData });
      return res.data;
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      logger.error(`API syncProfile failed: ${errorMsg}`, error.response?.data || error);
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
