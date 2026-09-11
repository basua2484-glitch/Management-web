import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import defaultConfig from '../firebase-applet-config.json';

// Standard environment variable support with fallback to preserve existing credentials intact
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultConfig.appId || '',
};

// Initialize Firebase App safely
let app = null;
let authInstance = null;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(app);

  // Set persistence to browserLocalPersistence to guarantee session persistence across reloads
  if (authInstance && typeof window !== 'undefined') {
    setPersistence(authInstance, browserLocalPersistence).catch((err) => {
      console.warn('Firebase persistence setup notice:', err);
    });
  }
} catch (error) {
  console.warn('Firebase initialization notice:', error);
}

export const auth = authInstance;
export { app, firebaseConfig };

// Google Auth Provider with Google Sheets Scope for Workspace Sync
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.setCustomParameters({
  prompt: 'select_account'
});

export { provider };

let isSigningIn = false;
let cachedAccessToken = null;

/**
 * Listen for Firebase Auth state changes
 */
export const initAuth = (onAuthSuccess, onAuthFailure) => {
  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }

  try {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        try {
          if (user) {
            if (cachedAccessToken) {
              if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
            } else if (!isSigningIn) {
              if (onAuthSuccess) onAuthSuccess(user, '');
            }
          } else {
            cachedAccessToken = null;
            if (onAuthFailure) onAuthFailure();
          }
        } catch (innerErr) {
          console.warn('Error in auth state listener callback:', innerErr);
        }
      },
      (error) => {
        console.warn('Firebase Auth state change error:', error);
        if (onAuthFailure) onAuthFailure();
      }
    );

    return typeof unsubscribe === 'function' ? unsubscribe : () => {};
  } catch (err) {
    console.warn('Failed to subscribe to auth state changes:', err);
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
};

/**
 * Sign in with popup and cache access token in memory
 */
export const googleSignIn = async () => {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized');
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google did not return an OAuth access token. Please grant the requested permissions.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Firebase Auth sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async () => {
  return cachedAccessToken;
};

export const logout = async () => {
  if (auth) {
    await signOut(auth);
  }
  cachedAccessToken = null;
};

export default app;
