import { auth } from './firebaseConfig';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  updatePassword as firebaseUpdatePassword,
  updateProfile,
} from 'firebase/auth';
import { useAuthStore } from '../store/authStore';
import { firebaseProfileService } from './firebaseProfileService';
import { userTrackingService } from './userTrackingService';

export const signUp = async (email: string, password: string, username: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Set display name in Firebase Auth
    await updateProfile(user, { displayName: username });

    // Create profile in Firestore
    await firebaseProfileService.ensureProfile(user.uid, {
      email,
      username,
      displayName: username,
    });

    // Track registration in MongoDB tracking system
    userTrackingService.trackRegistration(user.uid, email);

    return user;
  } catch (error: any) {
    console.error('[AUTH]: Signup failed', error.code, error.message);
    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    console.error('[AUTH]: Signin failed', error.code, error.message);
    throw error;
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    
    // Clear local stores
    const { useAppStore } = require('../store');
    const { useThemeStore } = require('../store/themeStore');
    
    useAuthStore.getState().setUser(null);
    useAuthStore.getState().setUsername(null);
    useAuthStore.getState().setProfileImage(null);
    useAuthStore.getState().setFirebaseProfile(null);
    
    useAppStore.getState().clearAppStore();
    useThemeStore.getState().setThemeMode('system');
    useThemeStore.getState().setAccentColor('#2196F3');
    
    console.log('[AUTH]: Logged out successfully');
  } catch (error: any) {
    console.error('[AUTH]: Signout failed', error.message);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email: string) => {
  try {
    // Firebase handles the reset flow via its own hosted page or deep links.
    // By default, it sends an email with a link to a Firebase-hosted page.
    await firebaseSendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('[AUTH]: Password reset failed', error.code, error.message);
    throw error;
  }
};

export const updatePassword = async (newPassword: string) => {
  if (!auth.currentUser) throw new Error('No user logged in');
  try {
    await firebaseUpdatePassword(auth.currentUser, newPassword);
  } catch (error: any) {
    console.error('[AUTH]: Update password failed', error.code, error.message);
    throw error;
  }
};
