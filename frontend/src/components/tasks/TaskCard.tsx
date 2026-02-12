"use client";

import Link from "next/link";
import { Mic, CalendarDays, AlertTriangle } from "lucide-react";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { Task } from "@/lib/types";

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

export function TaskCard({ task }: { task: Task }) {
  const overdue = isOverdue(task);

  return (
    <Link
      href={`/tasks/${task.short_id}`}
      className={`block rounded-lg border p-3 transition-colors hover:bg-accent ${
        overdue ? "border-red-400 bg-red-50/50" : ""
      }`}
    >
      <div className="flex items-center gap-1 mb-1">
        <span className="text-xs text-muted-foreground font-mono">
          #{task.short_id}
        </span>
        {task.source === "voice" && (
          <Mic className="h-3 w-3 text-muted-foreground" />
        )}
        {overdue && (
          <AlertTriangle className="h-3 w-3 text-red-500" />
        )}
      </div>

      <p className="text-sm font-medium truncate mb-2">{task.title}</p>

      <div className="flex items-center gap-1 flex-wrap">
        <PriorityBadge priority={task.priority} />
        {task.deadline && (
          <span
            className={`text-xs flex items-center gap-0.5 ${
              overdue ? "text-red-600 font-medium" : "text-muted-foreground"
            }`}
          >
            <CalendarDays className="h-3 w-3" />
            {formatDate(task.deadline)}
          </span>
        )}
      </div>

      {task.assignee && (
        <div className="mt-2 flex items-center gap-1">
          <UserAvatar name={task.assignee.full_name} size="sm" />
          <span className="text-xs text-muted-foreground truncate">
            {task.assignee.full_name}
          </span>
        </div>
      )}
    </Link>
  );
}
