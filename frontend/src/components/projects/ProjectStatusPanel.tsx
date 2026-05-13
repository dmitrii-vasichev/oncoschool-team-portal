"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/Toast";
import { PROJECT_STATUS_LABELS } from "@/lib/projectUtils";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/lib/types";

const PROJECT_STATUS_ACTIONS: ProjectStatus[] = [
  "planned",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
];

const CURRENT_STATUS_CLASSES: Record<ProjectStatus, string> = {
  planned: "border-border/80 bg-muted text-foreground",
  in_progress:
    "border-status-progress-ring bg-status-progress-bg text-status-progress-fg",
  paused: "border-status-review-ring bg-status-review-bg/70 text-status-review-fg",
  completed: "border-status-done-ring bg-status-done-bg text-status-done-fg",
  cancelled:
    "border-status-cancelled-ring bg-status-cancelled-bg text-status-cancelled-fg",
};

export function ProjectStatusPanel({
  project,
  onUpdated,
}: {
  project: Project;
  onUpdated: (project: Project) => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [savingStatus, setSavingStatus] = useState<ProjectStatus | null>(null);

  async function handleStatusChange(status: ProjectStatus) {
    setSavingStatus(status);
    try {
      const updated = await api.changeProjectStatus(project.id, { status });
      onUpdated(updated);
      toastSuccess("Статус проекта обновлён");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось обновить статус");
    } finally {
      setSavingStatus(null);
    }
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Статус</h2>
            <p className="text-xs text-muted-foreground">
              Текущее состояние: {PROJECT_STATUS_LABELS[project.status]}
            </p>
          </div>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {PROJECT_STATUS_ACTIONS.map((status) => {
            const isCompletedBlocked = status === "completed" && !project.can_complete;
            const isCurrent = project.status === status;
            const isSaving = savingStatus === status;
            const isDisabled = savingStatus !== null || isCurrent || isCompletedBlocked;

            return (
              <Button
                key={status}
                type="button"
                size="sm"
                variant="outline"
                disabled={isDisabled}
                onClick={() => handleStatusChange(status)}
                className={cn(
                  "h-8 rounded-md px-3 text-xs",
                  isCurrent && CURRENT_STATUS_CLASSES[status],
                  status === "cancelled" &&
                    !isCurrent &&
                    "border-status-cancelled-ring/70 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
                title={
                  isCompletedBlocked
                    ? "Нельзя завершить: не все условия проекта выполнены"
                    : undefined
                }
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {PROJECT_STATUS_LABELS[status]}
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
