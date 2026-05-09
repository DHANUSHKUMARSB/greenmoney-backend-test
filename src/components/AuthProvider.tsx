import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import { setupDefaultDataForUser } from '../services/database';
import { processRecurringTransactions } from '../services/recurringService';
import { syncEngine } from '../services/syncEngine';
import { syncEvents } from '../services/syncEvents';
import { useAppStore } from '../store';


export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { setSession, setUser, setUsername, setLoading } = useAuthStore();
  const clearAppStore = useAppStore(state => state.setTransactions);

  useEffect(() => {
    let settled = false;

    const settle = async (session: any) => {
      if (settled) return;
      settled = true;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const metadata = session.user.user_metadata;
        const name = metadata?.username || session.user.email?.split('@')[0] || 'User';
        setUsername(name);
        try { 
          await setupDefaultDataForUser(); 
          syncEvents.emitSyncCompleted(); // Refresh UI filters immediately
          await processRecurringTransactions();
          console.log('AuthProvider: Initial session found, triggering sync...');
          syncEngine.runSync();
        }
        catch (e) { console.error('Setup error:', e); }
      } else {
        clearAppStore([]);
      }
      setLoading(false);
    };

    const init = async () => {
      try {
        // Use Supabase SDK to get the current session.
        // This automatically handles reading from AsyncStorage and refreshing the token if needed.
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session restore error:', error);
          await settle(null);
          return;
        }

        await settle(session);
      } catch (err) {
        console.error('Unexpected session restore error:', err);
        await settle(null);
      }
    };

    init();

    // ── Listen for sign-in / sign-out events ──────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!settled) return; // let init() handle the first call
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const metadata = session.user.user_metadata;
        const name = metadata?.username || session.user.email?.split('@')[0] || 'User';
        setUsername(name);
        try { 
          await setupDefaultDataForUser(); 
          await processRecurringTransactions();
          console.log('AuthProvider: Auth state changed, triggering sync...');
          syncEngine.runSync();
        }
        catch (e) { console.error('Setup error:', e); }
      } else {
        clearAppStore([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
};
