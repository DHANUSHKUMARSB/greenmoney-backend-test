import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'filled' | 'outlined';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'filled', ...props }) => {
  const { colors, borderRadius, spacing, isDark } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.card,
          elevation: isDark ? 0 : 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0 : 0.1,
          shadowRadius: 2,
          borderWidth: isDark ? 1 : 0,
          borderColor: colors.border,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'filled':
      default:
        return {
          backgroundColor: colors.card,
          borderWidth: 0,
        };
    }
  };

  return (
    <View
      style={[
        styles.card,
        { borderRadius: borderRadius.xl, padding: spacing.m },
        getVariantStyles(),
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
});
