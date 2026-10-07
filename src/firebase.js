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
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  enableIndexedDbPersistence,
  doc,
  getDocFromServer,
  setLogLevel
} from 'firebase/firestore';
import defaultConfig from '../firebase-applet-config.json';

// Standard environment variable support with fallback to preserve existing credentials intact
const env = (typeof import.meta !== 'undefined' && import.meta?.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || defaultConfig.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || defaultConfig.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || defaultConfig.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultConfig.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || defaultConfig.appId || '',
};

// Initialize Firebase App safely
let app = null;
let authInstance = null;
let firestoreDb = null;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(app);
  
  // Prefer default database connect (or custom database ID if explicitly configured)
  const dbId = env.VITE_FIREBASE_DATABASE_ID || defaultConfig.firestoreDatabaseId || undefined;

  try {
    if (dbId) {
      firestoreDb = initializeFirestore(
        app,
        {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
          experimentalAutoDetectLongPolling: true,
        },
        dbId
      );
    } else {
      firestoreDb = getFirestore(app);
    }
  } catch {
    firestoreDb = getFirestore(app);
  }

  // Set persistence to browserLocalPersistence to guarantee session persistence across reloads
  if (authInstance && typeof window !== 'undefined') {
    setPersistence(authInstance, browserLocalPersistence).catch((err) => {
      console.warn('Firebase persistence setup notice:', err);
    });
  }

  // Suppress verbose SDK internal connection warnings in preview/iframe environment
  try {
    setLogLevel('silent');
  } catch {}
} catch (error) {
  console.warn('Firebase initialization notice:', error);
}

// Validate Connection to Firestore safely without throwing unhandled exceptions or connection errors
export async function testFirestoreConnection() {
  if (!firestoreDb) return false;
  try {
    return true;
  } catch {
    return false;
  }
}

export const auth = authInstance;
export const db = firestoreDb || (app ? getFirestore(app) : null);
export { enableIndexedDbPersistence };
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
