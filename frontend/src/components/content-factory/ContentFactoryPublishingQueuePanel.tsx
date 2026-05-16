"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Clock3,
  History,
  Loader2,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import {
  CF_PUBLICATION_STATUS_LABELS,
  CF_PUBLISHING_QUEUE_EVENT_LABELS,
  CF_PUBLISHING_QUEUE_STATUS_LABELS,
} from "@/lib/contentFactoryUtils";
import type {
  CFPublication,
  CFPublishingQueueEvent,
  CFPublishingQueueItem,
  CFPublishingQueueStatus,
} from "@/lib/types";

function formatDateTime(value: string | null): string {
  if (!value) return "Не задано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Не задано";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status: CFPublishingQueueStatus): string {
  if (status === "queued") return "border-primary/25 bg-primary/10 text-primary";
  if (status === "processing") return "border-blue-300 bg-blue-50 text-blue-800";
  if (status === "succeeded") return "border-green-300 bg-green-50 text-green-800";
  if (status === "failed") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "manual_fallback") return "border-amber-300 bg-amber-50 text-amber-800";
  return "border-muted-foreground/20 bg-muted text-muted-foreground";
}

function queueStatusLabel(status: CFPublishingQueueStatus): string {
  return CF_PUBLISHING_QUEUE_STATUS_LABELS[status] ?? status;
}

function isActiveQueueStatus(status: CFPublishingQueueStatus): boolean {
  return status === "queued" || status === "processing";
}

function canEnqueuePublication(publication: CFPublication): boolean {
  return publication.status === "approved" || publication.status === "scheduled";
}

