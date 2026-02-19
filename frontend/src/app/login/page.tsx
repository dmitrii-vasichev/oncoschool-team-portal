"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/api";
import {
  Loader2,
  MessageCircle,
  Smartphone,
  Send,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

/* ─── Pulsing dots animation ─── */
function PulsingDots() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
      <span
        className="h-2 w-2 rounded-full bg-primary animate-pulse"
        style={{ animationDelay: "0.2s" }}
      />
      <span
        className="h-2 w-2 rounded-full bg-primary animate-pulse"
        style={{ animationDelay: "0.4s" }}
      />
    </div>
  );
}

type LoginStep = "username" | "waiting" | "error";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [botUsername, setBotUsername] = useState<string>(
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || ""
  );
  const [configLoading, setConfigLoading] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [telegramId, setTelegramId] = useState("");

  // Web login state
  const [step, setStep] = useState<LoginStep>("username");
  const [username, setUsername] = useState("");
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { loginWithTelegramId, loginWithWebLogin } = useCurrentUser();
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

  // Cleanup polling & countdown on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (reqId: string) => {
      // Clear any existing timers to prevent leaks
      stopPolling();

      // Countdown timer
      setCountdown(300);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            stopPolling();
            setStep("error");
            setError("Время ожидания истекло. Попробуйте снова.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Poll for status
      pollingRef.current = setInterval(async () => {
        try {
          const result = await api.checkWebLoginStatus(reqId);

          if (result.status === "confirmed" && result.access_token) {
            stopPolling();
            await loginWithWebLogin(result.access_token);
            router.push("/");
          } else if (result.status === "expired") {
            stopPolling();
            setStep("error");
            setError("Время ожидания истекло. Попробуйте снова.");
          }
          // status === "pending" — keep polling
        } catch {
          // Network error — keep polling, don't stop
        }
      }, 2000);
    },
    [stopPolling, loginWithWebLogin, router]
  );

  const handleWebLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const cleanUsername = username.trim().replace(/^@/, "");
      if (!cleanUsername) {
        setError("Введите ваш username в Telegram");
        return;
      }

      setLoading(true);
      try {
        const result = await api.initiateWebLogin(cleanUsername);
        setStep("waiting");
        startPolling(result.request_id);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Ошибка при отправке запроса";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [username, startPolling]
  );

  const handleCancel = useCallback(() => {
    stopPolling();
    setStep("username");
    setError(null);
  }, [stopPolling]);

  const handleRetry = useCallback(() => {
    stopPolling();
    setStep("username");
    setError(null);
  }, [stopPolling]);

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

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex min-h-screen">
      {/* ──────── Left decorative panel ──────── */}
      <div
        className="relative hidden lg:flex lg:w-[45%] xl:w-[50%] flex-col items-center justify-center overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, hsl(210, 22%, 16%) 0%, hsl(200, 20%, 14%) 40%, hsl(174, 50%, 20%) 80%, hsl(174, 62%, 26%) 100%)",
        }}
      >
        {/* Subtle cross pattern overlay */}
        <CrossPattern />

        {/* Decorative circles */}
        <div
          className="absolute -top-24 -left-24 h-80 w-80 rounded-full opacity-[0.07]"
          style={{
            background:
              "radial-gradient(circle, hsl(174, 62%, 26%), transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle, #ffffff, transparent 70%)",
          }}
        />

        {/* Logo + slogan */}
        <div className="relative z-10 flex flex-col items-center gap-6 px-8 animate-login-fade-in">
          <div
            className="animate-login-scale-in"
            style={{ animationDelay: "0.15s" }}
          >
            <div className="rounded-2xl bg-white/95 p-6 shadow-2xl shadow-black/20 animate-login-float">
              <Image
                src="/logo.webp"
                alt="Онкошкола"
                width={280}
                height={80}
                priority
                sizes="(min-width: 1280px) 280px, 240px"
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
              background:
                "linear-gradient(135deg, hsl(210, 22%, 16%) 0%, hsl(174, 50%, 20%) 80%, hsl(174, 62%, 26%) 100%)",
            }}
          >
            <Image
              src="/logo-mobile.webp"
              alt="Онкошкола"
              width={200}
              height={56}
              priority
              sizes="180px"
              className="h-auto w-[180px]"
            />
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Управление задачами команды
          </p>
        </div>

        {/* Auth card */}
        <div
          className="w-full max-w-sm animate-login-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="mb-8">
            <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">
              Войти в систему
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Авторизуйтесь через Telegram для входа
            </p>
          </div>

          <div className="space-y-5">
            {configLoading ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Загрузка...
                </span>
              </div>
            ) : debugMode ? (
              /* ─── Dev mode: login by Telegram ID ─── */
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
                <Button
                  type="submit"
                  className="w-full rounded-xl"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Авторизация...
                    </>
                  ) : (
                    "Войти"
                  )}
                </Button>
                {error && (
                  <div className="rounded-xl bg-destructive/5 border border-destructive/15 px-4 py-3">
                    <p className="text-sm text-destructive text-center">
                      {error}
                    </p>
                  </div>
                )}
              </form>
            ) : step === "username" ? (
              /* ─── Step 1: Enter username ─── */
              <form onSubmit={handleWebLogin} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Ваш @username в Telegram"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value.replace(/^@/, ""));
                      setError(null);
                    }}
                    className="rounded-xl"
                    autoFocus
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-destructive/5 border border-destructive/15 px-4 py-3">
                    <p className="text-sm text-destructive text-center">
                      {error}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full rounded-xl"
                  disabled={loading || !username.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Отправка...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Войти через Telegram
                    </>
                  )}
                </Button>
              </form>
            ) : step === "waiting" ? (
              /* ─── Step 2: Waiting for confirmation ─── */
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Smartphone className="h-7 w-7 text-primary" />
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-base font-medium text-foreground">
                      Подтвердите вход в Telegram
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Мы отправили запрос в Telegram. Откройте бота и нажмите
                      &laquo;Подтвердить вход&raquo;.
                    </p>
                  </div>

                  <PulsingDots />

                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span>Осталось</span>
                    <span className="font-mono font-medium text-foreground">
                      {formatCountdown(countdown)}
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={handleCancel}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Отмена
                </Button>
              </div>
            ) : (
              /* ─── Step 3: Error / Timeout ─── */
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
                    <XCircle className="h-7 w-7 text-destructive" />
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-base font-medium text-foreground">
                      Не удалось войти
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {error || "Произошла ошибка. Попробуйте снова."}
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full rounded-xl"
                  onClick={handleRetry}
                >
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
                Напишите /start боту
                {botUsername ? ` @${botUsername}` : ""} в Telegram
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
