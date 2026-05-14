import React, { useEffect } from 'react';
import { auth } from '../services/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuthStore } from '../store/authStore';
import { setupDefaultDataForUser } from '../services/database';
import { processRecurringTransactions } from '../services/recurringService';
import { syncEngine } from '../services/syncEngine';
import { syncEvents } from '../services/syncEvents';
import { useAppStore } from '../store';
import { Loader } from './Loader';
import { firebaseProfileService } from '../services/firebaseProfileService';
import { profileMigrationService } from '../services/profileMigrationService';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { 
    setUser, setUsername, setProfileImage, setFirebaseProfile,
    setLoading, isLoading, loadingMessage 
  } = useAuthStore();
  const clearAppStore = useAppStore(state => state.setTransactions);
  const profileUnsubscribe = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    // Firebase Auth State Listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log('[AUTH]: State changed. User:', user?.email || 'Logged Out');
      
      if (user) {
        setLoading(true, 'Syncing account...');
        setUser(user);

        try {
          // 0. Migrate legacy data if needed (optional now, but keeping for compatibility)
          await profileMigrationService.migrateIfNeeded(user.uid);
          
          // 1. Ensure Profile exists and fetch it
          const fbProfile = await firebaseProfileService.ensureProfile(user.uid, {
            email: user.email || '',
            username: user.displayName || user.email?.split('@')[0] || 'User'
          });
          
          if (fbProfile) {
            setFirebaseProfile(fbProfile);
            setUsername(fbProfile.username);
            setProfileImage(fbProfile.profilePhoto);
          }

          // 2. Setup Realtime Profile Listener
          if (profileUnsubscribe.current) profileUnsubscribe.current();
          profileUnsubscribe.current = firebaseProfileService.subscribeToProfile(user.uid, (profile) => {
            if (profile) {
              setFirebaseProfile(profile);
              setUsername(profile.username);
              setProfileImage(profile.profilePhoto);
            }
          });

          // 3. Initialize Finance Data (MongoDB + Sync)
          await setupDefaultDataForUser(); 
          syncEvents.emitSyncCompleted(); 
          await processRecurringTransactions();
          
          console.log('[AUTH]: Initial session found, performing sync...');
          await syncEngine.runSync();
          console.log('[AUTH]: Initial sync complete.');

        } catch (e: any) {
          console.error('[AUTH]: Initialization error:', e.message);
        } finally {
          setLoading(false);
        }
      } else {
        // Logged out state
        if (profileUnsubscribe.current) profileUnsubscribe.current();
        setUser(null);
        setFirebaseProfile(null);
        clearAppStore([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (profileUnsubscribe.current) profileUnsubscribe.current();
    };
  }, []);

  if (isLoading) {
    return <Loader message={loadingMessage} />;
  }

  return <>{children}</>;
};
