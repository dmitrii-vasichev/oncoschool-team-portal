"use client";

import Link from "next/link";
import {
  Mic,
  CalendarDays,
  FileText,
} from "lucide-react";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { Task, TaskPriority } from "@/lib/types";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function isOverdue(task: Task): boolean {
  if (!task.deadline) return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  return new Date(task.deadline) < new Date(new Date().toDateString());
}

const PRIORITY_STRIP_COLORS: Record<TaskPriority, string> = {
  urgent: "bg-priority-urgent-dot",
  high: "bg-priority-high-dot",
  medium: "bg-priority-medium-dot",
  low: "bg-priority-low-dot",
};

export function TaskCard({
  task,
  style,
}: {
  task: Task;
  style?: React.CSSProperties;
}) {
  const overdue = isOverdue(task);

  return (
    <Link
      href={`/tasks/${task.short_id}`}
      className={`
        group block rounded-xl bg-card border shadow-sm
        hover:shadow-md hover:-translate-y-0.5 hover:border-primary/20
        focus-visible:ring-2 focus-visible:ring-primary/30
        overflow-hidden
        ${overdue ? "border-destructive/40 animate-pulse-glow" : "border-border/50"}
      `}
      style={style}
    >
      {/* Priority color strip */}
      <div
        className={`h-[3px] w-full ${PRIORITY_STRIP_COLORS[task.priority]}`}
      />

      <div className="p-3.5 space-y-2.5">
        {/* Header: ID + source icons */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-mono">
            #{task.short_id}
          </span>
          {task.source === "voice" && (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-purple-100 dark:bg-purple-900/30" title="Голосовая задача">
              <Mic className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400" />
            </span>
          )}
          {task.source === "summary" && (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-blue-100 dark:bg-blue-900/30" title="Из встречи">
              <FileText className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
            </span>
          )}
          {overdue && (
            <span className="ml-auto text-2xs font-medium text-destructive bg-destructive/10 rounded-full px-1.5 py-0.5">
              Просрочено
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary">
          {task.title}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <PriorityBadge priority={task.priority} />
          {task.deadline && (
            <span
              className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${
                overdue
                  ? "text-destructive bg-destructive/10 font-medium"
                  : "text-muted-foreground bg-muted"
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              {formatDate(task.deadline)}
            </span>
          )}
        </div>

        {/* Footer: assignee */}
        <div className="flex items-center justify-between pt-0.5">
          {task.assignee ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <UserAvatar name={task.assignee.full_name} size="sm" />
              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                {task.assignee.full_name}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/50 italic">
              Не назначен
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
