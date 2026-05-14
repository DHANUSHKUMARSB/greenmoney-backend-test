import React from 'react';
import { TextInput, View, Text, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<TextInput, InputProps>(({ label, error, style, ...props }, ref) => {
  const { colors, spacing, typography, borderRadius } = useTheme();

  return (
    <View style={styles.container}>
      {label && <Text style={[
        styles.label, 
        { 
          color: error ? colors.error : colors.textSecondary,
          fontSize: typography.bodySmall.fontSize,
          fontWeight: '500',
          marginBottom: spacing.xs,
        }
      ]}>{label}</Text>}
      <View style={[
        styles.inputWrapper,
        {
          backgroundColor: colors.card,
          borderRadius: borderRadius.m,
          borderBottomWidth: 1,
          borderBottomColor: error ? colors.error : colors.border,
        },
        style
      ]}>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            { 
              color: colors.text,
              fontSize: typography.body.fontSize,
              padding: spacing.m,
            }
          ]}
          placeholderTextColor={colors.textSecondary}
          {...props}
        />
      </View>
      {error && <Text style={[
        styles.error, 
        { 
          color: colors.error,
          fontSize: typography.caption.fontSize,
          marginTop: spacing.xs,
        }
      ]}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputWrapper: {
    minHeight: 56,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
  },
  label: {
    marginLeft: 4,
  },
  error: {
    marginLeft: 4,
  },
});
