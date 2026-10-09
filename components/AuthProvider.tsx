"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface SessionUser {
  id: string;
  email: string;
  role: "user" | "admin";
}

interface AuthContextValue {
  user: SessionUser | null;
  accessToken: string | null;
  isLoading: boolean;
  acceptSession: (user: SessionUser, accessToken: string) => void;
  refreshSession: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshPromise = useRef<Promise<boolean> | null>(null);

  const acceptSession = useCallback((nextUser: SessionUser, token: string) => {
    setUser(nextUser);
    setAccessToken(token);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
  }, []);

  const refreshSession = useCallback((): Promise<boolean> => {
    if (refreshPromise.current) return refreshPromise.current;

    refreshPromise.current = (async () => {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) {
          clearSession();
          return false;
        }

        const result = (await response.json()) as {
          user?: SessionUser;
          accessToken?: string;
        };
        if (!result.user || !result.accessToken) {
          clearSession();
          return false;
        }

        acceptSession(result.user, result.accessToken);
        return true;
      } catch {
        clearSession();
        return false;
      } finally {
        setIsLoading(false);
        refreshPromise.current = null;
      }
    })();

    return refreshPromise.current;
  }, [acceptSession, clearSession]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!accessToken) return;
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1])) as { exp?: number };
      if (!payload.exp) return;
      const refreshIn = Math.max(1000, payload.exp * 1000 - Date.now() - 60_000);
      const timer = window.setTimeout(() => void refreshSession(), refreshIn);
      return () => window.clearTimeout(timer);
    } catch {
      clearSession();
    }
  }, [accessToken, clearSession, refreshSession]);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isLoading, acceptSession, refreshSession, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}