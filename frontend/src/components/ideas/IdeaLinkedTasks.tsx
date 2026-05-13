"use client";

import Link from "next/link";
import { ArrowUpRight, ListChecks, Lock } from "lucide-react";
import type { IdeaTaskLink } from "@/lib/types";

export function IdeaLinkedTasks({ links }: { links: IdeaTaskLink[] }) {
  return (
    <section className="rounded-lg border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Связанные задачи</h2>
            <p className="text-xs text-muted-foreground">{links.length} связей</p>
          </div>
          <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        {links.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            Связанных задач пока нет
          </div>
        ) : (
          links.map((link) => {
            if (link.hidden || !link.task) {
              return (
                <div
                  key={link.id}
                  className="flex items-center gap-2 rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-2 text-sm text-muted-foreground"
                >
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>Задача скрыта настройками доступа</span>
                </div>
              );
            }

            return (
              <Link
                key={link.id}
                href={`/tasks/${link.task.short_id}`}
                className="group flex min-w-0 items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 transition-colors hover:border-primary/25 hover:bg-muted/25"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    #{link.task.short_id}
                  </p>
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {link.task.title}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
