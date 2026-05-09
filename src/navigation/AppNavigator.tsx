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
import * as Linking from 'expo-linking';
import { Loader } from '../components/Loader';
import { useAppStore } from '../store';
import NetInfo from '@react-native-community/netinfo';
import { syncEngine } from '../services/syncEngine';
import { registerBackgroundSync, unregisterBackgroundSync } from '../services/backgroundSync';
import { AppState, AppStateStatus } from 'react-native';

const Stack = createNativeStackNavigator();

const prefix = Linking.createURL('/');

const linking = {
  prefixes: [prefix, 'greenmoney://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
};

export const AppNavigator = () => {
  const { isDark, colors } = useTheme();
  const { user, isLoading } = useAuthStore();
  const [isAppInitialized, setIsAppInitialized] = React.useState(false);

  // 1. App Initialization Flow (Auth -> Settings -> Render)
  React.useEffect(() => {
    const initialize = async () => {
      console.log('[STARTUP]: App initialization sequence starting...');
      
      // If auth is still loading (checking session), wait.
      if (isLoading) {
        console.log('[STARTUP]: Auth is loading, waiting...');
        return;
      }

      if (user) {
        console.log(`[STARTUP]: User detected (${user.id}). Fetching cloud settings...`);
        try {
          const { settingsService } = require('../services/settingsService');
          // This is the CRITICAL blocking call to restore cloud preferences
          await settingsService.initializeSettings();
          console.log('[STARTUP]: Cloud settings restoration complete.');
        } catch (e) {
          console.log('[STARTUP]: Cloud settings fetch failed. Falling back to local cache.');
        } finally {
          setIsAppInitialized(true);
          registerBackgroundSync();
        }
      } else {
        console.log('[STARTUP]: No user session. Navigation to Auth flow.');
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

  // Block rendering until both auth and settings are fully initialized
  if (isLoading || !isAppInitialized) {
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
