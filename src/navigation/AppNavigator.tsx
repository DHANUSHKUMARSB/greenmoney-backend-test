import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { TabNavigator } from './TabNavigator';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { UploadScreen } from '../screens/UploadScreen';
import { AIPreviewScreen } from '../screens/AIPreviewScreen';
import { FilteredTransactionsScreen } from '../screens/FilteredTransactionsScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { AddTransactionScreen } from '../screens/AddTransactionScreen';
import { BulkUploadScreen } from '../screens/BulkUploadScreen';
import { DuplicateDetectionScreen } from '../screens/DuplicateDetectionScreen';
import { BulkImportReviewScreen } from '../screens/BulkImportReviewScreen';
import * as Linking from 'expo-linking';
import { Loader } from '../components/Loader';
import { useAppStore } from '../store';
import NetInfo from '@react-native-community/netinfo';
import { syncEngine } from '../services/syncEngine';
import { registerBackgroundSync, unregisterBackgroundSync } from '../services/backgroundSync';
import { AppState, AppStateStatus } from 'react-native';
import { PrivacySettingsScreen } from '../screens/PrivacySettings';
import { CategoryManagementScreen } from '../screens/CategoryManagementScreen';

const Stack = createNativeStackNavigator();

const prefix = Linking.createURL('/');

const linking = {
  prefixes: ['greenmoney://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      Login: 'auth/callback',
    },
  },
};

export const AppNavigator = () => {
  const { isDark, colors } = useTheme();
  const { user, isLoading } = useAuthStore();
  const [isAppInitialized, setIsAppInitialized] = React.useState(false);

  React.useEffect(() => {
    const initialize = async () => {
      if (isLoading) return;

      if (user) {
        try {
          const { settingsService } = require('../services/settingsService');
          await settingsService.initializeSettings();
          registerBackgroundSync();
        } catch (e) {
          console.error('[STARTUP]: Settings fetch failed', e);
        } finally {
          setIsAppInitialized(true);
        }
      } else {
        setIsAppInitialized(true);
        unregisterBackgroundSync();
      }
    };

    initialize();
  }, [user, isLoading]);

  // 2. Sync on App Resume
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && user) {
        console.log('App: Resumed, triggering sync...');
        syncEngine.runSync(false);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [user]);

  // 3. Network Change Trigger
  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && user) {
        console.log('App: Network online, triggering sync...');
        syncEngine.runSync(false);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // 4. Notification Setup
  React.useEffect(() => {
    const setupNotifications = async () => {
      const { requestNotificationPermissions, getPushToken } = require('../services/notificationService');
      const granted = await requestNotificationPermissions();
      if (granted) {
        await getPushToken();
      }
    };
    setupNotifications();
  }, []);

  const navigationTheme = isDark ? {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  } : {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  if (!isAppInitialized) {
    return <Loader />;
  }

  return (
    <NavigationContainer theme={navigationTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
             <Stack.Screen name="Main" component={TabNavigator} />
             <Stack.Screen name="Upload" component={UploadScreen} />
             <Stack.Screen name="AIPreview" component={AIPreviewScreen} />
             <Stack.Screen name="FilteredTransactions" component={FilteredTransactionsScreen} />
             <Stack.Screen name="AddTransaction" component={AddTransactionScreen} />
             <Stack.Screen name="BulkUpload" component={BulkUploadScreen} />
             <Stack.Screen name="DuplicateDetection" component={DuplicateDetectionScreen} />
             <Stack.Screen name="BulkImportReview" component={BulkImportReviewScreen} />
             <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
             <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
             <Stack.Screen name="CategoryManagement" component={CategoryManagementScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
