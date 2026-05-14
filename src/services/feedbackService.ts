import { Platform, Linking } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

export type FeedbackType = 'bug' | 'suggestion' | 'general';

export interface FeedbackContext {
  type: FeedbackType;
  message: string;
  appVersion: string;
  osVersion: string;
  deviceModel: string;
  platform: string;
}

const FEEDBACK_CONFIG = {
  EMAIL: 'heygrini@gmail.com',
  WHATSAPP: '9342410401',
};

export const feedbackService = {
  getAppMetadata: async () => {
    return {
      appVersion: Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0',
      osVersion: Device.osVersion || 'Unknown',
      deviceModel: Device.modelName || 'Unknown',
      platform: Platform.OS,
    };
  },

  getTemplate: (type: FeedbackType): string => {
    switch (type) {
      case 'bug':
        return "Describe what happened:\n\nSteps to reproduce:\n1.\n2.\n\nExpected behavior:\n\nActual behavior:";
      case 'suggestion':
        return "I would like to improve:\n\nCurrent problem:\n\nSuggested solution:";
      case 'general':
        return "What do you like/dislike about the app?\n\nAny other comments?";
      default:
        return "";
    }
  },

  formatFeedbackMessage: (context: FeedbackContext): string => {
    const title = context.type.toUpperCase();
    return `
--- ${title} REPORT ---
${context.message}

--- APP CONTEXT ---
App Version: ${context.appVersion}
Platform: ${context.platform}
Device: ${context.deviceModel}
OS Version: ${context.osVersion}
`.trim();
  },

  sendEmail: async (type: FeedbackType, message: string) => {
    const metadata = await feedbackService.getAppMetadata();
    const formattedBody = feedbackService.formatFeedbackMessage({
      type,
      message,
      ...metadata
    });

    const subject = `[GreenMoney ${type.charAt(0).toUpperCase() + type.slice(1)} Report]`;
    const cc = 'dhanushkumar9342@gmail.com';
    const mailUrl = `mailto:${FEEDBACK_CONFIG.EMAIL}?cc=${cc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(formattedBody)}`;
    
    const supported = await Linking.canOpenURL(mailUrl);
    if (supported) {
      await Linking.openURL(mailUrl);
      return true;
    }
    return false;
  },

  sendWhatsApp: async (type: FeedbackType, message: string) => {
    const metadata = await feedbackService.getAppMetadata();
    const formattedBody = feedbackService.formatFeedbackMessage({
      type,
      message,
      ...metadata
    });

    const whatsappUrl = `whatsapp://send?phone=91${FEEDBACK_CONFIG.WHATSAPP}&text=${encodeURIComponent(formattedBody)}`;
    
    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
        return true;
      }
    } catch (e) {
      // Fallback to web link if app not installed
      const webUrl = `https://wa.me/91${FEEDBACK_CONFIG.WHATSAPP}?text=${encodeURIComponent(formattedBody)}`;
      await Linking.openURL(webUrl);
      return true;
    }
    return false;
  }
};
