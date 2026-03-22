"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/shared/Toast";
import { DatePicker } from "@/components/shared/DatePicker";
import { useReports } from "@/hooks/useReports";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/api";
import type { BackfillStatus, DailyMetric, GetCourseCredentials } from "@/lib/types";
import {
  Users,
  CreditCard,
  Banknote,
  Package,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Info,
  Settings,
  Loader2,
  CheckCircle2,
  XCircle,
  CalendarRange,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_TEAL = "hsl(174, 62%, 26%)";
const CHART_BLUE = "hsl(200, 65%, 48%)";
const CHART_AMBER = "hsl(43, 82%, 58%)";
const CHART_VIOLET = "hsl(262, 52%, 55%)";

const PERIOD_OPTIONS = [
  { value: 7, label: "7 дней" },
  { value: 14, label: "14 дней" },
  { value: 30, label: "30 дней" },
];

function formatMoney(value: number): string {
  return value.toLocaleString("ru-RU") + " \u20BD";
}

function formatShortMoney(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000) return (value / 1_000).toFixed(0) + "K";
  return String(value);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) return null;

  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
        <TrendingUp className="h-3 w-3" />+{typeof value === "number" && value % 1 !== 0 ? Number(value).toFixed(0) : value}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
        <TrendingDown className="h-3 w-3" />{typeof value === "number" && value % 1 !== 0 ? Number(value).toFixed(0) : value}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <Minus className="h-3 w-3" />0
    </span>
  );
}

