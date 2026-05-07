export const colors = {
  primary: '#4CAF50', // green
  background: {
    light: '#FFFFFF',
    dark: '#121212',
  },
  card: {
    light: '#F5F5F5',
    dark: '#1E1E1E',
  },
  text: {
    light: '#000000',
    dark: '#FFFFFF',
  },
  textSecondary: {
    light: '#757575',
    dark: '#B3B3B3',
  },
  border: {
    light: '#E0E0E0',
    dark: '#333333',
  },
  error: '#F44336',
};

export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  header: {
    fontSize: 24,
    fontWeight: 'bold' as const,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: 'normal' as const,
  },
};
