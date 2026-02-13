"use client";

import { useEffect, useState, useMemo } from "react";
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
import { api } from "@/lib/api";
import type { Task, TaskStatus, TeamMember } from "@/lib/types";
import { TASK_STATUS_LABELS } from "@/lib/types";
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
  const { toastError } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TaskFilterValues>(EMPTY_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<TaskStatus>("new");

  async function fetchData() {
    try {
      setLoading(true);
      const [tasksRes, membersRes] = await Promise.all([
        api.getTasks({ per_page: "200" }),
        api.getTeam().catch(() => [] as TeamMember[]),
      ]);
      setTasks(tasksRes.items);
      setMembers(membersRes);
    } catch {
      toastError("Не удалось загрузить задачи");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

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
      <div className="flex items-start justify-between gap-4">
        <TaskFilters
          filters={filters}
          onFiltersChange={setFilters}
          members={members}
        />
        <Button
          onClick={() => setCreateOpen(true)}
          className="shrink-0 h-10 gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-sm"
        >
          <Plus className="h-4 w-4" />
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
      <div className="flex gap-1 overflow-x-auto pb-1 lg:hidden" data-no-transition>
        {COLUMNS.map((status) => (
          <button
            key={status}
            onClick={() => setMobileTab(status)}
            className={`
              flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap
              ${
                mobileTab === status
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }
            `}
          >
            <span className={`h-2 w-2 rounded-full ${COLUMN_DOT_COLORS[status]}`} />
            {TASK_STATUS_LABELS[status]}
            <span className={`
              text-xs rounded-full px-1.5 min-w-[20px] text-center
              ${mobileTab === status ? "bg-primary-foreground/20" : "bg-foreground/10"}
            `}>
              {tasksByStatus[status].length}
            </span>
          </button>
        ))}
      </div>

      {/* Mobile: single column */}
      <div className="lg:hidden">
        <KanbanColumn
          status={mobileTab}
          tasks={tasksByStatus[mobileTab]}
        />
      </div>

      {/* Desktop: 4 columns */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-4" data-no-transition>
        {COLUMNS.map((status, i) => (
          <div
            key={status}
            className={`animate-fade-in-up stagger-${i + 1}`}
          >
            <KanbanColumn
              status={status}
              tasks={tasksByStatus[status]}
            />
          </div>
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

function KanbanColumn({
  status,
  tasks,
}: {
  status: TaskStatus;
  tasks: Task[];
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Column header */}
      <div className={`flex items-center justify-between rounded-xl px-4 py-3 mb-3 ${COLUMN_BG[status]}`}>
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${COLUMN_DOT_COLORS[status]}`} />
          <h3 className="text-sm font-semibold text-foreground">
            {TASK_STATUS_LABELS[status]}
          </h3>
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-background/60 rounded-full px-2.5 py-0.5 min-w-[24px] text-center shadow-sm">
          {tasks.length}
        </span>
      </div>

      {/* Cards area — independent scroll */}
      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-340px)] space-y-2.5 pr-1">
        {tasks.length === 0 ? (
          <EmptyState
            variant="tasks"
            title="Нет задач"
            description="В этой колонке пока пусто"
            className="py-10"
          />
        ) : (
          tasks.map((task, i) => (
            <TaskCard
              key={task.id}
              task={task}
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))
        )}
      </div>
    </div>
  );
}
