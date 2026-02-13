"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { useTelegram } from "./TelegramProvider";
import type { TeamMember, MemberRole } from "@/lib/types";

interface AuthContextValue {
  member: TeamMember | null;
  role: MemberRole | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  member: null,
  role: null,
  isLoading: true,
  error: null,
  retry: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isTelegram, initDataRaw } = useTelegram();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [role, setRole] = useState<MemberRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (isTelegram && initDataRaw) {
        // Telegram Mini App auth — send initData to backend
        const loginResp = await api.loginMiniApp(initDataRaw);
        setRole(loginResp.role as MemberRole);
      } else if (process.env.NEXT_PUBLIC_DEBUG === "true") {
        // Dev mode — prompt for Telegram ID
        const storedId =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem("dev_telegram_id")
            : null;

        if (!storedId) {
          setIsLoading(false);
          setError("dev_login_needed");
          return;
        }

        const loginResp = await api.devLogin(parseInt(storedId, 10));
        setRole(loginResp.role as MemberRole);
      } else {
        setIsLoading(false);
        setError("not_in_telegram");
        return;
      }

      // Fetch full member profile
      const me = await api.getMe();
      setMember(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setIsLoading(false);
    }
  }, [isTelegram, initDataRaw]);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  const retry = useCallback(() => {
    authenticate();
  }, [authenticate]);

  return (
    <AuthContext.Provider value={{ member, role, isLoading, error, retry }}>
      {children}
    </AuthContext.Provider>
  );
}
