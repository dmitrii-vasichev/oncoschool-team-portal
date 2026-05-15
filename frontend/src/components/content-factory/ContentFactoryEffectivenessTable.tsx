"use client";

import Link from "next/link";
import { Activity, BarChart3, FileText, FolderKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContentFactoryStatusBadge } from "@/components/content-factory/ContentFactoryStatusBadge";
import {
  CF_CONFIDENCE_LABELS,
  CF_METRIC_SOURCE_LABELS,
  CF_METRIC_WINDOW_LABELS,
  formatContentFactoryMetricValue,
  formatContentFactorySegmentCount,
  type ContentFactoryEffectivenessMetricHealth,
  type ContentFactoryEffectivenessRow,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFFormat,
  CFMetricSnapshot,
  CFPlatform,
  CFPublication,
  CFPublicationSegmentTarget,
} from "@/lib/types";

type EffectivenessRow = ContentFactoryEffectivenessRow<
  CFPublication,
  CFBundle,
  CFPlatform,
  CFFormat,
  CFPublicationSegmentTarget,
  CFMetricSnapshot
>;

type ContentFactoryEffectivenessTableProps = {
  rows: EffectivenessRow[];
};

const METRIC_HEALTH_LABELS: Record<
  ContentFactoryEffectivenessMetricHealth,
  string
> = {
  fresh: "Свежие замеры",
  stale: "Устарели",
  missing: "Нет замеров",
};

const METRIC_HEALTH_CLASSES: Record<
  ContentFactoryEffectivenessMetricHealth,
  string
> = {
  fresh: "border-status-done-fg/30 bg-status-done-bg text-status-done-fg",
  stale: "border-amber-500/25 bg-amber-500/10 text-amber-700",
  missing: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Нет данных";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Нет данных";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function publicationTitle(publication: CFPublication): string {
  return publication.title?.trim() || `Публикация ${publication.id.slice(0, 8)}`;
}

function objectiveLabel(value: string): string {
  if (value === "unknown") return "Цель не указана";
  return value;
}

export function ContentFactoryEffectivenessTable({
  rows,
}: ContentFactoryEffectivenessTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-sm font-semibold text-foreground">
          Публикации не найдены
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Измените фильтры или добавьте ручные замеры на страницах публикаций.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const latestMetric = row.latestMetric;

        return (
          <div
            key={row.publication.id}
            className="rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm"
          >
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <ContentFactoryStatusBadge
                    kind="publication"
                    status={row.publication.status}
                  />
                  <Badge variant="outline">{objectiveLabel(row.objective)}</Badge>
                  <Badge
                    variant="outline"
                    className={METRIC_HEALTH_CLASSES[row.metricHealth]}
                  >
                    {METRIC_HEALTH_LABELS[row.metricHealth]}
                  </Badge>
                </div>

                <Link
                  href={`/content-factory/publications/${row.publication.id}`}
                  className="block min-w-0 text-sm font-semibold text-foreground hover:text-primary"
                >
                  <span className="line-clamp-2">
                    {publicationTitle(row.publication)}
                  </span>
                </Link>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {row.bundle ? (
                    <Link
                      href={`/content-factory/bundles/${row.bundle.id}`}
                      className="inline-flex min-w-0 items-center gap-1.5 hover:text-foreground"
                    >
                      <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{row.bundle.name}</span>
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <FolderKanban className="h-3.5 w-3.5" />
                      Без кампании
                    </span>
                  )}
                  <span>{row.platform?.display_name ?? "Площадка не указана"}</span>
                  <span>{row.format?.display_name ?? "Формат не указан"}</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase text-muted-foreground">
                      Замеры
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {row.metricCount}
                    </span>
                  </div>
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase text-muted-foreground">
                      Ожидали
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatContentFactorySegmentCount(row.targetExpectedCount)}
                    </span>
                  </div>
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase text-muted-foreground">
                      Факт отправки
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatContentFactorySegmentCount(
                        row.targetActualCountAtSend,
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-2 rounded-md bg-muted/30 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs uppercase text-muted-foreground">
                    Последний замер
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                    {formatDateTime(row.latestMetricAt)}
                  </span>
                </div>

                {latestMetric ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{latestMetric.metric_name}</Badge>
                      <Badge variant="outline">
                        {CF_METRIC_WINDOW_LABELS[latestMetric.window]}
                      </Badge>
                      <Badge variant="outline">
                        {CF_METRIC_SOURCE_LABELS[latestMetric.source]}
                      </Badge>
                      <Badge variant="outline">
                        {CF_CONFIDENCE_LABELS[latestMetric.confidence]}
                      </Badge>
                    </div>
                    <div className="text-2xl font-semibold text-foreground">
                      {formatContentFactoryMetricValue(latestMetric)}
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-16 items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    Добавьте первый ручной замер в карточке публикации.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
