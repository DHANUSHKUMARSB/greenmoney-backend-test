import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState, useRef } from 'react';
import { Loader } from './src/components/Loader';
import { useTheme } from './src/hooks/useTheme';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthProvider } from './src/components/AuthProvider';
import { initDatabase } from './src/services/database';
import { syncService } from './src/services/syncService';
import { Toast, ToastRef } from './src/components/Toast';
import { toastService } from './src/services/toastService';
import { syncEngine } from './src/services/syncEngine';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, AppStateStatus } from 'react-native';
import { soundEngine } from './src/services/soundEngine';
import { initializeNotifications } from './src/services/notificationService';
import { useAppStore } from './src/store';
import { ForceUpdateScreen } from './src/components/ForceUpdateScreen';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const { isDark } = useTheme();
  const toastRef = useRef<ToastRef>(null);

  useEffect(() => {
    // 1. Sync & Recurring on Resume
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('App: Resumed, triggering sync and recurring check...');
        syncEngine.runSync();
        
        // Trigger recurring engine
        const { processRecurringTransactions } = require('./src/services/recurringService');
        processRecurringTransactions().catch((e: any) => console.error('Recurring error on resume:', e));
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // 2. Stability Timer for Toast
    const timer = setInterval(() => {
      if (toastRef.current && toastService.ref !== toastRef.current) {
        toastService.ref = toastRef.current;
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const setupApp = async () => {
      try {
        await initDatabase();
        await soundEngine.init(); 
        syncService.init(); 
        
        // Trigger recurring engine once database is ready
        const { processRecurringTransactions } = require('./src/services/recurringService');
        processRecurringTransactions().catch((e: any) => console.error('Recurring error on init:', e));
        
        // Ensure notifications are scheduled
        const { remindersEnabled, dailyReminderTime } = useAppStore.getState();
        if (remindersEnabled) {
          const { requestNotificationPermissions } = require('./src/services/notificationService');
          await requestNotificationPermissions();
        }
        await initializeNotifications(remindersEnabled, dailyReminderTime);

        // Initial sync handled by AuthProvider
        setIsReady(true);
      } catch (error) {
        console.error('App setup error:', error);
      } finally {
        setIsReady(true);
      }
    };

    setupApp();
  }, []);

  if (!isReady) {
    return <Loader message="Starting engine..." />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }} edges={['top', 'left', 'right']}>
            <AuthProvider>
              <AppNavigator />
            </AuthProvider>
            <ForceUpdateScreen />
            <Toast ref={toastRef} />
            <StatusBar style={isDark ? 'light' : 'dark'} />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
