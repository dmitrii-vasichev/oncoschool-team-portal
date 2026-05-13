"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Building2, ListChecks, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useToast } from "@/components/shared/Toast";
import { PROJECT_DEPARTMENT_STATUS_LABELS } from "@/lib/projectUtils";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  Department,
  Project,
  ProjectDepartmentStatus,
  ProjectTaskLink,
  TeamMember,
} from "@/lib/types";

const DEPARTMENT_ACTION_STATUSES: ProjectDepartmentStatus[] = [
  "in_progress",
  "ready",
  "not_required",
];

const SELECT_TRIGGER_CLASS =
  "h-8 min-w-0 border-border/70 bg-background px-2 text-xs shadow-sm transition-colors hover:border-primary/30 focus:border-primary/40 focus:ring-primary/20";

const CURRENT_DEPARTMENT_STATUS_CLASS: Record<ProjectDepartmentStatus, string> = {
  not_started: "border-border/80 bg-muted text-foreground",
  in_progress:
    "border-status-progress-ring bg-status-progress-bg text-status-progress-fg",
  ready: "border-status-done-ring bg-status-done-bg text-status-done-fg",
  not_required:
    "border-status-cancelled-ring bg-status-cancelled-bg text-status-cancelled-fg",
};

function formatHiddenTaskCount(count: number): string {
  if (count === 1) return "1 задача скрыта настройками доступа";
  if (count >= 2 && count <= 4) return `${count} задачи скрыты настройками доступа`;
  return `${count} задач скрыто настройками доступа`;
}

function DepartmentTaskLinks({ links }: { links: ProjectTaskLink[] }) {
  const visibleLinks = links.filter((link) => !link.hidden && link.task);
  const hiddenCount = links.length - visibleLinks.length;

  if (visibleLinks.length === 0 && hiddenCount === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
        Задачи отдела ещё не созданы
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {visibleLinks.map((link) => (
        <Link
          key={link.id}
          href={`/tasks/${link.task!.short_id}`}
          className="group flex min-w-0 items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-xs transition-colors hover:border-primary/25 hover:bg-muted/25"
        >
          <span className="min-w-0 truncate">
            #{link.task!.short_id} {link.task!.title}
          </span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
        </Link>
      ))}
      {hiddenCount > 0 ? (
        <div className="rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
          {formatHiddenTaskCount(hiddenCount)}
        </div>
      ) : null}
    </div>
  );
}

export function ProjectDepartmentPanel({
  project,
  onUpdated,
  departments,
  members,
  onCreateTask,
}: {
  project: Project;
  onUpdated: (project: Project) => void;
  departments: Department[];
  members: TeamMember[];
  onCreateTask: (projectDepartmentId: string) => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [savingByDepartment, setSavingByDepartment] = useState<
    Partial<Record<string, ProjectDepartmentStatus>>
  >({});
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [addingDepartment, setAddingDepartment] = useState(false);

  const canManageProject = project.status !== "completed" && project.status !== "cancelled";
  const linkedDepartmentIds = new Set(
    project.departments.map((department) => department.department_id),
  );
  const availableDepartments = departments.filter(
    (department) => department.is_active && !linkedDepartmentIds.has(department.id),
  );
  const activeMembers = members.filter((member) => member.is_active);

  async function handleAddDepartment() {
    if (!newDepartmentId) {
      toastError("Выберите отдел");
      return;
    }
    if (!newOwnerId) {
      toastError("Выберите владельца отдела");
      return;
    }

    setAddingDepartment(true);
    try {
      const updated = await api.addProjectDepartment(project.id, {
        department_id: newDepartmentId,
        owner_id: newOwnerId,
      });
      setNewDepartmentId("");
      setNewOwnerId("");
      onUpdated(updated);
      toastSuccess("Отдел добавлен");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось добавить отдел");
    } finally {
      setAddingDepartment(false);
    }
  }

  async function handleDepartmentStatusChange(
    projectDepartmentId: string,
    status: ProjectDepartmentStatus,
  ) {
    setSavingByDepartment((current) => ({
      ...current,
      [projectDepartmentId]: status,
    }));
    try {
      const updated = await api.updateProjectDepartment(project.id, projectDepartmentId, {
        status,
      });
      onUpdated(updated);
      toastSuccess("Статус отдела обновлён");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось обновить отдел");
    } finally {
      setSavingByDepartment((current) => {
        const next = { ...current };
        delete next[projectDepartmentId];
        return next;
      });
    }
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Отделы</h2>
            <p className="text-xs text-muted-foreground">
              {project.ready_department_count}/{project.required_department_count} готово
            </p>
          </div>
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        <div className="grid gap-2 rounded-md border border-dashed border-border/70 bg-muted/10 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Select
            value={newDepartmentId || undefined}
            onValueChange={setNewDepartmentId}
            disabled={
              !canManageProject ||
              addingDepartment ||
              availableDepartments.length === 0
            }
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue
                placeholder={
                  availableDepartments.length === 0
                    ? "Все отделы добавлены"
                    : "Добавить отдел"
                }
              />
            </SelectTrigger>
            <SelectContent className="z-[70] max-h-64 border-border/70 shadow-xl">
              {availableDepartments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={newOwnerId || undefined}
            onValueChange={setNewOwnerId}
            disabled={!canManageProject || addingDepartment || activeMembers.length === 0}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Владелец отдела" />
            </SelectTrigger>
            <SelectContent className="z-[70] max-h-64 border-border/70 shadow-xl">
              {activeMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={
              !canManageProject ||
              addingDepartment ||
              !newDepartmentId ||
              !newOwnerId
            }
            onClick={handleAddDepartment}
            className="h-8 rounded-md px-2 text-xs"
          >
            {addingDepartment ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Добавить
          </Button>
        </div>

        {project.departments.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            Отделы не назначены
          </div>
        ) : (
          project.departments.map((department) => {
            const ownerName = department.owner?.full_name || "Владелец не указан";
            const savingStatus = savingByDepartment[department.id];
            const visibleTaskCount = department.task_links.filter(
              (link) => !link.hidden && link.task,
            ).length;

            return (
              <div
                key={department.id}
                className="rounded-md border border-border/60 px-3 py-2"
              >
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {department.department?.name || "Отдел не указан"}
                      </p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                        {PROJECT_DEPARTMENT_STATUS_LABELS[department.status]}
                      </span>
                    </div>
                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      <UserAvatar
                        name={ownerName}
                        avatarUrl={department.owner?.avatar_url}
                        size="sm"
                      />
                      <p className="truncate text-xs text-muted-foreground">{ownerName}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <p className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <ListChecks className="h-3.5 w-3.5" />
                      {visibleTaskCount} задач
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canManageProject}
                      onClick={() => onCreateTask(department.id)}
                      className="h-7 rounded-md px-2 text-2xs"
                    >
                      <Plus className="h-3 w-3" />
                      Задача
                    </Button>
                    <div className="flex flex-wrap gap-1.5 sm:justify-end">
                      {DEPARTMENT_ACTION_STATUSES.map((status) => {
                        const isSaving = savingStatus === status;
                        const isCurrent = department.status === status;
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
                            onClick={() => handleDepartmentStatusChange(department.id, status)}
                            className={cn(
                              "h-7 rounded-md px-2 text-2xs",
                              isCurrent && CURRENT_DEPARTMENT_STATUS_CLASS[status],
                            )}
                          >
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            {PROJECT_DEPARTMENT_STATUS_LABELS[status]}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <DepartmentTaskLinks links={department.task_links} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
