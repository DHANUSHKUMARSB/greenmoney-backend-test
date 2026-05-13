import { Platform } from 'react-native';
import * as Application from 'expo-application';
import axios from 'axios';

// Get backend URL from environment
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export interface RegistrationData {
  userId: string;
  email: string;
  platform?: string;
  version?: string;
}

export const userTrackingService = {
  /**
   * Tracks a new user registration on the backend.
   */
  trackRegistration: async (userId: string, email: string) => {
    try {
      const data: RegistrationData = {
        userId,
        email,
        platform: Platform.OS,
        version: Application.nativeApplicationVersion || '1.0.0'
      };

      console.log(`[TRACKING]: Notifying backend of new registration: ${userId}`);
      
      const response = await axios.post(`${BACKEND_URL}/register-tracking`, data, {
        timeout: 10000 // 10 second timeout
      });

      if (response.data.success) {
        console.log(`[TRACKING]: Registered as User #${response.data.userNumber}. Reward Eligible: ${response.data.rewardEligible}`);
        return response.data;
      }
    } catch (error: any) {
      // We don't want to block the signup if tracking fails, 
      // but we should log it for retry logic later.
      console.error('[TRACKING]: Failed to track registration:', error.message);
    }
    return null;
  }
};
