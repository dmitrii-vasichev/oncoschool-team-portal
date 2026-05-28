"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MessageSquare,
  ArrowRight,
  AlertOctagon,
  CheckCircle2,
  TrendingUp,
  Plus,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { EmptyState } from "@/components/shared/EmptyState";
import type { TaskUpdate, TaskStatus, UpdateType } from "@/lib/types";

/* ============================================
   Config & Helpers
   ============================================ */

const UPDATE_TYPE_CONFIG: Record<
  string,
  {
    icon: typeof MessageSquare;
    label: string;
    dotColor: string;
    dotGlow: string;
    borderColor: string;
    bgTint: string;
  }
> = {
  progress: {
    icon: TrendingUp,
    label: "Прогресс",
    dotColor: "bg-[hsl(var(--status-progress-fg))]",
    dotGlow: "shadow-[0_0_0_4px_hsl(var(--status-progress-bg))]",
    borderColor: "border-l-[hsl(var(--status-progress-fg))]",
    bgTint: "",
  },
  status_change: {
    icon: ArrowRight,
    label: "Смена статуса",
    dotColor: "bg-[hsl(var(--status-review-fg))]",
    dotGlow: "shadow-[0_0_0_4px_hsl(var(--status-review-bg))]",
    borderColor: "border-l-[hsl(var(--status-review-fg))]",
    bgTint: "",
  },
  comment: {
    icon: MessageSquare,
    label: "Комментарий",
    dotColor: "bg-[hsl(var(--muted-foreground))]",
    dotGlow: "shadow-[0_0_0_4px_hsl(var(--muted))]",
    borderColor: "",
    bgTint: "",
  },
  blocker: {
    icon: AlertOctagon,
    label: "Блокер",
    dotColor: "bg-[hsl(var(--destructive))]",
    dotGlow: "shadow-[0_0_0_4px_hsl(var(--priority-urgent-bg))]",
    borderColor: "border-l-[hsl(var(--destructive))]",
    bgTint: "bg-[hsl(var(--priority-urgent-bg))]",
  },
  completion: {
    icon: CheckCircle2,
    label: "Завершение",
    dotColor: "bg-[hsl(var(--status-done-fg))]",
    dotGlow: "shadow-[0_0_0_4px_hsl(var(--status-done-bg))]",
    borderColor: "border-l-[hsl(var(--status-done-fg))]",
    bgTint: "",
  },
  cancellation: {
    icon: XCircle,
    label: "Отмена",
    dotColor: "bg-[hsl(var(--status-cancelled-fg))]",
    dotGlow: "shadow-[0_0_0_4px_hsl(var(--status-cancelled-bg))]",
    borderColor: "border-l-[hsl(var(--status-cancelled-fg))]",
    bgTint: "",
  },
};

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const lastDigit = abs % 10;
  if (abs >= 11 && abs <= 19) return many;
  if (lastDigit === 1) return one;
  if (lastDigit >= 2 && lastDigit <= 4) return few;
  return many;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "только что";
  if (diffMin < 60)
    return `${diffMin} ${pluralize(diffMin, "минуту", "минуты", "минут")} назад`;
  if (diffHours < 24)
    return `${diffHours} ${pluralize(diffHours, "час", "часа", "часов")} назад`;
  if (diffDays < 7)
    return `${diffDays} ${pluralize(diffDays, "день", "дня", "дней")} назад`;
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: diffDays > 365 ? "numeric" : undefined,
  });
}

/* ============================================
   Timeline Item
   ============================================ */

function TimelineItem({
  update,
  index,
}: {
  update: TaskUpdate;
  index: number;
}) {
  const config =
    UPDATE_TYPE_CONFIG[update.update_type] || UPDATE_TYPE_CONFIG.comment;

  const isBloker = update.update_type === "blocker";
  const isCompletion = update.update_type === "completion";

  return (
    <div
      className="relative pl-10 pb-8 last:pb-0 animate-timeline-enter"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Dot */}
      <div
        className={`
          absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full
          ${config.dotColor} ${config.dotGlow}
          animate-dot-appear
        `}
        style={{ animationDelay: `${index * 60 + 100}ms` }}
      />

      {/* Card */}
      <div
        className={`
          rounded-lg border px-4 py-3
          ${config.borderColor ? `border-l-[3px] ${config.borderColor}` : ""}
          ${config.bgTint || "bg-card"}
        `}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          {update.author && (
            <div className="flex items-center gap-1.5">
              <UserAvatar name={update.author.full_name} avatarUrl={update.author.avatar_url} size="sm" />
              <span className="text-sm font-medium">
                {update.author.full_name}
              </span>
            </div>
          )}
          <span className="text-2xs text-muted-foreground font-medium uppercase tracking-wider">
            {isBloker && "\u{1F6AB} "}
            {isCompletion && "\u{2705} "}
            {config.label}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {relativeTime(update.created_at)}
          </span>
        </div>

        {/* Status change arrow */}
        {update.update_type === "status_change" &&
          update.old_status &&
          update.new_status && (
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={update.old_status as TaskStatus} />
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <StatusBadge status={update.new_status as TaskStatus} />
            </div>
          )}

        {/* Content */}
        {update.content && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {update.content}
          </p>
        )}

        {/* Progress bar */}
        {update.progress_percent !== null &&
          update.progress_percent !== undefined && (
            <div className="flex items-center gap-3 mt-2.5">
              <Progress
                value={update.progress_percent}
                className="h-2 flex-1 max-w-52"
              />
              <span className="text-xs font-mono font-medium text-muted-foreground tabular-nums">
                {update.progress_percent}%
              </span>
            </div>
          )}
      </div>
    </div>
  );
}

