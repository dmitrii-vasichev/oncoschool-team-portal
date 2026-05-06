import { normalizeTaskUrgency } from "@/lib/taskUrgency";
import type { TaskPriority } from "@/lib/types";

export function PriorityBadge({
  priority,
  showNormal = true,
}: {
  priority: TaskPriority | string | null | undefined;
  showNormal?: boolean;
}) {
  const urgency = normalizeTaskUrgency(priority);
  if (urgency === "normal" && !showNormal) return null;

  const className =
    urgency === "urgent"
      ? "bg-priority-urgent-bg text-priority-urgent-fg ring-1 ring-inset ring-priority-urgent-dot/40"
      : "bg-muted text-muted-foreground ring-1 ring-inset ring-border/70";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {urgency === "urgent" ? "Срочно" : "Обычная"}
    </span>
  );
}

export function PriorityIcon() {
  return null;
}
