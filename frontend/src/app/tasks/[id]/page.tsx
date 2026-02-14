"use client";

import { useState, useCallback } from "react";
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { TaskUpdates } from "@/components/tasks/TaskUpdates";
import { useTask } from "@/hooks/useTasks";
import { useTeam } from "@/hooks/useTeam";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PermissionService } from "@/lib/permissions";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { TASK_SOURCE_LABELS } from "@/lib/types";
import type { TaskStatus, TaskPriority } from "@/lib/types";
import { parseLocalDate } from "@/lib/dateUtils";

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
  const [updatesKey, setUpdatesKey] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const refreshUpdates = useCallback(() => {
    setUpdatesKey((k) => k + 1);
  }, []);

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="max-w-4xl animate-fade-in-up">
        <Skeleton className="h-5 w-24 mb-8" />
        <Skeleton className="h-10 w-96 mb-4" />
        <div className="flex gap-2 mb-8">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6 border-y border-border/50">
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
  const canDelete = user && PermissionService.canDeleteTask(user);
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
    if (!shortId) return;
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
    if (!shortId) return;
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
    if (!shortId) return;
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
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight leading-tight">
            <span className="font-mono text-muted-foreground font-semibold">
              #{task.short_id}
            </span>
            <span className="mx-2 text-border select-none">&middot;</span>
            {task.title}
          </h1>
        </div>

        {/* ── Badges row ── */}
        <div className="flex items-center gap-2.5 flex-wrap mb-6">
          <StatusBadge status={task.status} />

          {/* Priority: inline-editable for moderator */}
          {isModerator ? (
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
        {(canChangeStatus || isModerator) && (
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

            {/* Reassign (moderator only) */}
            {isModerator && (
              <Select
                value={task.assignee_id || "none"}
                onValueChange={handleReassign}
              >
                <SelectTrigger className="w-[200px] h-9 text-sm">
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
                        className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10"
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-5 py-6 border-y border-border/50">
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
              {isModerator ? (
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

        {/* ── Description ── */}
        {task.description && (
          <div className="mt-8 mb-2">
            <h3 className="text-2xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Описание
            </h3>
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 max-w-prose">
              {task.description}
            </div>
          </div>
        )}

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
