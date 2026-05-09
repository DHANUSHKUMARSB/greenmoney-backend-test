export const colors = {
  // Primary Greens (Finance focused)
  primary: '#2E7D32',
  primaryContainer: '#C8E6C9',
  
  // Surfaces (Material 3 Style)
  background: {
    light: '#FEF7FF', // M3 Light Surface
    dark: '#1C1B1F',  // M3 Dark Surface
  },
  card: {
    light: '#F7F2FA', // M3 Surface Variant
    dark: '#2B2930',  // M3 Surface Variant Dark
  },
  
  // Text
  text: {
    light: '#1C1B1F', // On Surface
    dark: '#E6E1E9',  // On Surface Dark
  },
  textSecondary: {
    light: '#49454F', // On Surface Variant
    dark: '#CAC4D0',  // On Surface Variant Dark
  },
  
  // Accents
  border: {
    light: '#CAC4D0', // Outline
    dark: '#49454F',  // Outline Dark
  },
  error: '#B3261E', // M3 Error
  success: '#2E7D32',
  income: '#2E7D32',
  expense: '#B3261E',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
  huge: 64,
};

export const typography = {
  header: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
  },
  button: {
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  }
};

export const borderRadius = {
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  full: 999,
};
