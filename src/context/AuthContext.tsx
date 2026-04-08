import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest, onUnauthorized } from '../lib/api';
import type { AuthSession } from '../types';

interface AuthContextType {
  session: AuthSession;
  isLoading: boolean;
  error: string | null;
  dismissError: () => void;
  loginEditor: (username: string, password: string) => Promise<void>;
  loginViewer: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  isAuthenticated: boolean;
  isEditor: boolean;
  isViewer: boolean;
}

const unauthenticatedSession: AuthSession = {
  authenticated: false,
  role: null,
  username: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession>(unauthenticatedSession);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const nextSession = await apiRequest<AuthSession>('/auth/session');
      setSession(nextSession);
      setError(null);
    } catch (sessionError) {
      setSession(unauthenticatedSession);
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to load session');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      await refreshSession();
      setIsLoading(false);
    })();
  }, [refreshSession]);

  useEffect(() => {
    return onUnauthorized(() => {
      setSession(unauthenticatedSession);
    });
  }, []);

  const loginEditor = useCallback(async (username: string, password: string) => {
    setError(null);
    const nextSession = await apiRequest<AuthSession>('/auth/login/editor', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setSession(nextSession);
  }, []);

  const loginViewer = useCallback(async () => {
    setError(null);
    const nextSession = await apiRequest<AuthSession>('/auth/login/viewer', {
      method: 'POST',
    });
    setSession(nextSession);
  }, []);

  const logout = useCallback(async () => {
    setError(null);

    try {
      await apiRequest<void>('/auth/logout', {
        method: 'POST',
      });
    } catch (logoutError) {
      if (!(logoutError instanceof ApiError && logoutError.status === 401)) {
        throw logoutError;
      }
    }

    setSession(unauthenticatedSession);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      isLoading,
      error,
      dismissError,
      loginEditor,
      loginViewer,
      logout,
      refreshSession,
      isAuthenticated: session.authenticated,
      isEditor: session.role === 'editor',
      isViewer: session.role === 'viewer',
    }),
    [dismissError, error, isLoading, loginEditor, loginViewer, logout, refreshSession, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
