"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle } from "lucide-react";

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

export default function LoginPage() {
  const [telegramId, setTelegramId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useCurrentUser();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const id = parseInt(telegramId, 10);
    if (!id || isNaN(id)) {
      setError("Введите корректный Telegram ID");
      return;
    }

    try {
      setLoading(true);
      await login(id);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  };

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

        {/* Form card */}
        <div className="w-full max-w-sm animate-login-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="mb-8">
            <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">
              Войти в систему
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Введите Telegram ID для авторизации
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="telegram_id"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                Telegram ID
              </Label>
              <Input
                id="telegram_id"
                type="text"
                inputMode="numeric"
                placeholder="123456789"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                disabled={loading}
                className="h-12 rounded-xl text-center text-lg font-mono tracking-wider border-border focus:border-primary focus:ring-ring/20"
              />
              <p className="text-xs text-muted-foreground/70 text-center">
                Узнать свой ID можно у бота{" "}
                <span className="font-medium text-muted-foreground">@userinfobot</span>
              </p>
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/5 border border-destructive/15 px-4 py-3">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-medium shadow-lg transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Вход...
                </>
              ) : (
                "Войти"
              )}
            </Button>
          </form>

          {/* Telegram hint */}
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-secondary/50 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Первый раз?{" "}
              <span className="font-medium text-foreground">
                Начните с Telegram-бота
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
