"use client";

import Link from "next/link";
import { Lightbulb, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { parseUTCDate } from "@/lib/dateUtils";
import type { Project } from "@/lib/types";

function formatDateTime(value: string): string {
  const parsed = parseUTCDate(value);
  if (Number.isNaN(parsed.getTime())) return "Дата не указана";

  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OwnerLine({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <UserAvatar name={name} avatarUrl={avatarUrl || null} size="sm" />
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase text-muted-foreground">
          Владелец
        </p>
        <p className="truncate text-xs text-foreground">{name}</p>
      </div>
    </div>
  );
}

export function ProjectHeader({
  project,
  deleting,
  onCreateTask,
  onDelete,
}: {
  project: Project;
  deleting: boolean;
  onCreateTask: () => void;
  onDelete: () => void;
}) {
  const ownerName = project.owner?.full_name || "Владелец не указан";
  const canCreateTask = project.status !== "completed" && project.status !== "cancelled";

  return (
    <header className="rounded-lg border border-border/60 bg-card px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <span className="text-xs text-muted-foreground">
              Обновлено {formatDateTime(project.updated_at)}
            </span>
          </div>

          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold leading-7 text-foreground">
              {project.title}
            </h1>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
              {project.description}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <OwnerLine
              name={ownerName}
              avatarUrl={project.owner?.avatar_url}
            />
            {project.source_idea ? (
              <Link
                href={`/ideas/${project.source_idea.id}`}
                className="group flex min-w-0 items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 transition-colors hover:border-primary/25 hover:bg-muted/25"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:text-primary">
                  <Lightbulb className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-2xs font-medium uppercase text-muted-foreground">
                    Исходная идея
                  </p>
                  <p className="truncate text-xs text-foreground group-hover:text-primary">
                    {project.source_idea.title}
                  </p>
                </div>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onCreateTask}
            disabled={!canCreateTask}
            title={
              canCreateTask
                ? undefined
                : "Создание задач недоступно для завершённых и отменённых проектов"
            }
            className="h-9 rounded-md px-3 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Создать задачу
          </Button>
          {project.can_delete ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onDelete}
              disabled={deleting}
              className="h-9 rounded-md border-destructive/30 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить
            </Button>
          ) : null}
          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
            <UserRound className="h-5 w-5" />
          </div>
        </div>
      </div>
    </header>
  );
}
