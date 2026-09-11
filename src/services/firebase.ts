import type { User } from 'firebase/auth';
import {
  auth,
  app,
  provider,
  firebaseConfig,
  initAuth as jsInitAuth,
  googleSignIn as jsGoogleSignIn,
  getAccessToken as jsGetAccessToken,
  logout as jsLogout,
} from '../firebase';

export { auth, app, provider, firebaseConfig };

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
): (() => void) => {
  return jsInitAuth(onAuthSuccess, onAuthFailure);
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  return jsGoogleSignIn();
};

export const getAccessToken = async (): Promise<string | null> => {
  return jsGetAccessToken();
};

export const logout = async (): Promise<void> => {
  return jsLogout();
};

