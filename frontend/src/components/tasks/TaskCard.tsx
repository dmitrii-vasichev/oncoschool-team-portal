"use client";

import Link from "next/link";
import {
  Mic,
  CalendarDays,
  FileText,
  CheckCircle2,
  Circle,
  ListChecks,
} from "lucide-react";
import { PriorityIcon } from "@/components/shared/PriorityBadge";
import { StatusIcon } from "@/components/shared/StatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsTruncated } from "@/hooks/useIsTruncated";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { parseLocalDate } from "@/lib/dateUtils";

function formatDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function isOverdue(task: Task): boolean {
  if (!task.deadline) return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return parseLocalDate(task.deadline) < todayStart;
}

export function TaskCard({ task }: { task: Task }) {
  const overdue = isOverdue(task);
  const checklist = task.checklist || [];
  const completedChecklistCount = checklist.filter((item) => item.is_completed).length;
  const checklistPreview = checklist.slice(0, 2);
  const checklistHiddenCount = Math.max(0, checklist.length - checklistPreview.length);
  const { ref: titleRef, isTruncated: isTitleTruncated } =
    useIsTruncated<HTMLParagraphElement>(task.title);

  const cardClass = overdue
    ? "border-destructive/35 bg-destructive/[0.05] shadow-[0_0_0_1px_hsl(var(--destructive)/0.12)_inset] hover:bg-destructive/[0.08] hover:border-destructive/45"
    : "bg-card border-border/50 hover:border-primary/20";
  const titleClass = `h-[3.75rem] overflow-hidden line-clamp-3 break-words [overflow-wrap:anywhere] text-sm leading-5 font-heading font-semibold ${
    overdue
      ? "text-destructive group-hover:text-destructive"
      : "group-hover:text-primary"
  }`;

  return (
    <TooltipProvider delayDuration={120}>
      <div
        className={`
          group h-full rounded-xl border overflow-hidden shadow-sm
          transition-all duration-150 hover:shadow-md hover:-translate-y-0.5
          ${cardClass}
        `}
      >
        <Link
          href={`/tasks/${task.short_id}`}
          className="block h-full"
          draggable={false}
        >
          <div className="flex h-full flex-col gap-2.5 p-3">
            {/* Header: title + status/priority icons */}
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                {isTitleTruncated ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <p ref={titleRef} className={titleClass}>
                        {task.title}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="start"
                      className="max-w-[320px] break-words"
                    >
                      {task.title}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <p ref={titleRef} className={titleClass}>
                    {task.title}
                  </p>
                )}

                <div className="flex h-3.5 items-center gap-1">
                  {task.source === "voice" && (
                    <span
                      className="inline-flex items-center justify-center h-3.5 w-3.5 rounded bg-purple-100 dark:bg-purple-900/30"
                      title="Голосовая задача"
                    >
                      <Mic className="h-2 w-2 text-purple-600 dark:text-purple-400" />
                    </span>
                  )}
                  {task.source === "summary" && (
                    <span
                      className="inline-flex items-center justify-center h-3.5 w-3.5 rounded bg-blue-100 dark:bg-blue-900/30"
                      title="Из встречи"
                    >
                      <FileText className="h-2 w-2 text-blue-600 dark:text-blue-400" />
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <StatusIcon status={task.status} className="h-6 w-6 rounded-[10px]" />
                <PriorityIcon priority={task.priority} className="h-6 w-6 rounded-[10px]" />
              </div>
            </div>

            {/* Checklist preview */}
            {checklist.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/40 px-2.5 py-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
                    <ListChecks className="h-3 w-3" />
                    Подзадачи
                  </span>
                  <span className="text-2xs font-medium text-foreground/80">
                    {completedChecklistCount}/{checklist.length}
                  </span>
                </div>

                <div className="space-y-1">
                  {checklistPreview.map((item) => (
                    <div key={item.id} className="flex items-center gap-1.5">
                      {item.is_completed ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-status-done-fg" />
                      ) : (
                        <Circle className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                      <span
                        className={cn(
                          "text-xs truncate",
                          item.is_completed
                            ? "line-through text-muted-foreground"
                            : "text-foreground/85"
                        )}
                      >
                        {item.title}
                      </span>
                    </div>
                  ))}
                  {checklistHiddenCount > 0 && (
                    <p className="text-2xs text-muted-foreground">
                      + еще {checklistHiddenCount}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-auto flex min-h-6 items-center justify-between gap-2 pt-0.5">
              <div className="flex min-h-6 items-center gap-1.5">
                {overdue && (
                  <span className="rounded-full bg-destructive/12 px-2 py-0.5 text-2xs font-medium text-destructive">
                    Просрочено
                  </span>
                )}
                {task.deadline && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 ${
                      overdue
                        ? "text-destructive bg-destructive/12 font-medium"
                        : "text-muted-foreground bg-muted"
                    }`}
                  >
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(task.deadline)}
                  </span>
                )}
              </div>

              {task.assignee ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <UserAvatar
                    name={task.assignee.full_name}
                    avatarUrl={task.assignee.avatar_url}
                    size="sm"
                  />
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {task.assignee.full_name}
                  </span>
                  {!task.assignee.is_active && (
                    <span className="text-2xs rounded-full px-1.5 py-0.5 bg-muted text-muted-foreground ring-1 ring-inset ring-border/60">
                      Неактивен
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground/50 italic">
                  Не назначен
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>
    </TooltipProvider>
  );
}
