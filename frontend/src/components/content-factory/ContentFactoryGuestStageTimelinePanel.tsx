"use client";

import { AlertCircle, CalendarClock, CheckCircle2, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  buildContentFactoryGuestStageTimeline,
  type ContentFactoryGuestStageTimelineItem,
} from "@/lib/contentFactoryUtils";
import type { CFGuestStory, CFGuestStoryEvent } from "@/lib/types";

type ContentFactoryGuestStageTimelinePanelProps = {
  story: CFGuestStory;
  events: CFGuestStoryEvent[];
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Срок не назначен";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Срок не назначен";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function TimelineItem({ item }: { item: ContentFactoryGuestStageTimelineItem }) {
  return (
    <li className="relative pl-6">
      <span
        className={
          item.isCurrent
            ? "absolute left-0 top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-primary/15"
            : "absolute left-0 top-1.5 h-3 w-3 rounded-full border border-border bg-background"
        }
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{item.label}</p>
          {item.isCurrent && (
            <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
              Текущий этап
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          С {formatDateTime(item.startedAt)} · {item.durationLabel}
        </p>
      </div>
    </li>
  );
}

export function ContentFactoryGuestStageTimelinePanel({
  story,
  events,
}: ContentFactoryGuestStageTimelinePanelProps) {
  const timeline = buildContentFactoryGuestStageTimeline(story, events);

  return (
    <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <Route className="h-4 w-4 text-primary" />
            Путь истории
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Этапы, через которые прошла история гостя.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-y border-border/70 py-3 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Текущий этап</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {timeline.currentItem.label}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">В этапе</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {timeline.currentDurationLabel}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Следующий шаг</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
            {formatDateTime(timeline.nextStepAt)}
          </p>
        </div>
      </div>

      {timeline.missingNextStep && (
        <div className="mt-3 flex items-start gap-2 text-sm text-amber-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Назначьте следующий шаг, чтобы история не зависла.</p>
        </div>
      )}

      <ol className="mt-4 space-y-4 border-l border-border/70 pl-3">
        {timeline.items.map((item) => (
          <TimelineItem key={item.id} item={item} />
        ))}
      </ol>

      {timeline.items.length === 1 && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
          История пока не меняла этап.
        </p>
      )}
    </section>
  );
}
