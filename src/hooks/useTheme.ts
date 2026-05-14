import { useColorScheme } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../utils/theme';
import { useThemeStore, ACCENT_COLORS } from '../store/themeStore';

export const useTheme = () => {
  const systemScheme = useColorScheme();
  const { themeMode, setThemeMode, accentColor, setAccentColor } = useThemeStore();

  const isDark =
    themeMode === 'dark' ? true :
    themeMode === 'light' ? false :
    systemScheme === 'dark';

  // Resolve accent color based on theme mode
  // accentColor stores the light version. We find the dark version if isDark is true.
  const resolvedAccent = isDark 
    ? (ACCENT_COLORS.find(c => c.color === accentColor)?.dark || accentColor)
    : accentColor;

  return {
    isDark,
    themeMode,
    setThemeMode,
    accentColor: resolvedAccent,
    setAccentColor,
    colors: {
      primary:       resolvedAccent, 
      primaryContainer: isDark ? resolvedAccent + '33' : colors.primaryContainer,
      background:    isDark ? colors.background.dark  : colors.background.light,
      card:          isDark ? colors.card.dark         : colors.card.light,
      text:          isDark ? colors.text.dark         : colors.text.light,
      textSecondary: isDark ? colors.textSecondary.dark: colors.textSecondary.light,
      border:        isDark ? colors.border.dark       : colors.border.light,
      error:         isDark ? '#f28b82' : colors.error, // Muted Coral in Dark
      success:       isDark ? '#81c995' : colors.success, // Muted Emerald in Dark
      income:        isDark ? '#81c995' : colors.income,
      expense:       isDark ? '#f28b82' : colors.expense,
    },
    typography,
    spacing,
    borderRadius,
  };
};
