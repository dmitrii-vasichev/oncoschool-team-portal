import { Badge } from "@/components/ui/badge";
import { type TaskPriority, TASK_PRIORITY_LABELS } from "@/lib/types";

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  urgent: "bg-red-100 text-red-800 hover:bg-red-100",
  high: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  medium: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  low: "bg-gray-100 text-gray-600 hover:bg-gray-100",
};

const PRIORITY_ICONS: Record<TaskPriority, string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🔵",
  low: "⚪",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant="secondary" className={PRIORITY_STYLES[priority]}>
      {PRIORITY_ICONS[priority]} {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
