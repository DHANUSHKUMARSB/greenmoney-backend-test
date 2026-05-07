import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { logger } from './src/utils/logger';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const { isDark } = useTheme();
  const toastRef = useRef<ToastRef>(null);

  useEffect(() => {
    // 1. Sync on Resume
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('App: Resumed, triggering sync...');
        syncEngine.runSync();
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
        syncService.init(); // Initialize sync listeners
        // Initial sync handled by AuthProvider
      } catch (error) {
        console.error('App setup error:', error);
      } finally {
        setIsReady(true);
      }
    };

    setupApp();
  }, []);

  if (!isReady) {
    return <Loader />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
          <Toast ref={toastRef} />
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
