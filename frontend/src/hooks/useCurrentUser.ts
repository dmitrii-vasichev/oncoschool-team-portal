"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import type { TeamMember, TelegramAuthData } from "@/lib/types";

interface AuthContextValue {
  user: TeamMember | null;
  loading: boolean;
  loginWithTelegram: (data: TelegramAuthData) => Promise<void>;
  loginWithTelegramId: (telegramId: number) => Promise<void>;
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

  const loginWithTelegram = useCallback(async (data: TelegramAuthData) => {
    await api.loginWithTelegram(data);
    const me = await api.getMe();
    setUser(me);
  }, []);

  const loginWithTelegramId = useCallback(async (telegramId: number) => {
    await api.devLogin(telegramId);
    const me = await api.getMe();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  return { user, loading, loginWithTelegram, loginWithTelegramId, logout, refreshUser };
}

export function createAuthProvider(children: ReactNode, value: AuthContextValue) {
  // This is a helper — actual Provider is in AuthProvider component
  return { children, value };
}