function KPICard({
  label,
  value,
  delta,
  icon: Icon,
  accentColor,
  isMoney,
}: {
  label: string;
  value: number;
  delta: number | null;
  icon: React.ElementType;
  accentColor: string;
  isMoney?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 transition-all">
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-80 group-hover:opacity-100"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-heading tracking-tight">
              {isMoney ? formatMoney(value) : value.toLocaleString("ru-RU")}
            </span>
          </div>
          <DeltaBadge value={delta} />
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl opacity-70 group-hover:opacity-100"
          style={{ backgroundColor: `${accentColor}18` }}
        >
          <Icon className="h-5 w-5" style={{ color: accentColor }} />
        </div>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-foreground">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <p key={item.name} className="text-xs text-muted-foreground">
            <span
              className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
              style={{ backgroundColor: item.color || "hsl(var(--muted-foreground))" }}
            />
            {item.name}:{" "}
            <span className="font-semibold text-foreground">
              {item.value.toLocaleString("ru-RU")}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

export default function ReportsPage() {
  const [days, setDays] = useState(30);
  const { summary, today, loading, error, refetch } = useReports(days);
  const { toastSuccess, toastError } = useToast();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const [credentials, setCredentials] = useState<GetCourseCredentials | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  type CollectionStage = "idle" | "requesting" | "collecting" | "done" | "error";
  const [stage, setStage] = useState<CollectionStage>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [collectError, setCollectError] = useState<string | null>(null);

  // Backfill state
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillFrom, setBackfillFrom] = useState("");
  const [backfillTo, setBackfillTo] = useState("");
  const [backfillPauseMinutes, setBackfillPauseMinutes] = useState(5);
  const [backfillSubmitting, setBackfillSubmitting] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | null>(null);

  const ESTIMATED_DURATION = 20 * 60; // ~20 minutes (3 exports × 5 min pause + polling)

  // Timer for elapsed seconds
  useEffect(() => {
    if (stage !== "requesting" && stage !== "collecting") return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [stage]);

  // Auto-dismiss success banner after 5 seconds
  useEffect(() => {
    if (stage !== "done") return;
    const timeout = setTimeout(() => setStage("idle"), 5000);
    return () => clearTimeout(timeout);
  }, [stage]);

  const fetchCredentials = useCallback(async () => {
    try {
      const data = await api.getGetCourseCredentials();
      setCredentials(data);
    } catch {
      // Non-admin users may get 403 — treat as configured (they wouldn't see reports otherwise)
      setCredentials({ configured: true, base_url: null, updated_at: null });
    } finally {
      setCredentialsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // Poll backfill status on mount and while running
  const fetchBackfillStatus = useCallback(async () => {
    try {
      const status = await api.getBackfillStatus();
      setBackfillStatus(status);
      // When backfill completes, refetch reports data
      if (status.status === "completed") {
        refetch();
      }
    } catch {
      // Ignore errors — user may not have access
    }
  }, [refetch]);

  useEffect(() => {
    fetchBackfillStatus();
  }, [fetchBackfillStatus]);

  // Poll every 10 seconds while backfill is running
  useEffect(() => {
    if (backfillStatus?.status !== "running") return;
    const interval = setInterval(fetchBackfillStatus, 10_000);
    return () => clearInterval(interval);
  }, [backfillStatus?.status, fetchBackfillStatus]);

  const collecting = stage === "requesting" || stage === "collecting";

  const handleCollect = async () => {
    setStage("requesting");
    setElapsedSeconds(0);
    setCollectError(null);
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split("T")[0];
      setStage("collecting");
      const result = await api.collectReport(dateStr);
      setStage("done");
      if (result.status === "already_exists") {
        toastSuccess(`Данные за ${dateStr} уже собраны`);
      } else {
        toastSuccess(`Сбор данных за ${dateStr} завершён`);
      }
      refetch();
    } catch (e) {
      setStage("error");
      const msg = e instanceof Error ? e.message : "Ошибка сбора данных";
      setCollectError(msg);
      toastError(msg);
      // Auto-dismiss error after 5 seconds
      setTimeout(() => setStage("idle"), 5000);
    }
  };

  const handleCancelBackfill = async () => {
    try {
      await api.cancelBackfill();
      toastSuccess("Отмена загрузки запрошена");
      await fetchBackfillStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка отмены";
      toastError(msg);
    }
  };

  const handleResetBackfill = async () => {
    try {
      await api.resetBackfillStatus();
      setBackfillStatus(null);
      toastSuccess("Статус загрузки сброшен");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка сброса";
      toastError(msg);
    }
  };

  const handleRetryBackfill = async () => {
    if (!backfillStatus) return;
    const dateFrom = backfillStatus.date_from;
    const dateTo = backfillStatus.date_to;
    if (!dateFrom || !dateTo) return;
    try {
      await api.resetBackfillStatus();
      await api.backfillReports(dateFrom, dateTo, Math.max(backfillPauseMinutes, 5));
      toastSuccess("Повторная загрузка запущена");
      await fetchBackfillStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка повторной загрузки";
      toastError(msg);
    }
  };

  const handleBackfill = async () => {
    if (!backfillFrom || !backfillTo) return;
    if (backfillFrom > backfillTo) {
      toastError("Дата «от» должна быть раньше даты «до»");
      return;
    }
    setBackfillSubmitting(true);
    try {
      await api.backfillReports(backfillFrom, backfillTo, Math.max(backfillPauseMinutes, 5));
      toastSuccess("Загрузка исторических данных запущена");
      setBackfillOpen(false);
      // Immediately fetch status to show "running" banner
      await fetchBackfillStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка запуска загрузки";
      toastError(msg);
    } finally {
      setBackfillSubmitting(false);
    }
  };

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = Math.min(95, Math.round((elapsedSeconds / ESTIMATED_DURATION) * 100));

  const chartData = useMemo(() => {
    if (!summary?.metrics) return [];
    return [...summary.metrics]
      .sort((a, b) => a.metric_date.localeCompare(b.metric_date))
      .map((m: DailyMetric) => ({
        date: formatDate(m.metric_date),
        users_count: m.users_count,
        payments_count: m.payments_count,
        payments_sum: Number(m.payments_sum),
        orders_count: m.orders_count,
        orders_sum: Number(m.orders_sum),
      }));
  }, [summary]);

  const sortedMetrics = useMemo(() => {
    if (!summary?.metrics) return [];
    return [...summary.metrics].sort((a, b) =>
      b.metric_date.localeCompare(a.metric_date)
    );
  }, [summary]);

  if (loading || credentialsLoading) return <ReportsSkeleton />;

  // First-run banner: GetCourse not configured
  if (credentials && !credentials.configured) {
    return (
      <div className="flex h-[60vh] items-center justify-center animate-in fade-in duration-300">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
            <Info className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-lg font-bold font-heading">
              GetCourse не настроен
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Для отображения отчётов необходимо подключить API GetCourse
              в разделе Настройки.
            </p>
          </div>
          <Link href="/settings">
            <Button className="rounded-lg gap-1.5">
              <Settings className="h-4 w-4" />
              Перейти в настройки
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">
            Не удалось загрузить отчёты
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const backfillIsRunning = backfillStatus?.status === "running";

  const formatBackfillDates = (status: BackfillStatus) => {
    if (!status.date_from || !status.date_to) return "";
    const formatDate = (iso: string) => {
      const [y, m, d] = iso.split("-");
      return `${d}.${m}.${y}`;
    };
    return `${formatDate(status.date_from)} — ${formatDate(status.date_to)}`;
  };

  const dismissBackfillStatus = () => {
    setBackfillStatus(null);
  };

  // Backfill status banner (persistent, driven by backend status)
  const backfillBanner = (() => {
    if (!backfillStatus || backfillStatus.status === "idle") return null;

    if (backfillStatus.status === "running") {
      const pollInfo = backfillStatus.poll_count ? ` (опрос #${backfillStatus.poll_count})` : "";
      const stageLabels: Record<string, string> = {
        starting: "Подготовка…",
        export_started: `Запрос экспорта: ${backfillStatus.export_type ?? ""}`,
        polling: backfillStatus.detail === "rate_limited"
          ? `Ожидание (rate limit #${backfillStatus.rate_limit_count ?? 0}, пауза ${backfillStatus.wait_seconds ?? 0}с)`
          : backfillStatus.detail === "waiting"
            ? `Ожидание: ${backfillStatus.export_type ?? ""} обрабатывается на сервере…`
            : `Получение данных: ${backfillStatus.export_type ?? ""}${pollInfo}`,
        rate_limited: `Ожидание (rate limit #${backfillStatus.rate_limit_count ?? 0}, пауза ${backfillStatus.wait_seconds ?? 0}с)`,
        fetching: `Получение данных: ${backfillStatus.export_type ?? ""}`,
        export_done: `Готово: ${backfillStatus.export_type ?? ""} (${backfillStatus.rows_count ?? 0} записей)`,
        saving: "Сохранение в базу данных…",
      };
      const stage = backfillStatus.stage ?? "starting";
      const stageText = stageLabels[stage] ?? stage;
      const stepText = backfillStatus.step ? ` [${backfillStatus.step}]` : "";
      const elapsedSec = backfillStatus.elapsed_seconds;
      const elapsedText = elapsedSec != null
        ? ` • ${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, "0")}`
        : "";

      return (
        <section className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                Загрузка исторических данных{stepText}
              </p>
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                {stageText}{elapsedText}
              </p>
              <p className="text-xs text-blue-600/50 dark:text-blue-400/50 mt-0.5">
                Период: {formatBackfillDates(backfillStatus)} ({backfillStatus.total_dates ?? 0} дн.)
              </p>
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 rounded-lg gap-1.5 text-xs border-blue-500/30 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10"
                onClick={handleCancelBackfill}
              >
                <XCircle className="h-3 w-3" />
                Отменить
              </Button>
            )}
          </div>
        </section>
      );
    }

    if (backfillStatus.status === "completed") {
      return (
        <section className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Загрузка завершена: {backfillStatus.collected ?? 0} из {backfillStatus.total_dates ?? 0} дн.
              </p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                Период: {formatBackfillDates(backfillStatus)}
              </p>
            </div>
            <button onClick={dismissBackfillStatus} className="text-emerald-600/50 hover:text-emerald-600 dark:text-emerald-400/50 dark:hover:text-emerald-400">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </section>
      );
    }

    if (backfillStatus.status === "failed" || backfillStatus.status === "cancelled") {
      const isCancelled = backfillStatus.status === "cancelled";
      return (
        <section className={`animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border p-4 ${
          isCancelled
            ? "border-amber-500/20 bg-amber-500/5"
            : "border-destructive/20 bg-destructive/5"
        }`}>
          <div className="flex items-center gap-3">
            <XCircle className={`h-5 w-5 shrink-0 ${isCancelled ? "text-amber-600" : "text-destructive"}`} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${isCancelled ? "text-amber-700 dark:text-amber-400" : "text-destructive"}`}>
                {isCancelled ? "Загрузка отменена" : "Загрузка не удалась"}
              </p>
              {backfillStatus.error && !isCancelled && (
                <p className="text-xs text-destructive/70 mt-0.5">
                  {backfillStatus.error}
                </p>
              )}
              <p className={`text-xs mt-0.5 ${isCancelled ? "text-amber-600/70 dark:text-amber-400/70" : "text-destructive/70"}`}>
                Период: {formatBackfillDates(backfillStatus)}
              </p>
            </div>
            {isAdmin && !isCancelled && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 rounded-lg gap-1.5 text-xs"
                onClick={handleRetryBackfill}
              >
                <RefreshCw className="h-3 w-3" />
                Повторить
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 rounded-lg gap-1.5 text-xs"
                onClick={handleResetBackfill}
              >
                Сбросить
              </Button>
            )}
            <button onClick={dismissBackfillStatus} className={`${
              isCancelled
                ? "text-amber-600/50 hover:text-amber-600"
                : "text-destructive/50 hover:text-destructive"
            }`}>
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </section>
      );
    }

    return null;
  })();

  // Backfill dialog (shared between empty state and main view)
  const backfillDialog = (
    <Dialog
      open={backfillOpen}
      onOpenChange={(open) => {
        if (!open) setBackfillOpen(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Загрузка исторических данных
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Укажите период, за который нужно загрузить данные из GetCourse.
        </p>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium block">От</label>
            <DatePicker
              value={backfillFrom}
              onChange={setBackfillFrom}
              placeholder="Начало"
              clearable
              className="w-full"
              yearRange={[2025, 2027]}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium block">До</label>
            <DatePicker
              value={backfillTo}
              onChange={setBackfillTo}
              placeholder="Конец"
              clearable
              className="w-full"
              yearRange={[2025, 2027]}
            />
          </div>
        </div>
        {backfillFrom && backfillTo && backfillFrom > backfillTo && (
          <p className="text-xs text-destructive mt-1">
            Дата «от» должна быть раньше даты «до»
          </p>
        )}
        <div className="space-y-2 mt-4">
          <label className="text-sm font-medium block">
            Пауза между экспортами (мин)
          </label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={5}
              max={60}
              value={backfillPauseMinutes}
              onChange={(e) => setBackfillPauseMinutes(Math.max(5, Number(e.target.value) || 5))}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              Мин. 5. Для большого периода увеличьте до 10–15.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => setBackfillOpen(false)}
          >
            Отмена
          </Button>
          <Button
            size="sm"
            className="rounded-lg gap-1.5"
            onClick={handleBackfill}
            disabled={
              !backfillFrom ||
              !backfillTo ||
              backfillFrom > backfillTo ||
              backfillSubmitting
            }
          >
            {backfillSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Запуск...
              </>
            ) : (
              <>
                <CalendarRange className="h-3.5 w-3.5" />
                Загрузить
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (!summary || summary.metrics.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium text-foreground">
            Нет данных
          </p>
          <p className="text-sm text-muted-foreground">
            Данные ещё не собраны. Настройте подключение GetCourse в разделе Настройки.
          </p>
          {isAdmin && !backfillIsRunning && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg gap-1.5"
              onClick={() => setBackfillOpen(true)}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Загрузить историю
            </Button>
          )}
          {backfillBanner}
        </div>
        {backfillDialog}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with period selector */}
      <section className="animate-fade-in-up stagger-1 rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold font-heading tracking-tight md:text-2xl">
              Отчёты GetCourse
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.date_from} — {summary.date_to}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Tabs
              value={String(days)}
              onValueChange={(v) => setDays(Number(v))}
            >
              <TabsList>
                {PERIOD_OPTIONS.map((opt) => (
                  <TabsTrigger key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg gap-1.5"
              onClick={handleCollect}
              disabled={collecting}
            >
              {collecting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Сбор данных...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Обновить данные
                </>
              )}
            </Button>
            {isAdmin && !backfillIsRunning && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg gap-1.5"
                onClick={() => setBackfillOpen(true)}
              >
                <CalendarRange className="h-3.5 w-3.5" />
                Загрузить историю
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Backfill status banner (driven by backend polling) */}
      {backfillBanner}

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KPICard
          label="Новые пользователи"
          value={today?.users_count ?? 0}
          delta={today?.delta_users ?? null}
          icon={Users}
          accentColor={CHART_TEAL}
        />
        <KPICard
          label="Кол-во платежей"
          value={today?.payments_count ?? 0}
          delta={today?.delta_payments_count ?? null}
          icon={CreditCard}
          accentColor={CHART_BLUE}
        />
        <KPICard
          label="Сумма платежей"
          value={Number(today?.payments_sum ?? 0)}
          delta={today?.delta_payments_sum ? Number(today.delta_payments_sum) : null}
          icon={Banknote}
          accentColor="hsl(152, 55%, 35%)"
          isMoney
        />
        <KPICard
          label="Кол-во заказов"
          value={today?.orders_count ?? 0}
          delta={today?.delta_orders_count ?? null}
          icon={Package}
          accentColor={CHART_VIOLET}
        />
        <KPICard
          label="Сумма заказов"
          value={Number(today?.orders_sum ?? 0)}
          delta={today?.delta_orders_sum ? Number(today.delta_orders_sum) : null}
          icon={ShoppingCart}
          accentColor={CHART_AMBER}
          isMoney
        />
      </section>

      {/* Collection progress banner */}
      {collecting && (
        <section className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  Сбор данных...
                </p>
                <span className="text-xs font-mono text-muted-foreground">
                  {formatElapsed(elapsedSeconds)} / ~15 мин
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-primary/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Собираем данные из GetCourse (пользователи, платежи, заказы). Можно продолжить работу.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Success banner */}
      {stage === "done" && (
        <section className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Данные успешно собраны
            </p>
          </div>
        </section>
      )}

      {/* Error banner */}
      {stage === "error" && (
        <section className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm font-medium text-destructive">
              {collectError || "Ошибка сбора данных"}
            </p>
          </div>
        </section>
      )}

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Users chart */}
        <div className="animate-fade-in-up stagger-3 rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="font-heading font-semibold text-sm mb-4">
            Пользователи
          </h3>
          {chartData.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              Нет данных
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_TEAL} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_TEAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="users_count"
                  name="Пользователи"
                  stroke={CHART_TEAL}
                  strokeWidth={2}
                  fill="url(#usersGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payments chart */}
        <div className="animate-fade-in-up stagger-4 rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="font-heading font-semibold text-sm mb-4">
            Платежи
          </h3>
          {chartData.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              Нет данных
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={formatShortMoney}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  yAxisId="left"
                  dataKey="payments_count"
                  name="Кол-во"
                  fill={CHART_BLUE}
                  radius={[4, 4, 0, 0]}
                  opacity={0.7}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="payments_sum"
                  name="Сумма"
                  stroke="hsl(152, 55%, 35%)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Orders chart */}
        <div className="animate-fade-in-up stagger-5 rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="font-heading font-semibold text-sm mb-4">
            Заказы
          </h3>
          {chartData.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
              Нет данных
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={formatShortMoney}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  yAxisId="left"
                  dataKey="orders_count"
                  name="Кол-во"
                  fill={CHART_VIOLET}
                  radius={[4, 4, 0, 0]}
                  opacity={0.7}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="orders_sum"
                  name="Сумма"
                  stroke={CHART_AMBER}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Summary averages */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">Среднее пользователей/день</p>
          <p className="mt-2 text-2xl font-bold font-heading">
            {summary.avg_users_per_day.toFixed(0)}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">Средняя сумма платежей/день</p>
          <p className="mt-2 text-2xl font-bold font-heading">
            {formatMoney(summary.avg_payments_sum_per_day)}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">Средняя сумма заказов/день</p>
          <p className="mt-2 text-2xl font-bold font-heading">
            {formatMoney(summary.avg_orders_sum_per_day)}
          </p>
        </div>
      </section>

      {/* Daily table */}
      <section className="animate-fade-in-up stagger-6 rounded-2xl border border-border/60 bg-card p-5">
        <h3 className="font-heading font-semibold text-sm mb-4">
          Ежедневная статистика
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="px-2 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                  Дата
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                  Пользователи
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                  Платежи
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                  Сумма платежей
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                  Заказы
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium uppercase text-muted-foreground">
                  Сумма заказов
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sortedMetrics.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-2 py-2 text-sm font-medium">
                    {(() => { const [y, mo, d] = m.metric_date.split("-"); return `${d}.${mo}.${y}`; })()}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">
                    {m.users_count.toLocaleString("ru-RU")}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">
                    {m.payments_count.toLocaleString("ru-RU")}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">
                    {formatMoney(Number(m.payments_sum))}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">
                    {m.orders_count.toLocaleString("ru-RU")}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">
                    {formatMoney(Number(m.orders_sum))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border/60 font-semibold">
                <td className="px-2 py-2 text-sm">Итого</td>
                <td className="px-2 py-2 text-right font-mono text-xs">
                  {summary.total_users.toLocaleString("ru-RU")}
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs">
                  {summary.total_payments_count.toLocaleString("ru-RU")}
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs">
                  {formatMoney(Number(summary.total_payments_sum))}
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs">
                  {summary.total_orders_count.toLocaleString("ru-RU")}
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs">
                  {formatMoney(Number(summary.total_orders_sum))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {backfillDialog}
    </div>
  );
}
