"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/api";
import type { TelegramAuthData } from "@/lib/types";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─── Cross pattern for the decorative panel ─── */
function CrossPattern() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="cross-pattern"
          x="0"
          y="0"
          width="60"
          height="60"
          patternUnits="userSpaceOnUse"
        >
          {/* Horizontal bar */}
          <rect x="22" y="27" width="16" height="6" rx="1" fill="white" />
          {/* Vertical bar */}
          <rect x="27" y="22" width="6" height="16" rx="1" fill="white" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#cross-pattern)" opacity="0.06" />
    </svg>
  );
}

/* ─── Telegram Login Widget ─── */
declare global {
  interface Window {
    onTelegramAuth: (user: TelegramAuthData) => void;
  }
}

function TelegramLoginButton({
  botUsername,
  onAuth,
  onError,
}: {
  botUsername: string;
  onAuth: (data: TelegramAuthData) => void;
  onError: (msg: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetLoading, setWidgetLoading] = useState(true);
  const [widgetKey, setWidgetKey] = useState(0);

  const handleAuth = useCallback(
    (user: TelegramAuthData) => {
      onAuth(user);
    },
    [onAuth]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !botUsername) return;

    // Register global callback
    window.onTelegramAuth = handleAuth;

    // Clear previous widget
    container.innerHTML = "";
    setWidgetLoading(true);

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-lang", "ru");

    script.onload = () => {
      setWidgetLoading(false);
    };

    script.onerror = () => {
      setWidgetLoading(false);
      onError("Не удалось загрузить Telegram Widget. Проверьте подключение к интернету");
    };

    container.appendChild(script);

    return () => {
      delete (window as Partial<typeof window>).onTelegramAuth;
    };
  }, [botUsername, handleAuth, onError, widgetKey]);

  const reload = useCallback(() => {
    setWidgetKey((k) => k + 1);
  }, []);

  if (!botUsername) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 text-center">
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Telegram Login не настроен. Обратитесь к администратору.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={containerRef}
        className="flex min-h-[48px] items-center justify-center"
      />
      {widgetLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Загрузка виджета...</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground/70">
        Нажмите кнопку для авторизации через Telegram
      </p>
      <button
        type="button"
        onClick={reload}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        Перезагрузить виджет
      </button>
    </div>
  );
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [botUsername, setBotUsername] = useState<string>(
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ""
  );
  const [configLoading, setConfigLoading] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [telegramId, setTelegramId] = useState("");
  const { loginWithTelegram, loginWithTelegramId } = useCurrentUser();
  const router = useRouter();

  // Fetch config from backend
  useEffect(() => {
    api
      .getAuthConfig()
      .then((cfg) => {
        if (cfg.bot_username) setBotUsername(cfg.bot_username);
        setDebugMode(!!cfg.debug);
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => setConfigLoading(false));
  }, []);

  const handleTelegramAuth = useCallback(
    async (data: TelegramAuthData) => {
      setError(null);
      setLoading(true);
      try {
        await loginWithTelegram(data);
        router.push("/");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Ошибка авторизации";

        if (message.includes("подпись") || message.includes("устарела")) {
          setError("Ошибка авторизации. Попробуйте ещё раз");
        } else if (message.includes("запрещён") || message.includes("403")) {
          setError(
            `У вас нет доступа. Сначала напишите /start боту @${botUsername} в Telegram, или обратитесь к модератору`
          );
        } else if (
          message.includes("Failed to fetch") ||
          message.includes("NetworkError")
        ) {
          setError("Не удалось подключиться к серверу");
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [loginWithTelegram, router, botUsername]
  );

  const handleDevLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const id = parseInt(telegramId.trim(), 10);
      if (!id || isNaN(id)) {
        setError("Введите корректный Telegram ID (число)");
        return;
      }
      setLoading(true);
      try {
        await loginWithTelegramId(id);
        router.push("/");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Ошибка авторизации";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [telegramId, loginWithTelegramId, router]
  );

  const handleWidgetError = useCallback((msg: string) => {
    setError(msg);
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* ──────── Left decorative panel ──────── */}
      <div
        className="relative hidden lg:flex lg:w-[45%] xl:w-[50%] flex-col items-center justify-center overflow-hidden"
        style={{
          background: "linear-gradient(135deg, hsl(210, 22%, 16%) 0%, hsl(200, 20%, 14%) 40%, hsl(174, 50%, 20%) 80%, hsl(174, 62%, 26%) 100%)",
        }}
      >
        {/* Subtle cross pattern overlay */}
        <CrossPattern />

        {/* Decorative circles */}
        <div
          className="absolute -top-24 -left-24 h-80 w-80 rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, hsl(174, 62%, 26%), transparent 70%)" }}
        />
        <div
          className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full opacity-[0.08]"
          style={{ background: "radial-gradient(circle, #ffffff, transparent 70%)" }}
        />

        {/* Logo + slogan */}
        <div className="relative z-10 flex flex-col items-center gap-6 px-8 animate-login-fade-in">
          <div className="animate-login-scale-in" style={{ animationDelay: "0.15s" }}>
            <div className="rounded-2xl bg-white/95 p-6 shadow-2xl shadow-black/20 animate-login-float">
              <Image
                src="/logo.png"
                alt="Онкошкола"
                width={280}
                height={80}
                priority
                className="h-auto w-[240px] xl:w-[280px]"
              />
            </div>
          </div>

          <div
            className="animate-login-slide-up text-center"
            style={{ animationDelay: "0.4s" }}
          >
            <p className="text-lg xl:text-xl font-medium text-white/90 tracking-wide">
              Управление задачами команды
            </p>
            <p className="mt-2 text-sm text-white/50">
              Telegram-бот &middot; Веб-интерфейс &middot; AI-парсинг
            </p>
          </div>
        </div>
      </div>

      {/* ──────── Right form panel ──────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-8 sm:px-8">
        {/* Mobile logo (shown only on <lg) */}
        <div className="mb-8 lg:hidden animate-login-scale-in">
          <div
            className="rounded-xl p-4 shadow-lg"
            style={{
              background: "linear-gradient(135deg, hsl(210, 22%, 16%) 0%, hsl(174, 50%, 20%) 80%, hsl(174, 62%, 26%) 100%)",
            }}
          >
            <Image
              src="/logo.png"
              alt="Онкошкола"
              width={200}
              height={56}
              priority
              className="h-auto w-[180px] brightness-0 invert"
            />
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Управление задачами команды
          </p>
        </div>

        {/* Auth card */}
        <div className="w-full max-w-sm animate-login-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="mb-8">
            <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">
              Войти в систему
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Авторизуйтесь через Telegram для входа
            </p>
          </div>

          <div className="space-y-5">
            {/* Loading overlay during auth request */}
            {loading && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Авторизация...</span>
              </div>
            )}

            {/* Error block */}
            {error && (
              <div className="rounded-xl bg-destructive/5 border border-destructive/15 px-4 py-3">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            {/* Telegram Login Widget or Dev Login */}
            {!loading && (
              configLoading ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Загрузка...</span>
                </div>
              ) : debugMode ? (
                <form onSubmit={handleDevLogin} className="space-y-3">
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Dev-режим — вход по Telegram ID
                    </p>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Telegram ID"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <Button type="submit" className="w-full rounded-xl">
                    Войти
                  </Button>
                </form>
              ) : (
                <TelegramLoginButton
                  botUsername={botUsername}
                  onAuth={handleTelegramAuth}
                  onError={handleWidgetError}
                />
              )
            )}

            {/* Retry button on error */}
            {error && !loading && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    window.location.reload();
                  }}
                  className="rounded-xl"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  Попробовать снова
                </Button>
              </div>
            )}
          </div>

          {/* Telegram hint */}
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-secondary/50 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Первый раз?{" "}
              <span className="font-medium text-foreground">
                Напишите /start боту{botUsername ? ` @${botUsername}` : ""} в Telegram
              </span>{" "}
              — он зарегистрирует вас в системе.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-auto pt-8 text-center text-xs text-muted-foreground/50">
          Онкошкола &middot; Таск-менеджер
        </p>
      </div>
    </div>
  );
}
