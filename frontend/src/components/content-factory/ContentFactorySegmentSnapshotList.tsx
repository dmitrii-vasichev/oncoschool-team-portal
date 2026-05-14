"use client";

import { TrendingDown, TrendingUp, Users } from "lucide-react";
import {
  compareContentFactorySegmentSnapshots,
  formatContentFactorySegmentCount,
} from "@/lib/contentFactoryUtils";
import type { CFSegmentSnapshot } from "@/lib/types";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDelta(value: number | null): string {
  if (value === null) return "No comparison";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatContentFactorySegmentCount(value)}`;
}

function formatDeltaPercent(value: number | null): string {
  if (value === null) return "";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

export function ContentFactorySegmentSnapshotList({
  snapshots,
}: {
  snapshots: CFSegmentSnapshot[];
}) {
  const comparison = compareContentFactorySegmentSnapshots(snapshots);
  const sortedSnapshots = [...snapshots].sort(
    (left, right) =>
      new Date(right.fetched_at).getTime() - new Date(left.fetched_at).getTime(),
  );
  const DeltaIcon =
    (comparison.delta ?? 0) >= 0 ? TrendingUp : TrendingDown;

  return (
    <section className="rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Snapshot history
          </h2>
        </div>
      </div>

      <div className="grid gap-3 border-b border-border/60 px-4 py-3 md:grid-cols-3">
        <div className="rounded-md bg-muted/30 px-3 py-2">
          <span className="block text-2xs uppercase text-muted-foreground">
            Latest
          </span>
          <span className="text-sm font-semibold text-foreground">
            {comparison.latest
              ? formatContentFactorySegmentCount(
                  comparison.latest.population_count,
                )
              : "No snapshots"}
          </span>
          {comparison.latest && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {formatDateTime(comparison.latest.fetched_at)}
            </span>
          )}
        </div>
        <div className="rounded-md bg-muted/30 px-3 py-2">
          <span className="block text-2xs uppercase text-muted-foreground">
            Previous
          </span>
          <span className="text-sm font-semibold text-foreground">
            {comparison.previous
              ? formatContentFactorySegmentCount(
                  comparison.previous.population_count,
                )
              : "No comparison"}
          </span>
          {comparison.previous && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {formatDateTime(comparison.previous.fetched_at)}
            </span>
          )}
        </div>
        <div className="rounded-md bg-muted/30 px-3 py-2">
          <span className="block text-2xs uppercase text-muted-foreground">
            Delta
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <DeltaIcon className="h-3.5 w-3.5 text-muted-foreground" />
            {formatDelta(comparison.delta)}
          </span>
          {comparison.deltaPercent !== null && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {formatDeltaPercent(comparison.deltaPercent)}
            </span>
          )}
        </div>
      </div>

      {sortedSnapshots.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No population snapshots yet.
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {sortedSnapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-medium text-foreground">
                {formatContentFactorySegmentCount(snapshot.population_count)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(snapshot.fetched_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
