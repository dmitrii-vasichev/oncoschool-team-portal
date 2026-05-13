"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Building2, ListChecks, Loader2, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useToast } from "@/components/shared/Toast";
import { IDEA_DEPARTMENT_STATUS_LABELS } from "@/lib/ideaUtils";
import { api } from "@/lib/api";
import type {
  Department,
  Idea,
  IdeaDepartmentStatus,
  IdeaTaskLink,
  TeamMember,
} from "@/lib/types";

const DEPARTMENT_ACTION_STATUSES: IdeaDepartmentStatus[] = [
  "in_progress",
  "ready",
  "not_required",
];

const SELECT_CLASS =
  "h-8 min-w-0 rounded-md border border-border/70 bg-background px-2 text-xs text-foreground outline-none transition-colors hover:border-primary/30 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";

function DepartmentTaskLinks({ links }: { links: IdeaTaskLink[] }) {
  if (links.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
        Задачи отдела ещё не созданы
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {links.map((link) => {
        if (link.hidden || !link.task) {
          return (
            <div
              key={link.id}
              className="flex items-center gap-2 rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-2 text-xs text-muted-foreground"
            >
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>Задача скрыта настройками доступа</span>
            </div>
          );
        }

        return (
          <Link
            key={link.id}
            href={`/tasks/${link.task.short_id}`}
            className="group flex min-w-0 items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-xs transition-colors hover:border-primary/25 hover:bg-muted/25"
          >
            <span className="min-w-0 truncate">
              #{link.task.short_id} {link.task.title}
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
          </Link>
        );
      })}
    </div>
  );
}

export function IdeaDepartmentPanel({
  idea,
  onUpdated,
  departments,
  members,
  onCreateTask,
}: {
  idea: Idea;
  onUpdated: (idea: Idea) => void;
  departments: Department[];
  members: TeamMember[];
  onCreateTask: (ideaDepartmentId: string) => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [savingByDepartment, setSavingByDepartment] = useState<
    Partial<Record<string, IdeaDepartmentStatus>>
  >({});
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [addingDepartment, setAddingDepartment] = useState(false);

  const canManageImplementation = idea.status === "accepted" || idea.status === "in_tasks";
  const linkedDepartmentIds = new Set(
    idea.departments.map((department) => department.department_id),
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
      const updated = await api.addIdeaDepartment(idea.id, {
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
    ideaDepartmentId: string,
    status: IdeaDepartmentStatus,
  ) {
    setSavingByDepartment((current) => ({
      ...current,
      [ideaDepartmentId]: status,
    }));
    try {
      const updated = await api.updateIdeaDepartment(idea.id, ideaDepartmentId, {
        status,
      });
      onUpdated(updated);
      toastSuccess("Статус отдела обновлён");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось обновить отдел");
    } finally {
      setSavingByDepartment((current) => {
        const next = { ...current };
        delete next[ideaDepartmentId];
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
              {idea.ready_department_count}/{idea.required_department_count} готово
            </p>
          </div>
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        {canManageImplementation && (
          <div className="grid gap-2 rounded-md border border-dashed border-border/70 bg-muted/10 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select
              value={newDepartmentId || "none"}
              onChange={(event) =>
                setNewDepartmentId(event.target.value === "none" ? "" : event.target.value)
              }
              className={SELECT_CLASS}
              disabled={addingDepartment || availableDepartments.length === 0}
            >
              <option value="none">
                {availableDepartments.length === 0 ? "Все отделы добавлены" : "Добавить отдел"}
              </option>
              {availableDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <select
              value={newOwnerId || "none"}
              onChange={(event) =>
                setNewOwnerId(event.target.value === "none" ? "" : event.target.value)
              }
              className={SELECT_CLASS}
              disabled={addingDepartment || activeMembers.length === 0}
            >
              <option value="none">Владелец отдела</option>
              {activeMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={addingDepartment || !newDepartmentId || !newOwnerId}
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
        )}

        {idea.departments.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            Отделы не назначены
          </div>
        ) : (
          idea.departments.map((department) => {
            const ownerName = department.owner?.full_name || "Владелец не указан";
            const savingStatus = savingByDepartment[department.id];

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
                        {IDEA_DEPARTMENT_STATUS_LABELS[department.status]}
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
                      {department.task_links.length} задач
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canManageImplementation}
                      onClick={() => onCreateTask(department.id)}
                      className="h-7 rounded-md px-2 text-2xs"
                    >
                      <Plus className="h-3 w-3" />
                      Задача
                    </Button>
                    <div className="flex flex-wrap gap-1.5 sm:justify-end">
                      {DEPARTMENT_ACTION_STATUSES.map((status) => {
                        const isSaving = savingStatus === status;
                        const isDisabled =
                          !canManageImplementation ||
                          Boolean(savingStatus) ||
                          department.status === status;

                        return (
                          <Button
                            key={status}
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isDisabled}
                            onClick={() => handleDepartmentStatusChange(department.id, status)}
                            className="h-7 rounded-md px-2 text-2xs"
                          >
                            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                            {IDEA_DEPARTMENT_STATUS_LABELS[status]}
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
