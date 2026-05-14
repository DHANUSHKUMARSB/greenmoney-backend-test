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

export const useCurrency = () => {
  const { currency } = useAppStore();

  const format = (amount: number) => {
    const symbol = CURRENCY_SYMBOLS[currency] || '₹';
    const locale = CURRENCY_LOCALES[currency] || 'en-IN';

    const cleanAmount = typeof amount === 'number' ? amount : 0;
    return symbol + cleanAmount.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const getSymbol = () => CURRENCY_SYMBOLS[currency] || '₹';

  return { format, symbol: getSymbol(), currencyCode: currency };
};
