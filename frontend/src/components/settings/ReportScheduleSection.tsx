"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Loader2, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TimePicker } from "@/components/shared/TimePicker";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { ReportSchedule } from "@/lib/types";

export function ReportScheduleSection() {
  const { toastSuccess, toastError } = useToast();
  const [schedule, setSchedule] = useState<ReportSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [time, setTime] = useState("05:45");
  const [enabled, setEnabled] = useState(true);

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getReportSchedule();
      setSchedule(data);
      setTime(data.time);
      setEnabled(data.enabled);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await api.updateReportSchedule({
        time,
        timezone: schedule?.timezone ?? "Europe/Moscow",
        enabled,
      });
      setSchedule(result);
      toastSuccess("Расписание отчётов сохранено");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up stagger-3 rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-6 pb-0">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "hsl(262, 52%, 55%, 0.1)" }}
        >
          <Clock
            className="h-5 w-5"
            style={{ color: "hsl(262, 52%, 55%)" }}
          />
        </div>
        <div className="flex-1">
          <h2 className="font-heading font-semibold text-base">
            Расписание отчётов
          </h2>
          <p className="text-xs text-muted-foreground">
            Время автоматического сбора данных GetCourse
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="text-sm font-medium">Автосбор данных</Label>
              <p className="text-2xs text-muted-foreground mt-1">
                Данные собираются автоматически каждый день в указанное время
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Время сбора
          </Label>
          <div className="mt-1.5">
            <TimePicker value={time} onChange={setTime} />
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Часовой пояс: {schedule?.timezone ?? "Europe/Moscow"}
        </div>

        <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/40 p-3.5 rounded-xl border border-border/40">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
          <span>
            Сбор данных может занять до 15 минут (3 экспорта из GetCourse).
            Рекомендуется устанавливать раннее утреннее время.
          </span>
        </div>

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
