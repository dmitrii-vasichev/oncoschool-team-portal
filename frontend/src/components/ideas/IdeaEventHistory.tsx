"use client";

import { Activity } from "lucide-react";
import { parseUTCDate } from "@/lib/dateUtils";
import type { IdeaEvent } from "@/lib/types";

function formatEventDate(value: string): string {
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

export function IdeaEventHistory({ events }: { events: IdeaEvent[] }) {
  return (
    <section className="rounded-lg border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">История</h2>
            <p className="text-xs text-muted-foreground">{events.length} событий</p>
          </div>
          <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        {events.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            Событий пока нет
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="rounded-md border border-border/60 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="break-all text-sm font-medium text-foreground">
                  {event.event_type}
                </p>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {formatEventDate(event.created_at)}
                </p>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {event.actor?.full_name || "Системное событие"}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
