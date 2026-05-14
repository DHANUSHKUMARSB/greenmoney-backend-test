import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { soundEngine } from '../services/soundEngine';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'tonal' | 'text';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  title, 
  variant = 'primary', 
  loading = false, 
  style, 
  disabled, 
  onPress,
  ...props 
}) => {
  const { colors, borderRadius, typography, spacing } = useTheme();

  const handlePress = (e: any) => {
    if (onPress) {
      // Map variant to sound event
      let soundEvent: any = 'tap_primary';
      if (variant === 'secondary' || variant === 'tonal') soundEvent = 'tap_secondary';
      if (variant === 'outline' || variant === 'text') soundEvent = 'tap_nav';
      
      soundEngine.play(soundEvent);
      onPress(e);
    }
  };

  const getStyles = () => {
    const btnStyle: ViewStyle = {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
    };
    const textStyle: TextStyle = {
      color: colors.text,
    };

    if (disabled) {
      btnStyle.backgroundColor = colors.card;
      textStyle.color = colors.textSecondary;
      return { btnStyle, textStyle };
    }

    switch (variant) {
      case 'primary':
        btnStyle.backgroundColor = colors.primary;
        textStyle.color = '#FFFFFF';
        break;
      case 'tonal':
        btnStyle.backgroundColor = colors.primaryContainer;
        textStyle.color = colors.primary;
        break;
      case 'secondary':
        btnStyle.backgroundColor = colors.card;
        textStyle.color = colors.primary;
        break;
      case 'outline':
        btnStyle.borderWidth = 1;
        btnStyle.borderColor = colors.border;
        textStyle.color = colors.primary;
        break;
      case 'text':
        textStyle.color = colors.primary;
        break;
    }

    return { btnStyle, textStyle };
  };

  const { btnStyle, textStyle } = getStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[
        styles.button,
        { 
          borderRadius: borderRadius.full,
          paddingVertical: spacing.m,
          paddingHorizontal: spacing.l,
        },
        btnStyle,
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textStyle.color as string} size="small" />
      ) : (
        <Text style={[
          styles.text, 
          { 
            color: textStyle.color,
            fontSize: typography.button.fontSize,
            fontWeight: typography.button.fontWeight,
            letterSpacing: typography.button.letterSpacing,
          }
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: {
    textAlign: 'center',
  },
});
