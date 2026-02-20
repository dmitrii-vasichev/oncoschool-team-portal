"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import type { TeamMember, TelegramAuthData } from "@/lib/types";

interface AuthContextValue {
  user: TeamMember | null;
  loading: boolean;
  loginWithTelegram: (data: TelegramAuthData) => Promise<void>;
  loginWithTelegramWebApp: (initData: string) => Promise<void>;
  loginWithTelegramId: (telegramId: number) => Promise<void>;
  loginWithWebLogin: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useCurrentUser(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used within AuthProvider");
  }
  return ctx;
}

export { AuthContext };

export function useAuthProvider(): AuthContextValue {
  const [user, setUser] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = api.getToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
      api.logout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Re-fetch user data when tab regains focus (picks up avatar changes etc.)
  const lastRefreshRef = useRef(0);
  useEffect(() => {
    function onFocus() {
      // Throttle: at most once per 30 seconds
      if (Date.now() - lastRefreshRef.current < 30_000) return;
      if (!api.getToken()) return;
      lastRefreshRef.current = Date.now();
      refreshUser();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshUser]);

  const loginWithTelegram = useCallback(async (data: TelegramAuthData) => {
    await api.loginWithTelegram(data);
    const me = await api.getMe();
    setUser(me);
  }, []);

  const loginWithTelegramWebApp = useCallback(async (initData: string) => {
    await api.loginWithTelegramWebApp(initData);
    const me = await api.getMe();
    setUser(me);
  }, []);

  const loginWithTelegramId = useCallback(async (telegramId: number) => {
    await api.devLogin(telegramId);
    const me = await api.getMe();
    setUser(me);
  }, []);

  const loginWithWebLogin = useCallback(async (token: string) => {
    api.setToken(token);
    const me = await api.getMe();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  return {
    user,
    loading,
    loginWithTelegram,
    loginWithTelegramWebApp,
    loginWithTelegramId,
    loginWithWebLogin,
    logout,
    refreshUser,
  };
}

export function createAuthProvider(children: ReactNode, value: AuthContextValue) {
  // This is a helper — actual Provider is in AuthProvider component
  return { children, value };
}
