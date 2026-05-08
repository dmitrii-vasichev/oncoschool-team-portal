import { parseLocalDate } from "../../lib/dateUtils.ts";
import type { MeetingBoardSectionKey, Task } from "../../lib/types.ts";

export const MEETING_BOARD_SECTIONS: MeetingBoardSectionKey[] = [
  "urgent",
  "new",
  "in_progress",
  "review",
  "done_this_week",
];

export function getMeetingBoardSectionMeta(key: MeetingBoardSectionKey): {
  label: string;
  tone: string;
} {
  const meta: Record<MeetingBoardSectionKey, { label: string; tone: string }> = {
    urgent: { label: "Срочные", tone: "border-priority-urgent-fg/30 bg-priority-urgent-bg/60" },
    new: { label: "Новые", tone: "border-border/70 bg-card/70" },
    in_progress: { label: "В работе", tone: "border-status-progress-fg/25 bg-status-progress-bg/50" },
    review: { label: "На согласовании", tone: "border-status-review-fg/25 bg-status-review-bg/50" },
    done_this_week: { label: "Выполнено за 7 дней", tone: "border-status-done-fg/25 bg-status-done-bg/50" },
  };
  return meta[key];
}

export function isMeetingBoardTaskOverdue(task: Task, now = new Date()): boolean {
  if (!task.deadline) return false;
  if (task.status === "done" || task.status === "cancelled") return false;
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  return parseLocalDate(task.deadline) < todayStart;
}
