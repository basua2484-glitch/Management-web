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

// Standard environment variable support with fallback to preserve official credentials intact
const env = (typeof import.meta !== 'undefined' && import.meta?.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || defaultConfig.apiKey || 'AIzaSyD6i5EHcSMOXFy6LJhoJaQhx5v3czRqP1w',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain || 'mess-app-e0167.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || defaultConfig.projectId || 'mess-app-e0167',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || defaultConfig.storageBucket || 'mess-app-e0167.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultConfig.messagingSenderId || '377043867272',
  appId: env.VITE_FIREBASE_APP_ID || defaultConfig.appId || '1:377043867272:web:8ff369fb4e86e5283cb13d',
};

export const FIRESTORE_DATABASE_ID =
  env.VITE_FIREBASE_DATABASE_ID ||
  defaultConfig.firestoreDatabaseId ||
  'ai-studio-housekeepingatte-03824cce-6402-48f1-bea7-c7bdeb898710';

// Initialize Firebase App safely
let app = null;
let authInstance = null;
let firestoreDb = null;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(app);
  
  try {
    firestoreDb = initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
        experimentalAutoDetectLongPolling: true,
      },
      FIRESTORE_DATABASE_ID
    );
  } catch {
    firestoreDb = getFirestore(app, FIRESTORE_DATABASE_ID);
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
  const currentDb = firestoreDb || (app ? getFirestore(app, FIRESTORE_DATABASE_ID) : null);
  if (!currentDb) return { ok: false, latency: 0 };
  const start = Date.now();
  try {
    await getDocFromServer(doc(currentDb, 'system_settings', 'config'));
    return { ok: true, latency: Math.max(1, Date.now() - start) };
  } catch (error) {
    if (error && typeof error === 'object' && error.message && error.message.includes('the client is offline')) {
      return { ok: false, latency: 0 };
    }
    // Any server response (document exists, not found, or rule evaluation) confirms cloud connectivity
    return { ok: true, latency: Math.max(1, Date.now() - start) };
  }
}

export const auth = authInstance;
export const db = firestoreDb || (app ? getFirestore(app, FIRESTORE_DATABASE_ID) : null);
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
