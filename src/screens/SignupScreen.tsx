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
      Alert.alert('Success', 'Check your email for the confirmation link', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 30, paddingTop: insets.top + 40, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
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
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Input
            label="Password"
            placeholder="Create a strong password"
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
});
