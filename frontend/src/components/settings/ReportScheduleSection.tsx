"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Loader2, Save, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TimePicker } from "@/components/shared/TimePicker";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { ReportSchedule } from "@/lib/types";

const MIN_GAP_MINUTES = 30;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getGapMinutes(collectionTime: string, sendTime: string): number {
  return timeToMinutes(sendTime) - timeToMinutes(collectionTime);
}

export function ReportScheduleSection() {
  const { toastSuccess, toastError } = useToast();
  const [schedule, setSchedule] = useState<ReportSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collectionTime, setCollectionTime] = useState("05:45");
  const [sendTime, setSendTime] = useState("06:30");
  const [enabled, setEnabled] = useState(true);

  const gap = getGapMinutes(collectionTime, sendTime);
  const isGapValid = gap >= MIN_GAP_MINUTES;

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getReportSchedule();
      setSchedule(data);
      setCollectionTime(data.collection_time);
      setSendTime(data.send_time);
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

  const handleCollectionTimeChange = (value: string) => {
    setCollectionTime(value);
    // Auto-adjust send_time if gap becomes invalid
    const newGap = getGapMinutes(value, sendTime);
    if (newGap < MIN_GAP_MINUTES) {
      const collMinutes = timeToMinutes(value) + MIN_GAP_MINUTES;
      if (collMinutes < 24 * 60) {
        const h = Math.floor(collMinutes / 60);
        const m = collMinutes % 60;
        setSendTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
  };

  const handleSave = async () => {
    if (!isGapValid) {
      toastError(`Минимальный зазор между сбором и отправкой — ${MIN_GAP_MINUTES} минут`);
      return;
    }
    setSaving(true);
    try {
      const result = await api.updateReportSchedule({
        collection_time: collectionTime,
        send_time: sendTime,
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
            Время сбора данных GetCourse и отправки отчётов
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label className="text-sm font-medium">Автосбор данных</Label>
              <p className="text-2xs text-muted-foreground mt-1">
                Данные собираются и отправляются автоматически каждый день
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Время сбора
            </Label>
            <div className="mt-1.5">
              <TimePicker value={collectionTime} onChange={handleCollectionTimeChange} />
            </div>
            <p className="text-2xs text-muted-foreground mt-1">
              Начало загрузки данных из GetCourse
            </p>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Время отправки
            </Label>
            <div className="mt-1.5">
              <TimePicker value={sendTime} onChange={setSendTime} />
            </div>
            <p className="text-2xs text-muted-foreground mt-1">
              Отправка отчёта в Telegram
            </p>
          </div>
        </div>

        {!isGapValid && (
          <div className="flex items-start gap-2.5 text-xs text-destructive bg-destructive/10 p-3.5 rounded-xl border border-destructive/20">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Время отправки должно быть минимум на {MIN_GAP_MINUTES} минут позже времени сбора.
              Сбор данных из GetCourse занимает до 15 минут.
            </span>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Часовой пояс: {schedule?.timezone ?? "Europe/Moscow"}
        </div>

        <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/40 p-3.5 rounded-xl border border-border/40">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
          <span>
            Сбор данных может занять до 15 минут (3 экспорта из GetCourse).
            Если сбор не завершится к моменту отправки, отчёт будет отправлен сразу
            после завершения сбора.
          </span>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || !isGapValid}
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
