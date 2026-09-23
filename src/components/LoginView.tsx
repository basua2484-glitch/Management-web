import React from 'react';
import { LoginPage } from './LoginPage';
import type { AppUser } from '../types';

export interface LoginViewProps {
  onLoginSuccess?: (user?: AppUser, redirectUrl?: string) => void;
  users?: AppUser[];
  errorFlash?: string | null;
  onClearError?: () => void;
  onFlashMessage?: (message: string, type?: 'danger' | 'warning' | 'success' | 'info') => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  return <LoginPage onLoginSuccess={() => onLoginSuccess?.()} />;
};

export default LoginView;
