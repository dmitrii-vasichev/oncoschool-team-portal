"use client";

import { useRouter } from "next/navigation";
import type { Task, TaskStatus, TaskPriority } from "@/lib/types";
import { parseLocalDate } from "@/lib/dateUtils";

const PRIORITY_ICONS: Record<TaskPriority, string> = {
  urgent: "🔴",
  high: "⚡",
  medium: "🔵",
  low: "⚪",
};

const STATUS_CONFIG: Record<TaskStatus, { className: string; label: string }> = {
  new: { className: "bg-blue-100 text-blue-700", label: "Новая" },
  in_progress: { className: "bg-amber-100 text-amber-700", label: "В работе" },
  review: { className: "bg-purple-100 text-purple-700", label: "Ревью" },
  done: { className: "bg-green-100 text-green-700", label: "Готово" },
  cancelled: { className: "bg-gray-100 text-gray-500", label: "Отменена" },
};

function formatDeadline(deadline: string): string {
  const d = parseLocalDate(deadline);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

function isOverdue(deadline: string, status: TaskStatus): boolean {
  if (status === "done" || status === "cancelled") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parseLocalDate(deadline);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

interface TaskCardProps {
  task: Task;
  showAssignee?: boolean;
}

export function TaskCard({ task, showAssignee }: TaskCardProps) {
  const router = useRouter();
  const statusCfg = STATUS_CONFIG[task.status];

  const handleClick = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
    }
    router.push(`/tasks/${task.short_id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="bg-tg-section-bg rounded-xl p-3 mb-2 active:scale-[0.98] transition-transform duration-100 cursor-pointer"
    >
      {/* Row 1: priority + id + title */}
      <div className="flex items-start gap-1.5">
        <span className="text-sm flex-shrink-0">{PRIORITY_ICONS[task.priority]}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {task.source === "voice" && <span className="text-xs">🎤</span>}
          <span className="text-tg-hint text-xs">#{task.short_id}</span>
        </div>
        <span className="text-tg-text font-medium text-sm line-clamp-2">
          {task.title}
        </span>
      </div>

      {/* Row 2: status badge + deadline */}
      <div className="flex items-center gap-2 mt-1.5 ml-5">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}
        >
          {statusCfg.label}
        </span>
        {task.deadline && (
          <span
            className={`text-xs ${
              isOverdue(task.deadline, task.status)
                ? "text-tg-destructive font-medium"
                : "text-tg-hint"
            }`}
          >
            {formatDeadline(task.deadline)}
          </span>
        )}
      </div>

      {/* Row 3: assignee (optional) */}
      {showAssignee && task.assignee && (
        <div className="mt-1 ml-5">
          <span className="text-tg-hint text-xs">{task.assignee.full_name}</span>
        </div>
      )}
    </div>
  );
}
