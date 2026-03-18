"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  Phone,
  Key,
  Hash,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/shared/Toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { api } from "@/lib/api";
import type { TelegramConnectionStatus } from "@/lib/types";

type ConnectionPhase = "loading" | "disconnected" | "connecting" | "code_entry" | "connected" | "error" | "not_configured";

/**
 * Telegram Connection management for admin settings.
 * Full flow: disconnected → enter credentials → verify code → connected.
 */
export function TelegramConnectionSection() {
  const { toastSuccess, toastError } = useToast();
  const [phase, setPhase] = useState<ConnectionPhase>("loading");
  const [status, setStatus] = useState<TelegramConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Connection form
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [showApiHash, setShowApiHash] = useState(false);

  // Verification form
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getTelegramConnectionStatus();
      setStatus(data);
      if (data.status === "not_configured") {
        setPhase("not_configured");
      } else if (data.status === "connected") {
        setPhase("connected");
      } else if (data.status === "code_required") {
        setPhase("code_entry");
      } else if (data.status === "password_required") {
        setPhase("code_entry");
        setNeedsPassword(true);
      } else if (data.status === "error") {
        setPhase("error");
      } else {
        setPhase("disconnected");
      }
    } catch {
      setPhase("disconnected");
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    if (!apiId.trim() || !apiHash.trim() || !phone.trim()) {
      toastError("Заполните все поля");
      return;
    }
    setBusy(true);
    try {
      const result = await api.connectTelegram({
        api_id: apiId.trim(),
        api_hash: apiHash.trim(),
        phone: phone.trim(),
      });
      setStatus(result);
      if (result.status === "code_required") {
        setPhase("code_entry");
        setNeedsPassword(false);
      } else if (result.status === "password_required") {
        setPhase("code_entry");
        setNeedsPassword(true);
      } else if (result.status === "connected") {
        setPhase("connected");
        toastSuccess("Telegram подключён");
      } else if (result.status === "error") {
        setPhase("error");
        toastError(result.error_message || "Ошибка подключения");
      }
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка подключения");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      toastError("Введите код");
      return;
    }
    setBusy(true);
    try {
      const result = await api.verifyTelegramCode({
        code: code.trim(),
        password: password.trim() || null,
      });
      setStatus(result);
      if (result.status === "connected") {
        setPhase("connected");
        toastSuccess("Telegram подключён");
        // Reset forms
        setApiId("");
        setApiHash("");
        setPhone("");
        setCode("");
        setPassword("");
      } else if (result.status === "code_required") {
        // Code expired — new code was sent automatically
        setCode("");
        toastError(result.error_message || "Код истёк. Новый код отправлен.");
      } else if (result.status === "password_required") {
        setNeedsPassword(true);
        toastError("Требуется пароль двухфакторной аутентификации");
      } else if (result.status === "error") {
        setPhase("error");
        toastError(result.error_message || "Неверный код");
      }
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка верификации");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await api.disconnectTelegram();
      setStatus(null);
      setPhase("disconnected");
      setApiId("");
      setApiHash("");
      setPhone("");
      setCode("");
      setPassword("");
      toastSuccess("Telegram отключён");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка отключения");
    } finally {
      setBusy(false);
      setShowDisconnectConfirm(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up stagger-2 rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-6 pb-0">
        <div className="h-9 w-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-sky-500" />
        </div>
        <div className="flex-1">
          <h2 className="font-heading font-semibold text-base">
            Telegram Userbot
          </h2>
          <p className="text-xs text-muted-foreground">
            Подключение для загрузки контента из каналов
          </p>
        </div>
        {/* Status badge */}
        {phase === "connected" && (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
            <Wifi className="h-3 w-3" />
            Подключён
          </Badge>
        )}
        {phase === "not_configured" && (
          <Badge variant="secondary" className="gap-1 text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            Не настроен
          </Badge>
        )}
        {(phase === "disconnected" || phase === "error") && (
          <Badge variant="secondary" className="gap-1 text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            Отключён
          </Badge>
        )}
      </div>

      <div className="p-6 space-y-4">
        {/* ── Not configured state ── */}
        {phase === "not_configured" && (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Требуется настройка сервера
              </span>
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              Для работы Telegram-подключения необходимо задать переменную окружения{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                TELEGRAM_ENCRYPTION_KEY
              </code>{" "}
              на сервере.
            </p>
          </div>
        )}

        {/* ── Connected state ── */}
        {phase === "connected" && status && (
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  Сессия активна
                </span>
              </div>
              {status.phone && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  {status.phone}
                </div>
              )}
              {status.connected_at && (
                <div className="text-xs text-muted-foreground">
                  Подключён:{" "}
                  {new Date(status.connected_at).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </div>

            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => setShowDisconnectConfirm(true)}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Отключить
            </Button>
          </div>
        )}

        {/* ── Error state ── */}
        {phase === "error" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
              <div className="flex items-center gap-2 text-sm mb-1">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="font-medium text-destructive">
                  Ошибка подключения
                </span>
              </div>
              {status?.error_message && (
                <p className="text-sm text-muted-foreground ml-6">
                  {status.error_message}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={async () => {
                try {
                  await api.disconnectTelegram();
                } catch {
                  // ignore — just clear local state
                }
                setStatus(null);
                setPhase("disconnected");
                setCode("");
                setPassword("");
              }}
            >
              Попробовать снова
            </Button>
          </div>
        )}

        {/* ── Disconnected — connection form ── */}
        {phase === "disconnected" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Hash className="h-3 w-3" />
                  API ID
                </Label>
                <Input
                  type="text"
                  placeholder="12345678"
                  value={apiId}
                  onChange={(e) => setApiId(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Key className="h-3 w-3" />
                  API Hash
                </Label>
                <div className="relative">
                  <Input
                    type={showApiHash ? "text" : "password"}
                    placeholder="abc123def456..."
                    value={apiHash}
                    onChange={(e) => setApiHash(e.target.value)}
                    className="rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiHash(!showApiHash)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiHash ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Phone className="h-3 w-3" />
                  Номер телефона
                </Label>
                <Input
                  type="tel"
                  placeholder="+7 999 123 45 67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/40 p-3.5 rounded-xl border border-border/40">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
              <span>
                Получите API ID и Hash на{" "}
                <a
                  href="https://my.telegram.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  my.telegram.org
                </a>
                . Используйте аккаунт, который имеет доступ к нужным каналам.
              </span>
            </div>

            <Button
              className="w-full rounded-xl"
              onClick={handleConnect}
              disabled={busy || !apiId.trim() || !apiHash.trim() || !phone.trim()}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Подключение...
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 mr-2" />
                  Подключить
                </>
              )}
            </Button>
          </div>
        )}

        {/* ── Code entry state ── */}
        {(phase === "code_entry" || phase === "connecting") && (
          <div className="space-y-4">
            <div className="rounded-xl bg-sky-500/5 border border-sky-500/20 p-4">
              <p className="text-sm">
                Код подтверждения отправлен в Telegram. Введите его ниже.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Hash className="h-3 w-3" />
                  Код подтверждения
                </Label>
                <Input
                  type="text"
                  placeholder="12345"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="rounded-xl text-center text-lg tracking-widest"
                  maxLength={10}
                  autoFocus
                />
              </div>

              {needsPassword && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" />
                    Пароль 2FA
                  </Label>
                  <Input
                    type="password"
                    placeholder="Пароль двухфакторной аутентификации"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setPhase("disconnected");
                  setCode("");
                  setPassword("");
                }}
                disabled={busy}
              >
                Назад
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={handleVerify}
                disabled={busy || !code.trim()}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Подтвердить
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Disconnect confirm dialog */}
      <ConfirmDialog
        open={showDisconnectConfirm}
        onOpenChange={setShowDisconnectConfirm}
        title="Отключить Telegram?"
        description="Сессия будет завершена, зашифрованные учётные данные удалены. Для повторного подключения потребуется заново ввести API ID, Hash и пройти верификацию."
        confirmLabel="Отключить"
        variant="destructive"
        onConfirm={handleDisconnect}
        confirmDisabled={busy}
      />
    </div>
  );
}
