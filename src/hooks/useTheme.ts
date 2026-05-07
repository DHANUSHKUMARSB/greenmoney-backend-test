import { useColorScheme } from 'react-native';
import { colors } from '../utils/theme';
import { useThemeStore } from '../store/themeStore';

export const useTheme = () => {
  const systemScheme = useColorScheme();
  const { themeMode, setThemeMode, accentColor, setAccentColor } = useThemeStore();

  const isDark =
    themeMode === 'dark' ? true :
    themeMode === 'light' ? false :
    systemScheme === 'dark';

  return {
    isDark,
    themeMode,
    setThemeMode,
    accentColor,
    setAccentColor,
    colors: {
      primary:       accentColor, // Use the selected accent color as primary
      background:    isDark ? colors.background.dark  : colors.background.light,
      card:          isDark ? colors.card.dark         : colors.card.light,
      text:          isDark ? colors.text.dark         : colors.text.light,
      textSecondary: isDark ? colors.textSecondary.dark: colors.textSecondary.light,
      border:        isDark ? colors.border.dark       : colors.border.light,
      error:         colors.error,
    },
  };
};
