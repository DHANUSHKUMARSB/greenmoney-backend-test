import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { typography, spacing } from '../utils/theme';
import { updatePassword } from '../services/authService';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { toastService } from '../services/toastService';

export const ResetPasswordScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      toastService.show('Password reset successful', 'success');
      navigation.navigate('Login' as any);
    } catch (error: any) {
      Alert.alert('Reset Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.xl }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-open-outline" size={60} color={colors.primary} />
        </View>
        
        <Text style={[styles.header, { color: colors.text }]}>Reset Password</Text>
        <Text style={[styles.subHeader, { color: colors.textSecondary }]}>
          Enter your new password below.
        </Text>

        <Input
          label="New Password"
          placeholder="At least 8 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoFocus
        />

        <Input
          label="Confirm New Password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <Button 
          title="Update Password" 
          onPress={handleReset} 
          loading={loading} 
          style={styles.button}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.l,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.l,
  },
  header: {
    ...typography.header,
    fontSize: 28,
    marginBottom: spacing.s,
    textAlign: 'center',
  },
  subHeader: {
    ...typography.body,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.l,
  },
});
