import { type TaskPriority, TASK_PRIORITY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CircleHelp,
  AlertTriangle,
  ArrowUp,
  Minus,
  ArrowDown,
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
      "bg-priority-urgent-bg text-priority-urgent-fg ring-1 ring-inset ring-priority-urgent-dot/70 shadow-[0_0_0_1px_hsl(var(--priority-urgent-dot)/0.24)_inset]",
  },
  high: {
    icon: ArrowUp,
    badgeClassName: "bg-priority-high-bg text-priority-high-fg",
    iconContainerClassName:
      "bg-priority-high-bg text-priority-high-fg ring-1 ring-inset ring-priority-high-dot/70 shadow-[0_0_0_1px_hsl(var(--priority-high-dot)/0.24)_inset]",
  },
  medium: {
    icon: Minus,
    badgeClassName: "bg-priority-medium-bg text-priority-medium-fg",
    iconContainerClassName:
      "bg-priority-medium-bg text-priority-medium-fg ring-1 ring-inset ring-priority-medium-dot/70 shadow-[0_0_0_1px_hsl(var(--priority-medium-dot)/0.24)_inset]",
  },
  low: {
    icon: ArrowDown,
    badgeClassName: "bg-priority-low-bg text-priority-low-fg",
    iconContainerClassName:
      "bg-priority-low-bg text-priority-low-fg ring-1 ring-inset ring-priority-low-dot/70 shadow-[0_0_0_1px_hsl(var(--priority-low-dot)/0.2)_inset]",
  },
};

const UNKNOWN_PRIORITY_CONFIG = {
  icon: CircleHelp,
  badgeClassName: "bg-muted text-muted-foreground",
  iconContainerClassName:
    "bg-muted text-muted-foreground ring-1 ring-inset ring-border/70",
};

function resolvePriority(
  priority: TaskPriority | string | null | undefined
): TaskPriority | null {
  if (!priority) return null;
  return Object.prototype.hasOwnProperty.call(PRIORITY_CONFIG, priority)
    ? (priority as TaskPriority)
    : null;
}

export function PriorityBadge({
  priority,
}: {
  priority: TaskPriority | string | null | undefined;
}) {
  const resolvedPriority = resolvePriority(priority);
  const { icon: Icon, badgeClassName } = resolvedPriority
    ? PRIORITY_CONFIG[resolvedPriority]
    : UNKNOWN_PRIORITY_CONFIG;
  const label = resolvedPriority
    ? TASK_PRIORITY_LABELS[resolvedPriority]
    : "Неизвестный";

  return (
    <span
      className={`badge-animated inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badgeClassName}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}

export function PriorityIcon({
  priority,
  className,
}: {
  priority: TaskPriority | string | null | undefined;
  className?: string;
}) {
  const resolvedPriority = resolvePriority(priority);
  const { icon: Icon, iconContainerClassName } = resolvedPriority
    ? PRIORITY_CONFIG[resolvedPriority]
    : UNKNOWN_PRIORITY_CONFIG;
  const label = resolvedPriority
    ? TASK_PRIORITY_LABELS[resolvedPriority]
    : "Неизвестный";

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
          <Icon className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        Приоритет: {label}
      </TooltipContent>
    </Tooltip>
  );
}
