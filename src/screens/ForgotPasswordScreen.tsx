import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { typography, spacing } from '../utils/theme';
import { sendPasswordResetEmail } from '../services/authService';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export const ForgotPasswordScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    console.log('Forgot Password: Requesting reset for', email);
    
    try {
      await sendPasswordResetEmail(email);
      console.log('Forgot Password: Reset instructions requested successfully');
      setSubmitted(true);
    } catch (error: any) {
      console.error('Forgot Password Error:', error);
      
      // Supabase might throw if email is not found or rate limited.
      // For security, if it's a common auth error, we still show the success screen.
      const isAuthError = error.message?.toLowerCase().includes('email') || 
                          error.message?.toLowerCase().includes('user');
      
      if (isAuthError) {
        setSubmitted(true);
      } else {
        Alert.alert('Error', error.message || 'Failed to send instructions. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.l }]}>
        <View style={styles.successIcon}>
          <Ionicons name="mail-unread-outline" size={80} color={colors.primary} />
        </View>
        <Text style={[styles.header, { color: colors.text, textAlign: 'center' }]}>Instructions Sent</Text>
        <Text style={[styles.subHeader, { color: colors.textSecondary, textAlign: 'center' }]}>
          If an account exists with {email}, you will receive password reset instructions shortly.
        </Text>
        <Button 
          title="Open Mail App" 
          onPress={() => Linking.openURL('mailto:')} 
          style={styles.button}
        />
        <TouchableOpacity onPress={() => navigation.navigate('Login' as any)} style={{ marginTop: 24, alignItems: 'center' }}>
          <Text style={{ color: colors.primary, fontWeight: '800' }}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.m }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity 
        onPress={() => navigation.goBack()}
        style={[styles.backButton, { top: insets.top + spacing.m }]}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.header, { color: colors.text }]}>Forgot Password</Text>
        <Text style={[styles.subHeader, { color: colors.textSecondary }]}>
          Enter your email and we'll send you instructions to reset your password.
        </Text>

        <Input
          label="Email"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoFocus
        />

        <Button 
          title="Send Instructions" 
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
  backButton: {
    position: 'absolute',
    left: spacing.l,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    padding: spacing.l,
    justifyContent: 'center',
  },
  header: {
    ...typography.header,
    fontSize: 28,
    marginBottom: spacing.s,
  },
  subHeader: {
    ...typography.body,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  button: {
    marginTop: spacing.l,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xxl,
  }
});
