"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Plus, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskCard } from "@/components/tasks/TaskCard";
import {
  TaskFilters,
  EMPTY_FILTERS,
  type TaskFilterValues,
} from "@/components/tasks/TaskFilters";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { useToast } from "@/components/shared/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDepartments } from "@/hooks/useDepartments";
import { api } from "@/lib/api";
import { getAccessibleDepartments } from "@/lib/departmentAccess";
import type { Task, TaskStatus, TeamMember } from "@/lib/types";
import { TASK_STATUS_LABELS } from "@/lib/types";
import { PermissionService } from "@/lib/permissions";
import { EmptyState } from "@/components/shared/EmptyState";

const COLUMNS: TaskStatus[] = ["new", "in_progress", "review", "done"];

const COLUMN_DOT_COLORS: Record<string, string> = {
  new: "bg-status-new-fg",
  in_progress: "bg-status-progress-fg",
  review: "bg-status-review-fg",
  done: "bg-status-done-fg",
};

const COLUMN_BG: Record<string, string> = {
  new: "bg-status-new-bg/50",
  in_progress: "bg-status-progress-bg/50",
  review: "bg-status-review-bg/50",
  done: "bg-status-done-bg/50",
};

export default function TasksPage() {
  const { user } = useCurrentUser();
  const { departments } = useDepartments();
  const { toastError } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TaskFilterValues>(EMPTY_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<TaskStatus>("new");
  const defaultScopeUserIdRef = useRef<string | null>(null);
  const userId = user?.id || "";
  const userDepartmentId = user?.department_id || "";
  const userExtraDepartmentIds = useMemo(
    () => user?.extra_department_ids || [],
    [user?.extra_department_ids]
  );
  const userRole = user?.role || "";

  // Native DnD state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const dragCounterRef = useRef<Record<string, number>>({});
  const accessibleDepartments = useMemo(
    () =>
      getAccessibleDepartments({
        departments,
        userId,
        userRole,
        userDepartmentId: userDepartmentId || null,
        userExtraDepartmentIds,
      }),
    [departments, userDepartmentId, userExtraDepartmentIds, userId, userRole]
  );
  const accessibleDepartmentIds = useMemo(
    () => new Set(accessibleDepartments.map((department) => department.id)),
    [accessibleDepartments]
  );
  const canSwitchDepartment = accessibleDepartments.length > 1;

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const params: Record<string, string> = { per_page: "200" };
      if (
        filters.department_id &&
        accessibleDepartmentIds.has(filters.department_id)
      ) {
        params.department_id = filters.department_id;
      }
      if (filters.assignee_id && filters.assignee_id !== "unassigned") {
        params.assignee_id = filters.assignee_id;
      }
      if (filters.created_by_id) {
        params.created_by_id = filters.created_by_id;
      }
      const [tasksRes, membersRes] = await Promise.all([
        api.getTasks(params),
        api.getTeam().catch(() => [] as TeamMember[]),
      ]);
      const scopedTasks =
        filters.assignee_id === "unassigned"
          ? tasksRes.items.filter((task) => !task.assignee_id)
          : tasksRes.items;
      setTasks(scopedTasks);
      setMembers(membersRes);
    } catch {
      toastError("Не удалось загрузить задачи");
    } finally {
      setLoading(false);
    }
  }, [
    accessibleDepartmentIds,
    filters.assignee_id,
    filters.created_by_id,
    filters.department_id,
    toastError,
    user?.id,
  ]);

  useEffect(() => {
    if (!user?.id) return;
    if (defaultScopeUserIdRef.current === user.id) return;
    const defaultDepartmentId =
      user.department_id || user.extra_department_ids?.[0] || "";
    setFilters(
      defaultDepartmentId
        ? { ...EMPTY_FILTERS, department_id: defaultDepartmentId }
        : { ...EMPTY_FILTERS, assignee_id: user.id }
    );
    defaultScopeUserIdRef.current = user.id;
  }, [user?.department_id, user?.extra_department_ids, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (defaultScopeUserIdRef.current !== user.id) return;
    fetchData();
  }, [fetchData, user?.id]);

  useEffect(() => {
    if (departments.length === 0) return;
    if (!filters.department_id) return;
    if (accessibleDepartmentIds.has(filters.department_id)) return;
    setFilters((prev) => ({ ...prev, department_id: "" }));
  }, [accessibleDepartmentIds, departments.length, filters.department_id]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (
        filters.search &&
        !t.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !`#${t.short_id}`.includes(filters.search)
      ) {
        return false;
      }
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.source && t.source !== filters.source) return false;
      if (filters.assignee_id) {
        if (filters.assignee_id === "unassigned") {
          if (t.assignee_id) return false;
        } else if (t.assignee_id !== filters.assignee_id) {
          return false;
        }
      }
      if (filters.created_by_id && t.created_by_id !== filters.created_by_id) {
        return false;
      }
      return true;
    });
  }, [tasks, filters]);

  const tasksByStatus = useMemo(() => {
    return COLUMNS.reduce(
      (acc, status) => {
        acc[status] = filteredTasks.filter((t) => t.status === status);
        return acc;
      },
      {} as Record<TaskStatus, Task[]>
    );
  }, [filteredTasks]);

  // ── Native drag-and-drop handlers ──

  const handleDragStart = useCallback(
    (e: React.DragEvent, taskId: string) => {
      e.dataTransfer.effectAllowed = "move";
      // Required for Firefox
      e.dataTransfer.setData("text/plain", taskId);
      // Small delay so the browser captures the element before we style it
      requestAnimationFrame(() => setDraggedTaskId(taskId));
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDragOverStatus(null);
    dragCounterRef.current = {};
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDragEnter = useCallback(
    (e: React.DragEvent, status: TaskStatus) => {
      e.preventDefault();
      dragCounterRef.current[status] = (dragCounterRef.current[status] || 0) + 1;
      setDragOverStatus(status);
    },
    []
  );

  const handleDragLeave = useCallback(
    (_e: React.DragEvent, status: TaskStatus) => {
      dragCounterRef.current[status] = (dragCounterRef.current[status] || 0) - 1;
      if (dragCounterRef.current[status] <= 0) {
        dragCounterRef.current[status] = 0;
        setDragOverStatus((prev) => (prev === status ? null : prev));
      }
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, newStatus: TaskStatus) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
      if (!taskId) return;

      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === newStatus) return;

      // Permission check: moderator, task assignee, or task author
      if (user && !PermissionService.canChangeTaskStatus(user, task)) {
        setDraggedTaskId(null);
        setDragOverStatus(null);
        dragCounterRef.current = {};
        toastError("Нет прав на изменение статуса этой задачи");
        return;
      }

      const oldStatus = task.status;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      setDraggedTaskId(null);
      setDragOverStatus(null);
      dragCounterRef.current = {};

      // Persist to backend — revert on error
      api.updateTask(task.short_id, { status: newStatus }).catch(() => {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: oldStatus } : t))
        );
        toastError("Не удалось изменить статус");
      });
    },
    [tasks, draggedTaskId, toastError, user]
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-56 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col} className="space-y-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header: filters + create button */}
      <div className="flex flex-col gap-3 min-[1400px]:flex-row min-[1400px]:items-start min-[1400px]:justify-between">
        <TaskFilters
          filters={filters}
          onFiltersChange={setFilters}
          members={members}
          departments={accessibleDepartments}
          showDepartmentFilter={canSwitchDepartment}
        />
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="w-full rounded-xl gap-1.5 sm:w-auto min-[1400px]:shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Новая задача
        </Button>
      </div>

      {/* Counter */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <LayoutGrid className="h-4 w-4" />
          <span>
            {filteredTasks.length} из {tasks.length} задач
          </span>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="relative lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur-sm">
        <div
          className="overflow-x-auto pb-1 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-no-transition
        >
          <div className="inline-flex min-w-max items-center gap-1 rounded-xl bg-muted/70 p-1">
            {COLUMNS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setMobileTab(status)}
                className={`
                  flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors
                  ${
                    mobileTab === status
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  }
                `}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${COLUMN_DOT_COLORS[status]}`} />
                {TASK_STATUS_LABELS[status]}
                <span
                  className={`
                    ml-0.5 rounded-md px-1.5 py-0.5 text-2xs font-semibold leading-none
                    ${
                      mobileTab === status
                        ? "bg-primary/10 text-primary"
                        : "bg-foreground/10 text-muted-foreground"
                    }
                  `}
                >
                  {tasksByStatus[status].length}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
      </div>

      {/* Mobile: single column — no DnD */}
      <div className="lg:hidden">
        <StaticKanbanColumn
          status={mobileTab}
          tasks={tasksByStatus[mobileTab]}
        />
      </div>

      {/* Desktop: 4 columns with native drag-and-drop */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-4" data-no-transition>
        {COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            draggedTaskId={draggedTaskId}
            isDragOver={dragOverStatus === status}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {user && (
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          currentUser={user}
          members={members}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}

/* Column header shared by both mobile and desktop */
function ColumnHeader({ status, count }: { status: TaskStatus; count: number }) {
  return (
    <div
      className={`sticky top-0 z-20 mb-3 rounded-xl p-1 bg-background/95 backdrop-blur-sm ${COLUMN_BG[status]}`}
    >
      <div className="flex items-center justify-between rounded-lg bg-background/85 px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${COLUMN_DOT_COLORS[status]}`} />
          <h3 className="text-sm font-medium text-foreground">
            {TASK_STATUS_LABELS[status]}
          </h3>
        </div>
        <span className="min-w-[22px] rounded-md bg-foreground/10 px-1.5 py-0.5 text-center text-2xs font-semibold leading-none text-muted-foreground">
          {count}
        </span>
      </div>
    </div>
  );
}

