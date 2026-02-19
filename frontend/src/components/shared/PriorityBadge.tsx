import { type TaskPriority, TASK_PRIORITY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  ArrowUp,
  Minus,
  ArrowDown,
  Flag,
} from "lucide-react";

const PRIORITY_CONFIG: Record<
  TaskPriority,
  {
    icon: typeof ArrowUp;
    badgeClassName: string;
    iconContainerClassName: string;
  }
> = {
  urgent: {
    icon: AlertTriangle,
    badgeClassName: "bg-priority-urgent-bg text-priority-urgent-fg",
    iconContainerClassName:
      "bg-priority-urgent-bg text-priority-urgent-fg ring-1 ring-inset ring-priority-urgent-dot/40",
  },
  high: {
    icon: ArrowUp,
    badgeClassName: "bg-priority-high-bg text-priority-high-fg",
    iconContainerClassName:
      "bg-priority-high-bg text-priority-high-fg ring-1 ring-inset ring-priority-high-dot/40",
  },
  medium: {
    icon: Minus,
    badgeClassName: "bg-priority-medium-bg text-priority-medium-fg",
    iconContainerClassName:
      "bg-priority-medium-bg text-priority-medium-fg ring-1 ring-inset ring-priority-medium-dot/40",
  },
  low: {
    icon: ArrowDown,
    badgeClassName: "bg-priority-low-bg text-priority-low-fg",
    iconContainerClassName:
      "bg-priority-low-bg text-priority-low-fg ring-1 ring-inset ring-priority-low-dot/40",
  },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { icon: Icon, badgeClassName } = PRIORITY_CONFIG[priority];

  return (
    <span
      className={`badge-animated inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClassName}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}

export function PriorityIcon({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const { iconContainerClassName } = PRIORITY_CONFIG[priority];

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
          <Flag className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        Приоритет: {TASK_PRIORITY_LABELS[priority]}
      </TooltipContent>
    </Tooltip>
  );
}
