"use client";

import Link from "next/link";
import {
  ListChecks,
  ChevronRight,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { Task, Meeting } from "@/lib/types";

interface MeetingTasksTabProps {
  tasks: Task[];
  meeting: Meeting;
  isModerator: boolean;
  onSwitchToSummary: () => void;
}

export function MeetingTasksTab({
  tasks,
  meeting,
  isModerator,
  onSwitchToSummary,
}: MeetingTasksTabProps) {
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const taskProgress =
    tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
          <ListChecks className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">
          К этой встрече ещё не привязано задач
        </p>
        {meeting.transcript && !meeting.parsed_summary && isModerator && (
          <>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Обработайте транскрипцию через AI для автоматического создания
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSwitchToSummary}
              className="mt-3 text-xs gap-1 text-primary"
            >
              <Bot className="h-3.5 w-3.5" />
              Обработать через AI
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex-1">
          <Progress value={taskProgress} className="h-1.5" />
        </div>
        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
          {doneCount}/{tasks.length} выполнено · {taskProgress}%
        </span>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <Link
            key={task.id}
            href={`/tasks/${task.short_id}`}
            className="group block"
          >
            <div
              className="rounded-xl border border-border/60 bg-card p-4 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-px transition-all animate-fade-in-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-2xs font-mono text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                    #{task.short_id}
                  </span>
                  <span className="text-sm font-heading font-semibold truncate group-hover:text-primary transition-colors">
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </div>

              {task.assignee && (
                <div className="mt-2 flex items-center gap-2 sm:ml-12">
                  <UserAvatar name={task.assignee.full_name} avatarUrl={task.assignee.avatar_url} size="sm" />
                  <span className="text-xs text-muted-foreground">
                    {task.assignee.full_name}
                  </span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
