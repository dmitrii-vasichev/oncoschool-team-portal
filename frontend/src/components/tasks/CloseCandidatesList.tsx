"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/shared/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/api";
import { PermissionService } from "@/lib/permissions";
import {
  daysOverdue,
  formatDaysOverdue,
  toggleInSet,
} from "@/lib/closeCandidates";
import { summarizeBulkResult } from "@/lib/bulkResult";
import {
  USER_CANCELLATION_REASONS,
  type CancellationReasonCode,
} from "@/lib/cancellation";
import type { Task, TeamMember } from "@/lib/types";

const EXTEND_OPTIONS: number[] = [7, 14, 30];

export function CloseCandidatesList({
  tasks,
  onChanged,
}: {
  tasks: Task[];
  // Accepted for API parity with the board view; assignee names come from each task.
  members?: TeamMember[];
  onChanged: () => void | Promise<void>;
}) {
  const { user } = useCurrentUser();
  const { toastSuccess, toastError } = useToast();
  const today = useMemo(() => new Date(), []);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  // short_id currently running a per-row action (disables that row's buttons)
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Single-task cancel dialog target (null = closed)
  const [cancelTarget, setCancelTarget] = useState<Task | null>(null);
  // Bulk cancel dialog
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);

  const visibleShortIds = useMemo(
    () => tasks.map((t) => t.short_id),
    [tasks]
  );
  const allSelected =
    visibleShortIds.length > 0 &&
    visibleShortIds.every((id) => selected.has(id));
  const selectedCount = selected.size;

  function toggleOne(shortId: number) {
    setSelected((prev) => toggleInSet(prev, shortId));
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === visibleShortIds.length && visibleShortIds.length > 0
        ? new Set()
        : new Set(visibleShortIds)
    );
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function reload() {
    await onChanged();
  }

  // ── Per-row actions ──

  async function rowComplete(task: Task) {
    setRowBusy(task.short_id);
    try {
      await api.bulkCompleteTasks([task.short_id]);
      toastSuccess(`Задача #${task.short_id} завершена`);
      await reload();
    } catch (e) {
      toastError(
        e instanceof Error ? e.message : "Не удалось завершить задачу"
      );
    } finally {
      setRowBusy(null);
    }
  }

  async function rowExtend(task: Task, days: number) {
    setRowBusy(task.short_id);
    try {
      await api.bulkExtendTasks([task.short_id], days);
      toastSuccess(`Дедлайн задачи #${task.short_id} продлён на ${days} дн.`);
      await reload();
    } catch (e) {
      toastError(
        e instanceof Error ? e.message : "Не удалось продлить дедлайн"
      );
    } finally {
      setRowBusy(null);
    }
  }

  // ── Bulk actions ──

  function reportBulk(label: string, result: {
    succeeded: number;
    failed: { short_id: number; error: string }[];
  }) {
    const summary = `${label}. ${summarizeBulkResult(result)}`;
    if (result.failed.length > 0) {
      toastError(summary);
    } else {
      toastSuccess(summary);
    }
  }

  async function bulkComplete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const result = await api.bulkCompleteTasks(ids);
      reportBulk("Завершение", result);
      clearSelection();
      await reload();
    } catch (e) {
      toastError(
        e instanceof Error ? e.message : "Не удалось завершить задачи"
      );
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkExtend(days: number) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const result = await api.bulkExtendTasks(ids, days);
      reportBulk(`Продление на ${days} дн.`, result);
      clearSelection();
      await reload();
    } catch (e) {
      toastError(
        e instanceof Error ? e.message : "Не удалось продлить дедлайны"
      );
    } finally {
      setBulkBusy(false);
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Нет задач, просроченных на 14+ дней. Здесь чисто.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sticky bulk action bar */}
      {selectedCount > 0 && (
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-background/95 px-3 py-2 shadow-sm backdrop-blur-sm">
          <span className="text-sm font-medium">
            Выбрано: {selectedCount}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={bulkBusy}
              onClick={() => void bulkComplete()}
            >
              {bulkBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Завершить все
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={bulkBusy}
              onClick={() => setBulkCancelOpen(true)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Отменить все
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={bulkBusy}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Продлить на
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {EXTEND_OPTIONS.map((days) => (
                  <DropdownMenuItem
                    key={days}
                    onClick={() => void bulkExtend(days)}
                  >
                    +{days} дней
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="sm"
              variant="ghost"
              disabled={bulkBusy}
              onClick={clearSelection}
            >
              Сбросить
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Выбрать все"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                />
              </th>
              <th className="px-2 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Задача</th>
              <th className="px-2 py-2 font-medium">Исполнитель</th>
              <th className="px-2 py-2 font-medium">Просрочка</th>
              <th className="px-2 py-2 text-right font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const overdue = daysOverdue(task.deadline, today);
              const canAct =
                !!user && PermissionService.canChangeTaskStatus(user, task);
              const isRowBusy = rowBusy === task.short_id;
              const isSelected = selected.has(task.short_id);
              return (
                <tr
                  key={task.id}
                  className={`border-b border-border/40 last:border-0 transition-colors ${
                    isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      aria-label={`Выбрать задачу #${task.short_id}`}
                      checked={isSelected}
                      onChange={() => toggleOne(task.short_id)}
                      className="mt-0.5 h-4 w-4 cursor-pointer rounded border-border accent-primary"
                    />
                  </td>
                  <td className="px-2 py-2 align-top font-mono text-xs text-muted-foreground">
                    #{task.short_id}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <Link
                      href={`/tasks/${task.short_id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline [overflow-wrap:anywhere]"
                    >
                      {task.title}
                    </Link>
                    {task.escalation_dm_sent_at && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-2xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        DM отправлен
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 align-top text-muted-foreground">
                    {task.assignee ? (
                      task.assignee.full_name
                    ) : (
                      <span className="italic text-muted-foreground/60">
                        Не назначен
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <span className="inline-flex items-center rounded-full bg-destructive/12 px-2 py-0.5 text-xs font-medium text-destructive">
                      {formatDaysOverdue(overdue)}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      {canAct ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-xs"
                            disabled={isRowBusy}
                            onClick={() => void rowComplete(task)}
                          >
                            {isRowBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            Завершить
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 px-2 text-xs"
                            disabled={isRowBusy}
                            onClick={() => setCancelTarget(task)}
                          >
                            <XCircle className="h-3 w-3" />
                            Отменить
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 px-2 text-xs"
                                disabled={isRowBusy}
                              >
                                <Clock className="h-3 w-3" />
                                Продлить
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {EXTEND_OPTIONS.map((days) => (
                                <DropdownMenuItem
                                  key={days}
                                  onClick={() => void rowExtend(task, days)}
                                >
                                  +{days} дней
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">
                          Нет прав
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Single-task cancel dialog */}
      {cancelTarget && (
        <SingleCancelDialog
          task={cancelTarget}
          onOpenChange={(open) => {
            if (!open) setCancelTarget(null);
          }}
          onCancelled={async () => {
            setCancelTarget(null);
            setSelected((prev) => {
              const next = new Set(prev);
              if (cancelTarget) next.delete(cancelTarget.short_id);
              return next;
            });
            await reload();
          }}
        />
      )}

      {/* Bulk cancel dialog */}
      <BulkCancelDialog
        open={bulkCancelOpen}
        count={selectedCount}
        onOpenChange={setBulkCancelOpen}
        onConfirm={async (reason, reasonText) => {
          const ids = Array.from(selected);
          const result = await api.bulkCancelTasks(ids, reason, reasonText);
          reportBulk("Отмена", result);
          clearSelection();
          await reload();
        }}
      />
    </div>
  );
}

/* ── Single-task cancel dialog (reuses the shared reason picker) ── */
function SingleCancelDialog({
  task,
  onOpenChange,
  onCancelled,
}: {
  task: Task;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const [reason, setReason] = useState<CancellationReasonCode | "">("");
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresText = reason === "other";
  const trimmedText = reasonText.trim();
  const canConfirm =
    !!reason && (!requiresText || trimmedText.length > 0) && !saving;

  async function handleConfirm() {
    if (!reason) {
      setError("Выберите причину отмены");
      return;
    }
    if (requiresText && !trimmedText) {
      setError("Опишите причину отмены");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.cancelTask(
        task.short_id,
        reason,
        requiresText ? trimmedText : undefined
      );
      toastSuccess(`Задача #${task.short_id} отменена`);
      onOpenChange(false);
      await onCancelled();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось отменить задачу";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Отменить задачу #{task.short_id}</DialogTitle>
          <DialogDescription>
            Укажите причину отмены. Задача перейдёт в статус «Отменено».
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="row-cancel-reason">
              Причина <span className="text-destructive">*</span>
            </Label>
            <Select
              value={reason}
              onValueChange={(v) => {
                setReason(v as CancellationReasonCode);
                setError(null);
              }}
            >
              <SelectTrigger id="row-cancel-reason">
                <SelectValue placeholder="Выберите причину" />
              </SelectTrigger>
              <SelectContent>
                {USER_CANCELLATION_REASONS.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresText && (
            <div className="space-y-2">
              <Label htmlFor="row-cancel-reason-text">
                Комментарий <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="row-cancel-reason-text"
                value={reasonText}
                onChange={(e) => {
                  setReasonText(e.target.value);
                  setError(null);
                }}
                placeholder="Почему задача отменяется?"
                rows={3}
                autoFocus
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Отмена...
              </>
            ) : (
              "Отменить задачу"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Bulk cancel dialog: one reason applied to all selected ── */
function BulkCancelDialog({
  open,
  count,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  count: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, reasonText?: string) => Promise<void>;
}) {
  const { toastError } = useToast();
  const [reason, setReason] = useState<CancellationReasonCode | "">("");
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresText = reason === "other";
  const trimmedText = reasonText.trim();
  const canConfirm =
    !!reason &&
    (!requiresText || trimmedText.length > 0) &&
    !saving &&
    count > 0;

  const reasonLabel =
    USER_CANCELLATION_REASONS.find((r) => r.code === reason)?.label ?? "";

  function reset() {
    setReason("");
    setReasonText("");
    setSaving(false);
    setError(null);
  }

  async function handleConfirm() {
    if (!reason) {
      setError("Выберите причину отмены");
      return;
    }
    if (requiresText && !trimmedText) {
      setError("Опишите причину отмены");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(reason, requiresText ? trimmedText : undefined);
      reset();
      onOpenChange(false);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось отменить задачи";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Отменить {count} задач</DialogTitle>
          <DialogDescription>
            {reason
              ? `Отменить ${count} задач с причиной «${reasonLabel}»?`
              : "Выберите причину — она будет применена ко всем выбранным задачам."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-cancel-reason">
              Причина <span className="text-destructive">*</span>
            </Label>
            <Select
              value={reason}
              onValueChange={(v) => {
                setReason(v as CancellationReasonCode);
                setError(null);
              }}
            >
              <SelectTrigger id="bulk-cancel-reason">
                <SelectValue placeholder="Выберите причину" />
              </SelectTrigger>
              <SelectContent>
                {USER_CANCELLATION_REASONS.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresText && (
            <div className="space-y-2">
              <Label htmlFor="bulk-cancel-reason-text">
                Комментарий <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="bulk-cancel-reason-text"
                value={reasonText}
                onChange={(e) => {
                  setReasonText(e.target.value);
                  setError(null);
                }}
                placeholder="Почему задачи отменяются?"
                rows={3}
                autoFocus
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Отмена...
              </>
            ) : (
              `Отменить ${count} задач`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
