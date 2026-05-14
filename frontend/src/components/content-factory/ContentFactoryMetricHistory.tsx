"use client";

import { useMemo, useState } from "react";
import { Activity, Clock3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentFactoryMetricDialog } from "@/components/content-factory/ContentFactoryMetricDialog";
import { formatContentFactoryMetricValue } from "@/lib/contentFactoryUtils";
import type { CFMetricSnapshot, TeamMember } from "@/lib/types";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Без даты";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ContentFactoryMetricHistory({
  publicationId,
  metrics,
  members,
  onRecorded,
}: {
  publicationId: string;
  metrics: CFMetricSnapshot[];
  members: TeamMember[];
  onRecorded: () => void | Promise<void>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.full_name])),
    [members],
  );
  const sortedMetrics = useMemo(
    () =>
      [...metrics].sort(
        (left, right) =>
          new Date(right.captured_at).getTime() -
          new Date(left.captured_at).getTime(),
      ),
    [metrics],
  );

  return (
    <section className="rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Metrics</h2>
          <span className="text-xs text-muted-foreground">{metrics.length}</span>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 rounded-md px-3 text-xs"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add metric
        </Button>
      </div>

      {sortedMetrics.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Ручных метрик пока нет.
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {sortedMetrics.map((metric) => (
            <div key={metric.id} className="px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {metric.metric_name}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {metric.window} · {metric.source} · confidence {metric.confidence}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-foreground">
                  {formatContentFactoryMetricValue(metric)}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatDateTime(metric.captured_at)}
                </span>
                <span>
                  {metric.captured_by_id
                    ? memberNames.get(metric.captured_by_id) ?? "Автор"
                    : "System"}
                </span>
                {metric.source_method && <span>{metric.source_method}</span>}
              </div>
              {metric.note && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {metric.note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <ContentFactoryMetricDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        publicationId={publicationId}
        onRecorded={onRecorded}
      />
    </section>
  );
}
