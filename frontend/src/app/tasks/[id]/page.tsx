"use client";

import { useState, useCallback, useEffect, type KeyboardEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mic,
  CalendarDays,
  ArrowLeft,
  Trash2,
  Play,
  Eye,
  Check,
  XCircle,
  ChevronDown,
  Clock,
  User,
  UserPlus,
  FileText,
  Pencil,
  Loader2,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { DatePicker } from "@/components/shared/DatePicker";
import { TimePicker } from "@/components/shared/TimePicker";
import { TaskUpdates } from "@/components/tasks/TaskUpdates";
import { TaskChecklist } from "@/components/tasks/TaskChecklist";
import { useTask } from "@/hooks/useTasks";
import { useTeam } from "@/hooks/useTeam";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PermissionService } from "@/lib/permissions";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { TASK_SOURCE_LABELS } from "@/lib/types";
import type { TaskStatus, TaskPriority, TaskChecklistItem } from "@/lib/types";
import { parseLocalDate, parseUTCDate } from "@/lib/dateUtils";

/* ============================================
   Constants
   ============================================ */

const STATUS_TRANSITIONS: Record<
  string,
  { status: TaskStatus; label: string; icon: typeof Play }[]
> = {
  new: [
    { status: "in_progress", label: "В работу", icon: Play },
    { status: "cancelled", label: "Отменить", icon: XCircle },
  ],
  in_progress: [
    { status: "review", label: "На ревью", icon: Eye },
    { status: "done", label: "Готово", icon: Check },
  ],
  review: [
    { status: "in_progress", label: "Вернуть", icon: Play },
    { status: "done", label: "Готово", icon: Check },
  ],
  done: [],
  cancelled: [{ status: "new", label: "Вернуть", icon: Play }],
};

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "urgent", label: "Срочный" },
  { value: "high", label: "Высокий" },
  { value: "medium", label: "Средний" },
  { value: "low", label: "Низкий" },
];

function isOverdue(deadline: string | null, status: string): boolean {
  if (!deadline) return false;
  if (status === "done" || status === "cancelled") return false;
  return parseLocalDate(deadline) < new Date(new Date().toDateString());
}

function formatDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function formatLocalInputDate(dateValue: Date): string {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLocalInputTime(dateValue: Date): string {
  const hours = String(dateValue.getHours()).padStart(2, "0");
  const minutes = String(dateValue.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function buildReminderIso(dateValue: string, timeValue: string): string | null {
  const [yearRaw, monthRaw, dayRaw] = dateValue.split("-");
  const [hoursRaw, minutesRaw] = timeValue.split(":");

  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(localDate.getTime())) {
    return null;
  }
  return localDate.toISOString();
}

function formatReminderDateTime(value: string): string {
  return parseUTCDate(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ============================================
   Page Component
   ============================================ */

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useCurrentUser();
  const shortId = params.id ? parseInt(params.id as string, 10) : null;
  const { task, loading, error, refetch } = useTask(shortId);
  const { members } = useTeam();
  const { toastSuccess, toastError } = useToast();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [updatesKey, setUpdatesKey] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [reminderComment, setReminderComment] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);

  const refreshUpdates = useCallback(() => {
    setUpdatesKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!task || isEditingTitle) return;
    setTitleDraft(task.title);
  }, [task, isEditingTitle]);

  useEffect(() => {
    if (!task || isEditingDescription) return;
    setDescriptionDraft(task.description || "");
  }, [task, isEditingDescription]);

  useEffect(() => {
    if (!task) return;
    if (!task.reminder_at) {
      setReminderDate("");
      setReminderTime("09:00");
      setReminderComment(task.reminder_comment || "");
      return;
    }

    const reminderDt = parseUTCDate(task.reminder_at);
    setReminderDate(formatLocalInputDate(reminderDt));
    setReminderTime(formatLocalInputTime(reminderDt));
    setReminderComment(task.reminder_comment || "");
  }, [task]);

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="max-w-4xl animate-fade-in-up">
        <Skeleton className="h-5 w-24 mb-8" />
        <Skeleton className="mb-4 h-10 w-full max-w-md" />
        <div className="flex gap-2 mb-8">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-6 border-y border-border/50 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
        <Skeleton className="h-32 w-full mt-8 rounded-lg" />
      </div>
    );
  }

  /* ---- Error ---- */
  if (error || !task) {
    return (
      <div className="max-w-4xl">
        <button
          onClick={() => router.push("/tasks")}
          className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5" />
          К задачам
        </button>
        <p className="text-sm text-destructive">
          {error || "Задача не найдена"}
        </p>
      </div>
    );
  }

  /* ---- Permissions ---- */
  const isModerator = user ? PermissionService.isModerator(user) : false;
  const canChangeStatus =
    user && PermissionService.canChangeTaskStatus(user, task);
  const canAddUpdate =
    user && PermissionService.canAddTaskUpdate(user, task);
  const canManageChecklist =
    user && PermissionService.canChangeTaskStatus(user, task);
  const canDelete = user && PermissionService.canDeleteTask(user);
  const isAuthor = !!user && task.created_by_id === user.id;
  const canEditTitle = !!canChangeStatus;
  const canEditTaskMeta = isModerator || isAuthor;
  const canManageReminder =
    !!user && PermissionService.canManageTaskReminder(user, task);
  const canSetReminderForCurrentTask = canManageReminder && !!task.assignee_id;
  const overdue = isOverdue(task.deadline, task.status);
  const transitions = STATUS_TRANSITIONS[task.status] || [];

  /* ---- Handlers ---- */
  async function handleStatusChange(newStatus: TaskStatus) {
    if (!shortId) return;
    setUpdatingStatus(true);
    try {
      await api.updateTask(shortId, { status: newStatus });
      await refetch();
      refreshUpdates();
      toastSuccess("Статус обновлён");
    } catch {
      toastError("Не удалось изменить статус");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleReassign(assigneeId: string) {
    if (!shortId || !canEditTaskMeta) return;
    try {
      await api.updateTask(shortId, {
        assignee_id: assigneeId === "none" ? null : assigneeId,
      });
      await refetch();
      toastSuccess("Исполнитель изменён");
    } catch {
      toastError("Не удалось изменить исполнителя");
    }
  }

  async function handlePriorityChange(priority: string) {
    if (!shortId || !canEditTaskMeta) return;
    try {
      await api.updateTask(shortId, {
        priority: priority as TaskPriority,
      });
      await refetch();
    } catch {
      toastError("Не удалось изменить приоритет");
    }
  }

  async function handleDeadlineChange(value: string) {
    if (!shortId || !canEditTaskMeta) return;
    try {
      await api.updateTask(shortId, {
        deadline: value || null,
      });
      await refetch();
      toastSuccess(value ? "Дедлайн обновлён" : "Дедлайн снят");
    } catch {
      toastError("Не удалось изменить дедлайн");
    }
  }

  async function handleDelete() {
    if (!shortId) return;
    setDeleting(true);
    try {
      await api.deleteTask(shortId);
      toastSuccess("Задача удалена");
      router.push("/tasks");
    } catch {
      toastError("Не удалось удалить задачу");
      setDeleting(false);
    }
  }

  async function handleChecklistChange(nextChecklist: TaskChecklistItem[]) {
    if (!shortId) return;
    setChecklistSaving(true);
    try {
      await api.updateTask(shortId, {
        checklist: nextChecklist,
      });
      await refetch();
    } catch (error) {
      toastError("Не удалось обновить чек-лист");
      throw error;
    } finally {
      setChecklistSaving(false);
    }
  }

  function handleStartTitleEdit() {
    if (!canEditTitle) return;
    if (!task) return;
    setTitleDraft(task.title);
    setIsEditingTitle(true);
  }

  function handleCancelTitleEdit() {
    if (!task) return;
    setTitleDraft(task.title);
    setIsEditingTitle(false);
  }

  async function handleSaveTitle() {
    if (!shortId || !canEditTitle || savingTitle || !task) return;
    const nextTitle = titleDraft.trim();

    if (!nextTitle) {
      toastError("Название задачи не может быть пустым");
      return;
    }

    if (nextTitle === task.title) {
      setIsEditingTitle(false);
      return;
    }

    setSavingTitle(true);
    try {
      await api.updateTask(shortId, { title: nextTitle });
      await refetch();
      setIsEditingTitle(false);
      toastSuccess("Название обновлено");
    } catch {
      toastError("Не удалось обновить название");
    } finally {
      setSavingTitle(false);
    }
  }

  function handleStartDescriptionEdit() {
    if (!canEditTaskMeta) return;
    if (!task) return;
    setDescriptionDraft(task.description || "");
    setIsEditingDescription(true);
  }

  function handleCancelDescriptionEdit() {
    if (!task) return;
    setDescriptionDraft(task.description || "");
    setIsEditingDescription(false);
  }

  async function handleSaveDescription() {
    if (!shortId || !canEditTaskMeta || savingDescription || !task) return;

    const normalizedNext = descriptionDraft.trim() || null;
    const normalizedCurrent = (task.description || "").trim() || null;
    if (normalizedNext === normalizedCurrent) {
      setIsEditingDescription(false);
      return;
    }

    setSavingDescription(true);
    try {
      await api.updateTask(shortId, { description: normalizedNext });
      await refetch();
      setIsEditingDescription(false);
      toastSuccess(normalizedNext ? "Описание обновлено" : "Описание очищено");
    } catch {
      toastError("Не удалось обновить описание");
    } finally {
      setSavingDescription(false);
    }
  }

  async function handleSaveReminder() {
    if (!shortId || !canManageReminder || savingReminder) return;
    if (!reminderDate || !reminderTime) {
      toastError("Укажите дату и время напоминания");
      return;
    }

    const reminderIso = buildReminderIso(reminderDate, reminderTime);
    if (!reminderIso) {
      toastError("Неверный формат даты или времени");
      return;
    }

    setSavingReminder(true);
    try {
      await api.updateTask(shortId, {
        reminder_at: reminderIso,
        reminder_comment: reminderComment.trim() || null,
      });
      await refetch();
      toastSuccess("Напоминание сохранено");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Не удалось сохранить напоминание");
    } finally {
      setSavingReminder(false);
    }
  }

  async function handleClearReminder() {
    if (!shortId || !canManageReminder || savingReminder) return;
    setSavingReminder(true);
    try {
      await api.updateTask(shortId, {
        reminder_at: null,
        reminder_comment: null,
      });
      await refetch();
      toastSuccess("Напоминание удалено");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Не удалось удалить напоминание");
    } finally {
      setSavingReminder(false);
    }
  }

  function handleTitleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSaveTitle();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancelTitleEdit();
    }
  }

  return (
    <TooltipProvider>
      <div className="max-w-4xl animate-fade-in-up">
        {/* ── Back nav ── */}
        <button
          onClick={() => router.push("/tasks")}
          className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5" />
          К задачам
        </button>

        {/* ── Hero header ── */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {canEditTitle && isEditingTitle ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  disabled={savingTitle}
                  autoFocus
                  className="h-11 text-xl sm:text-2xl font-bold font-heading tracking-tight"
                  placeholder="Название задачи"
                />
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSaveTitle()}
                    disabled={savingTitle}
                    className="min-w-9"
                    aria-label="Сохранить название"
                  >
                    {savingTitle ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCancelTitleEdit}
                    disabled={savingTitle}
                    aria-label="Отменить редактирование названия"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight leading-tight">
                  {task.title}
                </h1>
                {canEditTitle && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 h-8 w-8 text-muted-foreground/70 hover:text-foreground"
                    onClick={handleStartTitleEdit}
                    aria-label="Редактировать название задачи"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
          <span className="self-start rounded-md bg-muted/50 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground/70 sm:self-auto">
            #{task.short_id}
          </span>
        </div>

        {/* ── Badges row ── */}
        <div className="flex items-center gap-2.5 flex-wrap mb-6">
          <StatusBadge status={task.status} />

          {/* Priority: inline-editable for moderator/author */}
          {canEditTaskMeta ? (
            <Select
              value={task.priority}
              onValueChange={handlePriorityChange}
            >
              <SelectTrigger className="h-auto w-auto border-none bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:hidden">
                <span className="cursor-pointer hover:opacity-80">
                  <PriorityBadge priority={task.priority} />
                </span>
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <PriorityBadge priority={task.priority} />
          )}

          {task.source === "voice" && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs font-medium"
            >
              <Mic className="h-3 w-3" />
              Создана голосом
            </Badge>
          )}

          {task.meeting_id && (
            <Link href={`/meetings/${task.meeting_id}`}>
              <Badge
                variant="secondary"
                className="gap-1 text-xs font-medium cursor-pointer hover:bg-secondary/80"
              >
                <FileText className="h-3 w-3" />
                Из встречи
              </Badge>
            </Link>
          )}

          {task.source !== "voice" &&
            task.source !== "text" &&
            !task.meeting_id && (
              <Badge variant="secondary" className="text-xs">
                {TASK_SOURCE_LABELS[task.source]}
              </Badge>
            )}

          {overdue && (
            <Badge
              variant="destructive"
              className="text-xs font-medium animate-pulse-glow"
            >
              Просрочено
            </Badge>
          )}
        </div>

        {/* ── Action bar ── */}
        {(canChangeStatus || canEditTaskMeta) && (
          <div className="flex items-center gap-3 flex-wrap mb-8">
            {/* Status dropdown */}
            {canChangeStatus && transitions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updatingStatus}
                    className="gap-1.5"
                  >
                    Изменить статус
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {transitions.map((t) => {
                    const Icon = t.icon;
                    return (
                      <DropdownMenuItem
                        key={t.status}
                        onClick={() => handleStatusChange(t.status)}
                        className="gap-2"
                      >
                        <Icon className="h-4 w-4" />
                        {t.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Reassign (moderator/author) */}
            {canEditTaskMeta && (
              <Select
                value={task.assignee_id || "none"}
                onValueChange={handleReassign}
              >
                <SelectTrigger className="h-9 w-full text-sm sm:w-[200px]">
                  <div className="flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5 opacity-60" />
                    <SelectValue placeholder="Назначить" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначен</SelectItem>
                  {members
                    .filter((m) => m.is_active)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            {/* Delete */}
            {canDelete && (
              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deleting}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:ml-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Удалить задачу</TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить задачу?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Это действие необратимо. Задача и все её обновления будут удалены.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}

        {/* ── Meta grid ── */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 border-y border-border/50 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Assignee */}
          <div>
            <dt className="text-2xs uppercase tracking-wider text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
              <User className="h-3 w-3" />
              Исполнитель
            </dt>
            <dd>
              {task.assignee ? (
                <div className="flex items-center gap-2">
                  <UserAvatar name={task.assignee.full_name} avatarUrl={task.assignee.avatar_url} size="sm" />
                  <span className="text-sm font-medium">
                    {task.assignee.full_name}
                  </span>
                  {!task.assignee.is_active && (
                    <span className="text-2xs rounded-full px-1.5 py-0.5 bg-muted text-muted-foreground ring-1 ring-inset ring-border/60">
                      Неактивен
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Не назначен
                </span>
              )}
            </dd>
          </div>

          {/* Creator */}
          <div>
            <dt className="text-2xs uppercase tracking-wider text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
              <UserPlus className="h-3 w-3" />
              Автор
            </dt>
            <dd>
              {task.created_by ? (
                <div className="flex items-center gap-2">
                  <UserAvatar name={task.created_by.full_name} avatarUrl={task.created_by.avatar_url} size="sm" />
                  <span className="text-sm font-medium">
                    {task.created_by.full_name}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">&mdash;</span>
              )}
            </dd>
          </div>

          {/* Deadline */}
          <div>
            <dt className="text-2xs uppercase tracking-wider text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Дедлайн
            </dt>
            <dd>
              {canEditTaskMeta ? (
                <DatePicker
                  value={task.deadline ? task.deadline.slice(0, 10) : ""}
                  onChange={handleDeadlineChange}
                  placeholder="Не задан"
                  clearable
                  inline
                  overdue={overdue}
                />
              ) : task.deadline ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={`text-sm font-medium ${
                        overdue ? "text-destructive" : ""
                      }`}
                    >
                      {formatDateShort(task.deadline)}
                      {overdue && " !"}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {formatDate(task.deadline)}
                    {overdue && " — просрочено"}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span className="text-sm text-muted-foreground">&mdash;</span>
              )}
            </dd>
          </div>

          {/* Created */}
          <div>
            <dt className="text-2xs uppercase tracking-wider text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Создано
            </dt>
            <dd>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm font-medium">
                    {formatDateShort(task.created_at)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{formatDate(task.created_at)}</TooltipContent>
              </Tooltip>
            </dd>
          </div>
        </div>

        {(canManageReminder || task.reminder_at) && (
          <div className="mt-8 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Напоминание по задаче</h3>
              {task.reminder_at && (
                <span className="text-xs text-muted-foreground">
                  {formatReminderDateTime(task.reminder_at)}
                </span>
              )}
            </div>

            {canManageReminder ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <DatePicker
                    value={reminderDate}
                    onChange={setReminderDate}
                    placeholder="Дата напоминания"
                    clearable={false}
                    className="w-full"
                  />
                  <TimePicker
                    value={reminderTime}
                    onChange={setReminderTime}
                    placeholder="Время"
                    minuteStep={5}
                    className="h-10 w-full sm:w-[130px]"
                  />
                </div>

                <Textarea
                  value={reminderComment}
                  onChange={(e) => setReminderComment(e.target.value)}
                  rows={3}
                  placeholder="Комментарий к напоминанию (опционально)"
                />

                {!task.assignee_id && (
                  <p className="text-xs text-muted-foreground">
                    Сначала назначьте исполнителя, затем можно установить напоминание.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSaveReminder()}
                    disabled={
                      savingReminder ||
                      !reminderDate ||
                      !reminderTime ||
                      !canSetReminderForCurrentTask
                    }
                  >
                    {savingReminder ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Сохранить напоминание
                  </Button>
                  {task.reminder_at && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleClearReminder()}
                      disabled={savingReminder}
                    >
                      Удалить
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <p className="text-foreground">
                  {task.reminder_at
                    ? `Запланировано на ${formatReminderDateTime(task.reminder_at)}`
                    : "Напоминание не задано"}
                </p>
                {task.reminder_comment && (
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {task.reminder_comment}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Description ── */}
        {(task.description || canEditTaskMeta) && (
          <div className="mt-8 mb-2">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-2xs uppercase tracking-wider text-muted-foreground font-medium">
                Описание
              </h3>
              {canEditTaskMeta && !isEditingDescription && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleStartDescriptionEdit}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  {task.description ? "Редактировать" : "Добавить"}
                </Button>
              )}
            </div>

            {canEditTaskMeta && isEditingDescription ? (
              <div className="space-y-2 max-w-prose">
                <Textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={4}
                  placeholder="Добавьте описание задачи..."
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSaveDescription()}
                    disabled={savingDescription}
                  >
                    {savingDescription ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCancelDescriptionEdit}
                    disabled={savingDescription}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 max-w-prose">
                {task.description || (
                  <span className="text-muted-foreground">Описание не добавлено</span>
                )}
              </div>
            )}
          </div>
        )}

        <TaskChecklist
          items={task.checklist || []}
          canEdit={!!canManageChecklist}
          isSaving={checklistSaving}
          onChange={handleChecklistChange}
        />

        {/* ── Timeline ── */}
        <div className="mt-10 pt-8 border-t border-border/50">
          <h2 className="text-lg font-heading font-semibold mb-6">
            Обновления
          </h2>
          {shortId && (
            <TaskUpdates
              key={updatesKey}
              shortId={shortId}
              canAddUpdate={!!canAddUpdate}
              onUpdateCreated={() => {
                refreshUpdates();
                refetch();
              }}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