/* ============================================
   Inline Add Update Form
   ============================================ */

const UPDATE_TYPE_OPTIONS: {
  value: UpdateType;
  label: string;
  icon: typeof TrendingUp;
}[] = [
  { value: "progress", label: "Прогресс", icon: TrendingUp },
  { value: "comment", label: "Комментарий", icon: MessageSquare },
  { value: "blocker", label: "Блокер", icon: AlertOctagon },
];

function InlineAddForm({
  shortId,
  onCreated,
}: {
  shortId: number;
  onCreated?: () => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [updateType, setUpdateType] = useState<UpdateType>("progress");
  const [progressPercent, setProgressPercent] = useState(50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setContent("");
    setUpdateType("progress");
    setProgressPercent(50);
    setError(null);
  }

  async function handleSubmit() {
    if (!content.trim()) {
      setError("Введите текст обновления");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.createTaskUpdate(shortId, {
        content: content.trim(),
        update_type: updateType,
        progress_percent: updateType === "progress" ? progressPercent : null,
        source: "web",
      });
      reset();
      setOpen(false);
      onCreated?.();
      toastSuccess("Обновление добавлено");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка добавления обновления";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="relative pl-10 pt-2">
        {/* Plus dot */}
        <div className="absolute left-0 top-3.5 w-3.5 h-3.5 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center">
          <Plus className="h-2 w-2 text-muted-foreground/40" />
        </div>

        <button
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground py-1.5 rounded-md"
        >
          <Plus className="h-4 w-4 group-hover:scale-110" />
          <span>Добавить обновление</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative pl-10 pt-2 animate-form-expand">
      {/* Active dot */}
      <div className="absolute left-0 top-3.5 w-3.5 h-3.5 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]" />

      <div className="rounded-lg border bg-card p-4 space-y-4">
        {/* Type pills */}
        <div className="flex items-center gap-2">
          {UPDATE_TYPE_OPTIONS.map((opt) => {
            const TypeIcon = opt.icon;
            const active = updateType === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setUpdateType(opt.value)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                  ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                <TypeIcon className="h-3 w-3" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Textarea */}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            updateType === "blocker"
              ? "Опишите, что блокирует работу..."
              : "Что изменилось?"
          }
          rows={3}
          autoFocus
          className="resize-none"
        />

        {/* Progress slider */}
        {updateType === "progress" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                Прогресс
              </span>
              <span className="text-sm font-mono font-semibold text-primary tabular-nums">
                {progressPercent}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progressPercent}
              onChange={(e) => setProgressPercent(Number(e.target.value))}
              className="progress-slider w-full"
            />
          </div>
        )}

        {/* Error */}
        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Actions */}
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Отмена
          </Button>
          <Button
            size="sm"
            disabled={saving || !content.trim()}
            onClick={handleSubmit}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {saving ? "Отправка..." : "Добавить"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============================================
   TaskUpdates — Main Component
   ============================================ */

export function TaskUpdates({
  shortId,
  canAddUpdate,
  onUpdateCreated,
}: {
  shortId: number;
  canAddUpdate?: boolean;
  onUpdateCreated?: () => void;
}) {
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUpdates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTaskUpdates(shortId);
      setUpdates(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [shortId]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  const handleUpdateCreated = useCallback(() => {
    fetchUpdates();
    onUpdateCreated?.();
  }, [fetchUpdates, onUpdateCreated]);

  if (loading) {
    return (
      <div className="space-y-4 pl-10">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (updates.length === 0 && !canAddUpdate) {
    return (
      <EmptyState
        variant="updates"
        title="Пока нет обновлений"
        description="Обновления появятся, когда участники добавят прогресс или комментарии"
        className="py-10"
      />
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      {(updates.length > 0 || canAddUpdate) && (
        <div
          className="absolute left-[6px] top-3 w-[2px] bg-gradient-to-b from-border via-border to-transparent"
          style={{ bottom: canAddUpdate ? "20px" : "24px" }}
        />
      )}

      {/* Updates */}
      {updates.map((update, index) => (
        <TimelineItem key={update.id} update={update} index={index} />
      ))}

      {/* Inline form */}
      {canAddUpdate && (
        <InlineAddForm shortId={shortId} onCreated={handleUpdateCreated} />
      )}
    </div>
  );
}
