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
import { Loader } from '../components/Loader';
import { useAppStore } from '../store';
import { PinLockScreen } from '../screens/PinLockScreen';
import NetInfo from '@react-native-community/netinfo';
import { syncService } from '../services/syncService';
import { registerBackgroundSync, unregisterBackgroundSync } from '../services/backgroundSync';
import { AppState, AppStateStatus } from 'react-native';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const { isDark, colors } = useTheme();
  const { user, isLoading } = useAuthStore();
  const { pin } = useAppStore();
  const [isUnlocked, setIsUnlocked] = React.useState(false);

  // 1. Initial Sync on Login/Restore & Background Task Management
  React.useEffect(() => {
    if (user) {
      syncService.syncAll();
      registerBackgroundSync();
    } else {
      unregisterBackgroundSync();
    }
  }, [user]);

  // 2. Sync on App Resume
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && user) {
        console.log('App: Resumed, triggering sync...');
        syncService.syncAll();
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
        syncService.syncAll();
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

  if (isLoading) {
    return <Loader />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {user && pin && !isUnlocked ? (
        <PinLockScreen onUnlock={() => setIsUnlocked(true)} />
      ) : (
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
            </>
          )}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};
