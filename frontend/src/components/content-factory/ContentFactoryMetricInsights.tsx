"use client";

import { Activity, BarChart3, CheckCircle2, CircleDashed } from "lucide-react";
import {
  CF_CONFIDENCE_LABELS,
  CF_METRIC_SOURCE_LABELS,
  CF_METRIC_WINDOW_LABELS,
  getContentFactoryPublicationMetricInsights,
} from "@/lib/contentFactoryUtils";
import type { CFMetricSnapshot } from "@/lib/types";

function InsightStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 border-t border-border/60 py-2 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0 sm:px-3 sm:py-0">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

export function ContentFactoryMetricInsights({
  metrics,
}: {
  metrics: CFMetricSnapshot[];
}) {
  const insights = getContentFactoryPublicationMetricInsights(metrics);

  return (
    <section className="rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <BarChart3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Сводка метрик
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Последние значения, лучшие числовые результаты и покрытие срезов.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="grid gap-0 rounded-md border border-border/70 bg-muted/10 px-3 py-2 sm:grid-cols-4">
          <InsightStat label="Всего" value={insights.totalMetrics} />
          <InsightStat label="Названий" value={insights.uniqueMetricNames} />
          <InsightStat label="Последняя" value={insights.latestMetricLabel} />
          <InsightStat label="Дальше" value={insights.nextAction} />
        </div>

        {insights.groups.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-border/70 bg-muted/10 px-3 py-6 text-center">
            <Activity className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">
              Метрик пока нет
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Добавьте метрику вручную или импортируйте строки из отчёта.
            </p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-border/60 rounded-md border border-border/70">
            {insights.groups.map((group) => (
              <div
                key={group.metricName}
                className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_180px_180px]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {group.metricName}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {group.count} записей ·{" "}
                    {CF_METRIC_WINDOW_LABELS[group.latestMetric.window]} ·{" "}
                    {CF_METRIC_SOURCE_LABELS[group.latestMetric.source]} · доверие:{" "}
                    {CF_CONFIDENCE_LABELS[
                      group.latestMetric.confidence
                    ].toLowerCase()}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase text-muted-foreground">
                    Последнее
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {group.latestValueLabel}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs uppercase text-muted-foreground">
                    Лучшее число
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {group.bestNumericValueLabel ?? "Нет числового значения"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {insights.windows.map((window) => (
            <span
              key={window.window}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${
                window.covered
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border bg-muted/20 text-muted-foreground"
              }`}
            >
              {window.covered ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <CircleDashed className="h-3.5 w-3.5" />
              )}
              {window.label}: {window.covered ? "Есть данные" : "Нет данных"}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
