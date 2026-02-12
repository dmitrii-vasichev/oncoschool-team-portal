"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Mic,
  CalendarDays,
  Plus,
  ArrowLeft,
  Trash2,
  Play,
  Eye,
  Check,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { TaskUpdates } from "@/components/tasks/TaskUpdates";
import { AddUpdateDialog } from "@/components/tasks/AddUpdateDialog";
import { useTask } from "@/hooks/useTasks";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PermissionService } from "@/lib/permissions";
import { api } from "@/lib/api";
import { TASK_SOURCE_LABELS } from "@/lib/types";
import type { TaskStatus } from "@/lib/types";

const STATUS_TRANSITIONS: Record<string, { status: TaskStatus; label: string; icon: typeof Play }[]> = {
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

function isOverdue(deadline: string | null, status: string): boolean {
  if (!deadline) return false;
  if (status === "done" || status === "cancelled") return false;
  return new Date(deadline) < new Date(new Date().toDateString());
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useCurrentUser();
  const shortId = params.id ? parseInt(params.id as string, 10) : null;
  const { task, loading, error, refetch } = useTask(shortId);
  const [addUpdateOpen, setAddUpdateOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatesKey, setUpdatesKey] = useState(0);

  const refreshUpdates = useCallback(() => {
    setUpdatesKey((k) => k + 1);
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <p className="text-sm text-destructive">
        {error || "Задача не найдена"}
      </p>
    );
  }

  const canChangeStatus =
    user && PermissionService.canChangeTaskStatus(user, task);
  const canAddUpdate =
    user && PermissionService.canAddTaskUpdate(user, task);
  const canDelete = user && PermissionService.canDeleteTask(user);
  const overdue = isOverdue(task.deadline, task.status);
  const transitions = STATUS_TRANSITIONS[task.status] || [];

  async function handleStatusChange(newStatus: TaskStatus) {
    if (!shortId) return;
    setUpdatingStatus(true);
    try {
      await api.updateTask(shortId, { status: newStatus });
      await refetch();
      refreshUpdates();
    } catch {
      // silent
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDelete() {
    if (!shortId) return;
    if (!confirm("Удалить задачу? Это действие необратимо.")) return;
    setDeleting(true);
    try {
      await api.deleteTask(shortId);
      router.push("/tasks");
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/tasks")}
        className="mb-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        К доске
      </Button>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-muted-foreground font-mono">
            #{task.short_id}
          </span>
          {task.source === "voice" && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Mic className="h-3 w-3" /> Создана голосом
            </Badge>
          )}
          {task.source !== "voice" && task.source !== "text" && (
            <Badge variant="secondary" className="text-xs">
              {TASK_SOURCE_LABELS[task.source]}
            </Badge>
          )}
        </div>
        <h2 className="text-2xl font-bold">{task.title}</h2>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {task.deadline && (
          <span
            className={`text-sm flex items-center gap-1 ${
              overdue
                ? "text-red-600 font-medium"
                : "text-muted-foreground"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            {new Date(task.deadline).toLocaleDateString("ru-RU")}
            {overdue && " (просрочено)"}
          </span>
        )}
      </div>

      {canChangeStatus && transitions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {transitions.map((t) => {
            const Icon = t.icon;
            return (
              <Button
                key={t.status}
                size="sm"
                variant={
                  t.status === "cancelled" ? "outline" : "default"
                }
                disabled={updatingStatus}
                onClick={() => handleStatusChange(t.status)}
              >
                <Icon className="h-4 w-4 mr-1" />
                {t.label}
              </Button>
            );
          })}
          {canDelete && (
            <Button
              size="sm"
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
              className="ml-auto"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Удалить
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Исполнитель
            </CardTitle>
          </CardHeader>
          <CardContent>
            {task.assignee ? (
              <div className="flex items-center gap-2">
                <UserAvatar name={task.assignee.full_name} />
                <span className="text-sm font-medium">
                  {task.assignee.full_name}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                Не назначен
              </span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Автор
            </CardTitle>
          </CardHeader>
          <CardContent>
            {task.created_by ? (
              <div className="flex items-center gap-2">
                <UserAvatar name={task.created_by.full_name} />
                <span className="text-sm font-medium">
                  {task.created_by.full_name}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </CardContent>
        </Card>
      </div>

      {task.description && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Описание
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">Обновления</CardTitle>
          {canAddUpdate && (
            <Button size="sm" onClick={() => setAddUpdateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Обновление
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {shortId && <TaskUpdates key={updatesKey} shortId={shortId} />}
        </CardContent>
      </Card>

      {shortId && (
        <AddUpdateDialog
          open={addUpdateOpen}
          onOpenChange={setAddUpdateOpen}
          shortId={shortId}
          onCreated={() => {
            refreshUpdates();
            refetch();
          }}
        />
      )}
    </div>
  );
}
