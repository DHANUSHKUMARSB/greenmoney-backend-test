import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { useTheme } from "../hooks/useTheme";
import { signIn } from "../services/authService";

export const LoginScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 30,
          paddingTop: insets.top + 60,
          paddingBottom: 60,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.logoContainer,
            { backgroundColor: colors.primaryContainer },
          ]}
        >
          <Ionicons name="leaf" size={40} color={colors.primary} />
        </View>

        <Text style={[styles.header, { color: colors.text }]}>Welcome</Text>
        <Text style={[styles.subHeader, { color: colors.textSecondary }]}>
          Manage your finances with elegance and precision.
        </Text>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="name@example.com"
            placeholderTextColor={colors.textSecondary + '66'}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Input
            label="Password"
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary + '66'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            onPress={() => navigation.navigate("ForgotPassword")}
            style={styles.forgotPassword}
          >
            <Text
              style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}
            >
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.button}
          />
        </View>

        <View style={styles.footer}>
          <Text style={{ color: colors.textSecondary, fontWeight: "500" }}>
            New to GreenMoney?{" "}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
            <Text style={{ color: colors.primary, fontWeight: "800" }}>
              Create account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  header: {
    fontSize: 36,
    fontWeight: "900",
    marginBottom: 12,
    letterSpacing: -1,
  },
  subHeader: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 40,
    paddingRight: 20,
  },
  form: { gap: 12 },
  button: { marginTop: 24, height: 56 },
  forgotPassword: { alignSelf: "flex-end", marginTop: 4 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 48 },
});
