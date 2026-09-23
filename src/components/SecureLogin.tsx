import React from 'react';
import { LoginPage, LoginPageProps } from './LoginPage';

export interface SecureLoginProps {
  onLogin?: (
    staffId: string,
    password: string,
    setError: (msg: string) => void
  ) => Promise<void> | void;
}

export default function SecureLogin(props: SecureLoginProps) {
  return <LoginPage onLoginSuccess={() => {}} />;
}
