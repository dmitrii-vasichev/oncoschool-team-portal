"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface TelegramMainButton {
  setText: (text: string) => void;
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
  showProgress: (leaveActive: boolean) => void;
  hideProgress: () => void;
}

interface TelegramBackButton {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
  };
  colorScheme: "light" | "dark";
  ready: () => void;
  expand: () => void;
  MainButton: TelegramMainButton;
  BackButton: TelegramBackButton;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

interface TelegramContextType {
  initDataRaw: string | null;
  userId: number | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  colorScheme: "light" | "dark";
  isReady: boolean;
  isTelegram: boolean;
}

const TelegramContext = createContext<TelegramContextType>({
  initDataRaw: null,
  userId: null,
  firstName: null,
  lastName: null,
  username: null,
  colorScheme: "light",
  isReady: false,
  isTelegram: false,
});

export function useTelegram() {
  return useContext(TelegramContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TelegramContextType>({
    initDataRaw: null,
    userId: null,
    firstName: null,
    lastName: null,
    username: null,
    colorScheme: "light",
    isReady: false,
    isTelegram: false,
  });

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (tg && tg.initData) {
      const user = tg.initDataUnsafe?.user;

      tg.ready();
      tg.expand();

      setState({
        initDataRaw: tg.initData || null,
        userId: user?.id ?? null,
        firstName: user?.first_name ?? null,
        lastName: user?.last_name ?? null,
        username: user?.username ?? null,
        colorScheme: tg.colorScheme === "dark" ? "dark" : "light",
        isReady: true,
        isTelegram: true,
      });
    } else {
      // Not inside Telegram — dev/browser mode
      setState({
        initDataRaw: null,
        userId: null,
        firstName: null,
        lastName: null,
        username: null,
        colorScheme: "light",
        isReady: true,
        isTelegram: false,
      });
    }
  }, []);

  if (!state.isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tg-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-tg-button border-t-transparent" />
      </div>
    );
  }

  return (
    <TelegramContext.Provider value={state}>
      {children}
    </TelegramContext.Provider>
  );
}
