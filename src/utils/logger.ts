/**
 * Production-ready logging utility.
 * In development, it logs everything to console.
 * In production, it only logs critical errors to prevent console clutter and security leaks.
 */
const IS_DEV = __DEV__;

export const logger = {
  log: (message: string, ...args: any[]) => {
    if (IS_DEV) {
      console.log(`[LOG]: ${message}`, ...args);
    }
  },

  info: (message: string, ...args: any[]) => {
    if (IS_DEV) {
      console.info(`[INFO]: ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN]: ${message}`, ...args);
  },

  error: (message: string, error?: any, context?: string) => {
    // In production, you would typically send this to Sentry or Bugsnag
    console.error(`[CRITICAL ERROR]${context ? ` in ${context}` : ''}: ${message}`, error || '');
  },

  sync: (message: string, ...args: any[]) => {
    if (IS_DEV) {
      console.log(`[SYNC]: ${message}`, ...args);
    }
  }
};
