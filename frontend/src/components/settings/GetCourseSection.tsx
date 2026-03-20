"use client";

import { useState, useEffect, useCallback } from "react";
import { Database, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { GetCourseCredentials } from "@/lib/types";

export function GetCourseSection() {
  const { toastSuccess, toastError } = useToast();
  const [credentials, setCredentials] = useState<GetCourseCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const fetchCredentials = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getGetCourseCredentials();
      setCredentials(data);
      setBaseUrl(data.base_url ?? "");
    } catch {
      // ignore — may not be configured
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const handleSave = async () => {
    if (!baseUrl.trim()) {
      toastError("Укажите URL GetCourse");
      return;
    }
    if (!apiKey.trim() && !credentials?.configured) {
      toastError("Укажите API-ключ");
      return;
    }
    if (!apiKey.trim() && credentials?.configured) {
      toastError("Для обновления настроек необходимо ввести API-ключ повторно");
      return;
    }

    setSaving(true);
    try {
      const result = await api.updateGetCourseCredentials({
        base_url: baseUrl.trim(),
        api_key: apiKey.trim(),
      });
      setCredentials(result);
      setApiKey("");
      toastSuccess("Настройки GetCourse сохранены");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up stagger-2 rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-6 pb-0">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "hsl(152, 55%, 35%, 0.1)" }}
        >
          <Database
            className="h-5 w-5"
            style={{ color: "hsl(152, 55%, 35%)" }}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-semibold text-base">
              GetCourse
            </h2>
            {credentials?.configured ? (
              <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400">
                Подключено
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400">
                Не настроено
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Подключение к API GetCourse для автоматического сбора отчётов
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            URL GetCourse
          </Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://yourschool.getcourse.ru"
            className="mt-1.5 rounded-xl"
          />
        </div>

        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            API-ключ
          </Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={credentials?.configured ? "Введите для обновления" : "Вставьте API-ключ"}
            className="mt-1.5 rounded-xl"
          />
          {credentials?.configured && (
            <p className="text-2xs text-muted-foreground mt-1">
              Ключ зашифрован. Введите заново для обновления.
            </p>
          )}
        </div>

        {credentials?.updated_at && (
          <p className="text-2xs text-muted-foreground">
            Последнее обновление:{" "}
            {new Date(credentials.updated_at).toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg gap-1.5"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Сохранить
        </Button>
      </div>
    </div>
  );
}
