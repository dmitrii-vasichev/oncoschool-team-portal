import { type TaskStatus, TASK_STATUS_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Circle,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const STATUS_CONFIG: Record<
  TaskStatus,
  { icon: typeof Circle; badgeClassName: string; iconContainerClassName: string }
> = {
  new: {
    icon: Circle,
    badgeClassName:
      "bg-status-new-bg text-status-new-fg ring-1 ring-inset ring-status-new-ring",
    iconContainerClassName:
      "bg-status-new-bg text-status-new-fg ring-1 ring-inset ring-status-new-ring",
  },
  in_progress: {
    icon: Loader2,
    badgeClassName:
      "bg-status-progress-bg text-status-progress-fg ring-1 ring-inset ring-status-progress-ring",
    iconContainerClassName:
      "bg-status-progress-bg text-status-progress-fg ring-1 ring-inset ring-status-progress-ring",
  },
  review: {
    icon: Eye,
    badgeClassName:
      "bg-status-review-bg text-status-review-fg ring-1 ring-inset ring-status-review-ring",
    iconContainerClassName:
      "bg-status-review-bg text-status-review-fg ring-1 ring-inset ring-status-review-ring",
  },
  done: {
    icon: CheckCircle2,
    badgeClassName:
      "bg-status-done-bg text-status-done-fg ring-1 ring-inset ring-status-done-ring",
    iconContainerClassName:
      "bg-status-done-bg text-status-done-fg ring-1 ring-inset ring-status-done-ring",
  },
  cancelled: {
    icon: XCircle,
    badgeClassName:
      "bg-status-cancelled-bg text-status-cancelled-fg ring-1 ring-inset ring-status-cancelled-ring",
    iconContainerClassName:
      "bg-status-cancelled-bg text-status-cancelled-fg ring-1 ring-inset ring-status-cancelled-ring",
  },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { icon: Icon, badgeClassName } = STATUS_CONFIG[status];

  return (
    <span
      className={`badge-animated inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClassName}`}
    >
      <Icon
        className={`h-3 w-3 shrink-0 ${status === "in_progress" ? "animate-spin" : ""}`}
      />
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

export function StatusIcon({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const { icon: Icon, iconContainerClassName } = STATUS_CONFIG[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md transition-transform duration-150 hover:scale-[1.05]",
            iconContainerClassName,
            className
          )}
        >
          <Icon className={`h-3.5 w-3.5 ${status === "in_progress" ? "animate-spin" : ""}`} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        Статус: {TASK_STATUS_LABELS[status]}
      </TooltipContent>
    </Tooltip>
  );
}
