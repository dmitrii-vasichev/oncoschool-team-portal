"use client";

import type { TaskLabel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { labelClass } from "./taskLabelUtils";

export function TaskLabelChips({
  labels,
  maxVisible = 2,
  className,
}: {
  labels: TaskLabel[];
  maxVisible?: number;
  className?: string;
}) {
  if (!labels.length) return null;

  const visible = labels.slice(0, maxVisible);
  const hiddenCount = labels.length - visible.length;

  return (
    <div className={cn("flex min-w-0 flex-wrap gap-1.5", className)}>
      {visible.map((label) => (
        <span
          key={label.id}
          className={cn(
            "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-2xs font-medium leading-4",
            labelClass(label.color)
          )}
          title={label.name}
        >
          <span className="truncate">{label.name}</span>
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="inline-flex items-center rounded-full border border-border/60 bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
