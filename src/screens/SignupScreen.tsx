import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { signUp } from '../services/authService';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export const SignupScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validateUsername = (name: string) => {
    if (name.length < 3) return 'Username must be at least 3 characters';
    if (name.length > 20) return 'Username must be max 20 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(name)) return 'Only letters, numbers, and underscore allowed';
    return null;
  };

  const handleSignup = async () => {
    const usernameError = validateUsername(username);
    if (usernameError) { Alert.alert('Validation Error', usernameError); return; }
    if (!email || !password || !confirmPassword) { Alert.alert('Error', 'Please fill in all fields'); return; }
    if (password !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }

    setLoading(true);
    try {
      await signUp(email, password, username);
      setSubmitted(true);
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.xl, paddingHorizontal: 30, alignItems: 'center', justifyContent: 'center' }]}>
        <View style={[styles.successIcon, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="mail-unread-outline" size={80} color={colors.primary} />
        </View>
        <Text style={[styles.header, { color: colors.text, textAlign: 'center', fontSize: 28 }]}>Check your email</Text>
        <Text style={[styles.subHeader, { color: colors.textSecondary, textAlign: 'center', paddingRight: 0 }]}>
          We've sent a verification link to {email}. Tap the link in your email to confirm your account.
        </Text>
        <Button 
          title="Open Mail App" 
          onPress={() => Linking.openURL('mailto:')} 
          style={[styles.button, { width: '100%' }]}
        />
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 24 }}>
          <Text style={{ color: colors.primary, fontWeight: '800' }}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 30, paddingTop: insets.top + 40, paddingBottom: 60 }} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.card }]}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.header, { color: colors.text }]}>Join GreenMoney</Text>
        <Text style={[styles.subHeader, { color: colors.textSecondary }]}>Start your journey towards financial freedom today.</Text>

        <View style={styles.form}>
          <Input
            label="Username"
            placeholder="How should we call you?"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Input
            label="Email"
            placeholder="yourname@example.com"
            placeholderTextColor={colors.textSecondary + '66'}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Input
            label="Password"
            placeholder="Create a strong password"
            placeholderTextColor={colors.textSecondary + '66'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Input
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <Button 
            title="Create Account" 
            onPress={handleSignup} 
            loading={loading} 
            style={styles.button}
          />
        </View>

        <View style={styles.footer}>
          <Text style={{ color: colors.textSecondary, fontWeight: '500' }}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: colors.primary, fontWeight: '800' }}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  header: { fontSize: 36, fontWeight: '900', marginBottom: 12, letterSpacing: -1 },
  subHeader: { fontSize: 16, lineHeight: 24, marginBottom: 40, paddingRight: 20 },
  form: { gap: 8 },
  button: { marginTop: 24, height: 56 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
  successIcon: { width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
});
