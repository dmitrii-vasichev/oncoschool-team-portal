"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Flag, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/Toast";
import { formatDateOnly } from "@/lib/dateUtils";
import { PROJECT_MILESTONE_STATUS_LABELS } from "@/lib/projectUtils";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Project, ProjectMilestoneStatus } from "@/lib/types";

const MILESTONE_ACTION_STATUSES: ProjectMilestoneStatus[] = [
  "planned",
  "in_progress",
  "done",
];

const CURRENT_MILESTONE_STATUS_CLASS: Record<ProjectMilestoneStatus, string> = {
  planned: "border-border/80 bg-muted text-foreground",
  in_progress:
    "border-status-progress-ring bg-status-progress-bg text-status-progress-fg",
  done: "border-status-done-ring bg-status-done-bg text-status-done-fg",
};

function formatDueDate(value: string | null): string {
  const formatted = formatDateOnly(value, { includeYear: true });
  return formatted || "Без срока";
}

export function ProjectMilestones({
  project,
  onUpdated,
}: {
  project: Project;
  onUpdated: (project: Project) => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [savingByMilestone, setSavingByMilestone] = useState<
    Partial<Record<string, ProjectMilestoneStatus>>
  >({});

  const canManageProject = project.status !== "completed" && project.status !== "cancelled";
  const sortedMilestones = useMemo(
    () =>
      [...project.milestones].sort((first, second) => {
        if (first.sort_order !== second.sort_order) {
          return first.sort_order - second.sort_order;
        }
        return first.created_at.localeCompare(second.created_at);
      }),
    [project.milestones],
  );

  async function handleAddMilestone(event: FormEvent) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toastError("Введите название этапа");
      return;
    }

    setAdding(true);
    try {
      const updated = await api.addProjectMilestone(project.id, {
        title: trimmedTitle,
        due_date: dueDate || null,
      });
      setTitle("");
      setDueDate("");
      onUpdated(updated);
      toastSuccess("Этап добавлен");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось добавить этап");
    } finally {
      setAdding(false);
    }
  }

  async function handleMilestoneStatusChange(
    milestoneId: string,
    status: ProjectMilestoneStatus,
  ) {
    setSavingByMilestone((current) => ({
      ...current,
      [milestoneId]: status,
    }));
    try {
      const updated = await api.updateProjectMilestone(project.id, milestoneId, {
        status,
      });
      onUpdated(updated);
      toastSuccess("Статус этапа обновлён");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось обновить этап");
    } finally {
      setSavingByMilestone((current) => {
        const next = { ...current };
        delete next[milestoneId];
        return next;
      });
    }
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Этапы</h2>
            <p className="text-xs text-muted-foreground">
              {project.completed_milestone_count}/{project.milestone_count} готово
            </p>
          </div>
          <Flag className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        <form
          onSubmit={handleAddMilestone}
          className="grid gap-2 rounded-md border border-dashed border-border/70 bg-muted/10 p-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Новый этап"
            className="h-8 border-border/70 bg-background text-xs"
            disabled={!canManageProject || adding}
          />
          <DatePicker
            value={dueDate}
            onChange={setDueDate}
            placeholder="Срок"
            clearable
            className="h-8 w-full border-border/70 bg-background text-xs shadow-sm transition-colors hover:border-primary/30 focus:border-primary/40 focus:ring-primary/20"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={!canManageProject || adding || !title.trim()}
            className="h-8 rounded-md px-2 text-xs"
          >
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Добавить
          </Button>
        </form>

        {sortedMilestones.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            Этапы не добавлены
          </div>
        ) : (
          sortedMilestones.map((milestone) => {
            const savingStatus = savingByMilestone[milestone.id];

            return (
              <div
                key={milestone.id}
                className="rounded-md border border-border/60 px-3 py-2"
              >
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-sm font-medium text-foreground">
                        {milestone.title}
                      </p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                        {PROJECT_MILESTONE_STATUS_LABELS[milestone.status]}
                      </span>
                    </div>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDueDate(milestone.due_date)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {MILESTONE_ACTION_STATUSES.map((status) => {
                      const isSaving = savingStatus === status;
                      const isCurrent = milestone.status === status;
                      const isDisabled =
                        !canManageProject ||
                        Boolean(savingStatus) ||
                        isCurrent;

                      return (
                        <Button
                          key={status}
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isDisabled}
                          onClick={() => handleMilestoneStatusChange(milestone.id, status)}
                          className={cn(
                            "h-7 rounded-md px-2 text-2xs",
                            isCurrent && CURRENT_MILESTONE_STATUS_CLASS[status],
                          )}
                        >
                          {isSaving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : null}
                          {PROJECT_MILESTONE_STATUS_LABELS[status]}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
