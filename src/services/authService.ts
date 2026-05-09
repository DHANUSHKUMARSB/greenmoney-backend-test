import { supabase } from './supabase';
import { useAuthStore } from '../store/authStore';

export const signUp = async (email: string, password: string, username: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username,
      }
    }
  });

  if (error) {
    throw error;
  }

  return data;
};

export const sendPasswordResetEmail = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'greenmoney://reset-password',
  });
  if (error) throw error;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }
  
  // Clear local stores
  const { useAppStore } = require('../store');
  const { useThemeStore } = require('../store/themeStore');
  
  useAuthStore.getState().setSession(null);
  useAuthStore.getState().setUser(null);
  useAuthStore.getState().setUsername(null);
  
  useAppStore.getState().clearAppStore();
  useThemeStore.getState().setThemeMode('system');
  useThemeStore.getState().setAccentColor('#2196F3');
};

export const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
};
