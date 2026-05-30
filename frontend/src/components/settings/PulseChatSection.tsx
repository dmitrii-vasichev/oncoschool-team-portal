"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Activity, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";

export function PulseChatSection() {
  const { toastSuccess, toastError } = useToast();
  const [chatId, setChatId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPulseChat();
      setChatId(data.chat_id != null ? String(data.chat_id) : "");
      setThreadId(data.thread_id != null ? String(data.thread_id) : "");
    } catch {
      // ignore — unset settings simply leave the fields empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    const chatIdNum = Number(chatId);
    if (!chatId.trim() || !Number.isInteger(chatIdNum)) {
      setError("Введите корректный Chat ID (целое число)");
      return;
    }
    if (threadId.trim() && !Number.isInteger(Number(threadId))) {
      setError("Thread ID должен быть целым числом");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.updatePulseChat({
        chat_id: chatIdNum,
        thread_id: threadId.trim() ? Number(threadId) : null,
      });
      toastSuccess("Чат для Пульса команды сохранён");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка сохранения";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 p-6 pb-0">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "hsl(265, 60%, 55%, 0.1)" }}
        >
          <Activity className="h-5 w-5" style={{ color: "hsl(265, 60%, 55%)" }} />
        </div>
        <div className="flex-1">
          <h2 className="font-heading font-semibold text-base">
            Чат для дайджеста «Пульс команды»
          </h2>
          <p className="text-xs text-muted-foreground">
            Куда отправлять ежедневный общий «Пульс команды» (~09:05)
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Chat ID *
          </Label>
          <Input
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="-1003693766132"
            className="mt-1.5 rounded-xl font-mono text-sm"
          />
        </div>

        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Thread ID (необязательно)
          </Label>
          <Input
            value={threadId}
            onChange={(e) => setThreadId(e.target.value)}
            placeholder="Оставьте пустым для общей ветки"
            className="mt-1.5 rounded-xl font-mono text-sm"
          />
          <p className="text-2xs text-muted-foreground mt-1">
            Укажите, если группа использует темы (topics)
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button className="rounded-xl" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              "Сохранить"
            )}
          </Button>
        </div>

        {/* Help text */}
        <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/40 p-3.5 rounded-xl border border-border/40">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
          <span>
            Бот должен состоять в этой группе. Chat ID можно узнать, добавив
            @userinfobot в группу или переслав сообщение из группы боту @JsonDumpBot.
            Пока чат не задан, общий дайджест не отправляется (личные дайджесты и
            реакции работают независимо).
          </span>
        </div>
      </div>
    </div>
  );
}
