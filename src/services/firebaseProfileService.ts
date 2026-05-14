import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  profilePhoto: string | null;
  createdAt: any;
  updatedAt: any;
  lastLoginAt: any;
}

export const firebaseProfileService = {
  /**
   * Create or update user profile in Firestore
   */
  async ensureProfile(uid: string, data: Partial<UserProfile>) {
    const userRef = doc(db, "users", uid);
    
    try {
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const newProfile: UserProfile = {
          uid,
          username: data.username || "User",
          displayName: data.displayName || data.username || "User",
          email: data.email || "",
          profilePhoto: data.profilePhoto || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        };
        await setDoc(userRef, newProfile);
        return newProfile;
      } else {
        await updateDoc(userRef, {
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return userSnap.data() as UserProfile;
      }
    } catch (error: any) {
      // If offline, we can't 'ensure' the profile exists on server, 
      // but onSnapshot will handle local cache and future sync.
      console.log('[FIREBASE]: ensureProfile offline or error:', error.message);
      return null;
    }
  },

  /**
   * Update username and display name
   */
  async updateUsername(uid: string, username: string) {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      username,
      displayName: username,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },

  /**
   * Upload profile image and save URL to Firestore
   */
  async uploadAvatar(uid: string, base64Image: string) {
    // We now store the image directly in Firestore to avoid Storage bucket region issues.
    // Firestore docs have a 1MB limit, which is plenty for a profile avatar (~50KB).
    
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      profilePhoto: base64Image,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return base64Image;
  },

  /**
   * Realtime profile listener
   */
  subscribeToProfile(uid: string, callback: (profile: UserProfile | null) => void) {
    const userRef = doc(db, "users", uid);
    return onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data() as UserProfile);
      } else {
        callback(null);
      }
    });
  },

  /**
   * Fetch profile once
   */
  async getProfile(uid: string) {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      return userSnap.exists() ? (userSnap.data() as UserProfile) : null;
    } catch (error) {
      return null;
    }
  }
};