export function ContentFactoryPublishingQueuePanel({
  publication,
  queueItems,
  events,
  onChanged,
}: {
  publication: CFPublication;
  queueItems: CFPublishingQueueItem[];
  events: CFPublishingQueueEvent[];
  onChanged: () => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const [action, setAction] = useState<
    "enqueue" | "retry" | "send_now" | "fallback" | null
  >(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [fallbackReason, setFallbackReason] = useState("");
  const latestItem = queueItems[0] ?? null;
  const hasActiveItem = useMemo(
    () => queueItems.some((item) => isActiveQueueStatus(item.status)),
    [queueItems],
  );
  const canEnqueue = canEnqueuePublication(publication) && !hasActiveItem;
  const canRetry =
    latestItem?.status === "failed" || latestItem?.status === "manual_fallback";
  const canSendNow = latestItem?.status === "queued";
  const canManualFallback = Boolean(
    latestItem &&
      latestItem.status !== "succeeded" &&
      latestItem.status !== "cancelled" &&
      latestItem.status !== "manual_fallback",
  );
  const disabledReason = !canEnqueuePublication(publication)
    ? `Сначала доведите публикацию до статуса Одобрено или Запланировано. Сейчас: ${
        CF_PUBLICATION_STATUS_LABELS[publication.status] ?? publication.status
      }.`
    : hasActiveItem
      ? "Публикация уже есть в активной очереди."
      : null;

  async function handleEnqueue() {
    setAction("enqueue");
    try {
      await api.enqueueCFPublicationForPublishing(publication.id);
      toastSuccess("Публикация поставлена в очередь");
      await onChanged();
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Не удалось поставить в очередь",
      );
    } finally {
      setAction(null);
    }
  }

  async function handleRetry() {
    if (!latestItem) return;
    setAction("retry");
    try {
      await api.retryCFPublishingQueueItem(latestItem.id);
      toastSuccess("Повтор отправки запрошен");
      await onChanged();
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Не удалось запросить повтор",
      );
    } finally {
      setAction(null);
    }
  }

  async function handleSendNow() {
    if (!latestItem) return;
    setAction("send_now");
    try {
      await api.sendCFPublishingQueueItemNow(latestItem.id);
      toastSuccess("Автоотправка выполнена или записана в журнал");
      await onChanged();
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Не удалось отправить сейчас",
      );
    } finally {
      setAction(null);
    }
  }

  async function handleFallbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!latestItem) return;
    const reason = fallbackReason.trim();
    if (!reason) {
      toastError("Укажите причину ручного обхода");
      return;
    }
    setAction("fallback");
    try {
      await api.markCFPublishingQueueManualFallback(latestItem.id, { reason });
      toastSuccess("Ручной обход зафиксирован");
      setFallbackOpen(false);
      setFallbackReason("");
      await onChanged();
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Не удалось сохранить ручной обход",
      );
    } finally {
      setAction(null);
    }
  }

  return (
    <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <RadioTower className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Очередь публикации
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Автоотправка в Telegram и VK: очередь, попытки, ошибки и
              ручной обход. Факт выхода всё ещё можно фиксировать отдельно.
            </p>
          </div>
        </div>
        <Clock3 className="h-4 w-4 text-muted-foreground" />
      </div>

      {latestItem ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(
                  latestItem.status,
                )}`}
              >
                {queueStatusLabel(latestItem.status)}
              </span>
              <span className="text-xs text-muted-foreground">
                Попытки: {latestItem.attempts} из {latestItem.max_attempts}
              </span>
            </div>
            <dl className="mt-3 grid gap-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">План отправки</dt>
                <dd className="text-right font-medium text-foreground">
                  {formatDateTime(latestItem.scheduled_for)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Следующая попытка</dt>
                <dd className="text-right font-medium text-foreground">
                  {formatDateTime(latestItem.next_retry_at)}
                </dd>
              </div>
              {latestItem.error_message && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-2 py-2 text-destructive">
                  <div className="flex gap-1.5">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{latestItem.error_message}</span>
                  </div>
                </div>
              )}
              {latestItem.manual_fallback_reason && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-2 text-amber-800">
                  {latestItem.manual_fallback_reason}
                </div>
              )}
            </dl>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-md px-2 text-xs"
              disabled={!canSendNow || action === "send_now"}
              onClick={() => void handleSendNow()}
            >
              {action === "send_now" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Отправить сейчас
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-md px-2 text-xs"
              disabled={!canRetry || action === "retry"}
              onClick={() => void handleRetry()}
            >
              {action === "retry" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Повторить
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-md px-2 text-xs"
              disabled={!canManualFallback || action === "fallback"}
              onClick={() => setFallbackOpen(true)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Ручной обход
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-3 text-xs leading-5 text-muted-foreground">
          Публикация ещё не ставилась в очередь. Когда появятся внешние
          интеграции, эта очередь станет точкой контролируемой отправки.
        </p>
      )}

      <div className="mt-3">
        <Button
          type="button"
          size="sm"
          className="h-8 w-full gap-1.5 rounded-md px-3 text-xs"
          disabled={!canEnqueue || action === "enqueue"}
          onClick={() => void handleEnqueue()}
        >
          {action === "enqueue" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RadioTower className="h-3.5 w-3.5" />
          )}
          Поставить в очередь
        </Button>
        {disabledReason && (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {disabledReason}
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-border/60 pt-3">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Журнал очереди
        </div>
        {events.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Событий очереди пока нет.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="rounded-md bg-muted/20 px-2 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {CF_PUBLISHING_QUEUE_EVENT_LABELS[event.event_type] ??
                      event.event_type}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatDateTime(event.created_at)}
                  </span>
                </div>
                {event.message && (
                  <p className="mt-1 leading-5 text-muted-foreground">
                    {event.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={fallbackOpen} onOpenChange={setFallbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ручной обход</DialogTitle>
            <DialogDescription>
              Зафиксируйте, почему автоматическую отправку не продолжаем и
              публикация уходит в ручной процесс.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void handleFallbackSubmit(event)}>
            <Textarea
              value={fallbackReason}
              onChange={(event) => setFallbackReason(event.target.value)}
              placeholder="Например: нет доступа к API канала, отправляем вручную через пакет публикации"
              className="min-h-24"
            />
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFallbackOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={action === "fallback"}>
                {action === "fallback" && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
