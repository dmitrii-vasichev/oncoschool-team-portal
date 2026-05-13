"use client";

import { Activity } from "lucide-react";
import { parseUTCDate } from "@/lib/dateUtils";
import { formatProjectEvent } from "@/lib/projectEventUtils";
import type { ProjectEvent } from "@/lib/types";

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

function formatEventCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} событие`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} события`;
  }
  return `${count} событий`;
}

export function ProjectEventHistory({ events }: { events: ProjectEvent[] }) {
  return (
    <section className="rounded-lg border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">История</h2>
            <p className="text-xs text-muted-foreground">{formatEventCount(events.length)}</p>
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
          events.map((event) => {
            const formattedEvent = formatProjectEvent(event);

            return (
              <div
                key={event.id}
                className="rounded-md border border-border/60 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-sm font-medium text-foreground">
                    {formattedEvent.title}
                  </p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatEventDate(event.created_at)}
                  </p>
                </div>
                {formattedEvent.detail ? (
                  <p className="mt-1 break-words text-xs leading-5 text-foreground/80">
                    {formattedEvent.detail}
                  </p>
                ) : null}
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {event.actor?.full_name || "Системное событие"}
                </p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
