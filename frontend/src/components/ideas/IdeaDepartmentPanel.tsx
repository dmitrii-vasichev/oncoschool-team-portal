"use client";

import { Building2 } from "lucide-react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { IDEA_DEPARTMENT_STATUS_LABELS } from "@/lib/ideaUtils";
import type { Idea } from "@/lib/types";

export function IdeaDepartmentPanel({ idea }: { idea: Idea }) {
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
        {idea.departments.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            Отделы не назначены
          </div>
        ) : (
          idea.departments.map((department) => {
            const ownerName = department.owner?.full_name || "Владелец не указан";

            return (
              <div
                key={department.id}
                className="grid gap-2 rounded-md border border-border/60 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
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
                <p className="text-xs font-medium text-muted-foreground">
                  {department.task_links.length} задач
                </p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
