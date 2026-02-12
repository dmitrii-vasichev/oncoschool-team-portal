import { Badge } from "@/components/ui/badge";
import { type TaskStatus, TASK_STATUS_LABELS } from "@/lib/types";

const STATUS_STYLES: Record<TaskStatus, string> = {
  new: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  in_progress: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  review: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  done: "bg-green-100 text-green-800 hover:bg-green-100",
  cancelled: "bg-gray-100 text-gray-500 hover:bg-gray-100",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="secondary" className={STATUS_STYLES[status]}>
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}
