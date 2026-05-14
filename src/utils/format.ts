import { useAppStore } from '../store';

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const CURRENCY_LOCALES: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
};

export const formatCurrency = (amount: number, currencyCode?: string) => {
  // If no code provided, try to get from store (caution: this can't be used outside of components easily if using hooks)
  // We'll pass it as a parameter for better stability.
  const code = currencyCode || 'INR';
  const symbol = CURRENCY_SYMBOLS[code] || '₹';
  const locale = CURRENCY_LOCALES[code] || 'en-IN';

  return symbol + amount.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};
