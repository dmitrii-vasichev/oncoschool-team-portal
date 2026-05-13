"use client";

import Link from "next/link";
import { ArrowUpRight, ListChecks } from "lucide-react";
import type { Project, ProjectTaskLink } from "@/lib/types";

function formatHiddenTaskCount(count: number): string {
  if (count === 1) return "1 задача скрыта настройками доступа";
  if (count >= 2 && count <= 4) return `${count} задачи скрыты настройками доступа`;
  return `${count} задач скрыто настройками доступа`;
}

function getVisibleLinks(project: Project): ProjectTaskLink[] {
  return [
    ...project.task_links,
    ...project.departments.flatMap((department) => department.task_links),
  ].filter((link) => !link.hidden && Boolean(link.task));
}

export function ProjectLinkedTasks({ project }: { project: Project }) {
  const visibleLinks = getVisibleLinks(project);

  return (
    <section className="rounded-lg border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Связанные задачи</h2>
            <p className="text-xs text-muted-foreground">
              {visibleLinks.length} доступно
            </p>
          </div>
          <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        {visibleLinks.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            Доступных связанных задач пока нет
          </div>
        ) : (
          visibleLinks.map((link) => (
            <Link
              key={link.id}
              href={`/tasks/${link.task!.short_id}`}
              className="group flex min-w-0 items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 transition-colors hover:border-primary/25 hover:bg-muted/25"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  #{link.task!.short_id}
                </p>
                <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                  {link.task!.title}
                </p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
          ))
        )}

        {project.hidden_linked_task_count > 0 ? (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-2 text-sm text-muted-foreground">
            {formatHiddenTaskCount(project.hidden_linked_task_count)}
          </div>
        ) : null}
      </div>
    </section>
  );
}