/* Mobile: static column without DnD */
function StaticKanbanColumn({ status, tasks }: { status: TaskStatus; tasks: Task[] }) {
  return (
    <div className="flex flex-col">
      <ColumnHeader status={status} count={tasks.length} />
      <div className="flex flex-col gap-2.5 p-2 min-h-[80px]">
        {tasks.length === 0 ? (
          <EmptyState variant="tasks" title="Нет задач" description="В этой колонке пока пусто" className="py-10" />
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))
        )}
      </div>
    </div>
  );
}

/* Desktop: column with native HTML5 drag-and-drop */
function KanbanColumn({
  status,
  tasks,
  draggedTaskId,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  status: TaskStatus;
  tasks: Task[];
  draggedTaskId: string | null;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent, status: TaskStatus) => void;
  onDragLeave: (e: React.DragEvent, status: TaskStatus) => void;
  onDrop: (e: React.DragEvent, status: TaskStatus) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <ColumnHeader status={status} count={tasks.length} />
      <div
        onDragOver={onDragOver}
        onDragEnter={(e) => onDragEnter(e, status)}
        onDragLeave={(e) => onDragLeave(e, status)}
        onDrop={(e) => onDrop(e, status)}
        className={`
          flex min-h-[80px] flex-1 flex-col gap-2.5
          rounded-xl p-2 transition-colors duration-150
          ${isDragOver && draggedTaskId ? "bg-primary/5 ring-2 ring-primary/20 ring-inset" : ""}
        `}
      >
        {tasks.length === 0 && !isDragOver ? (
          <EmptyState variant="tasks" title="Нет задач" description="В этой колонке пока пусто" className="py-10" />
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => onDragStart(e, task.id)}
              onDragEnd={onDragEnd}
              className={
                draggedTaskId === task.id ? "opacity-40 scale-[0.97]" : ""
              }
            >
              <TaskCard task={task} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
