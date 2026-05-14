"use client";

import Link from "next/link";
import { Activity, FileText, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContentFactoryStatusBadge } from "@/components/content-factory/ContentFactoryStatusBadge";
import {
  CF_BUNDLE_STATUSES,
  CF_BUNDLE_STATUS_LABELS,
  CF_SEGMENT_ROLE_LABELS,
  CF_SEGMENT_ROLES,
  formatContentFactorySegmentCount,
  type ContentFactorySegmentUsageRow,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFExternalSegment,
  CFMetricSnapshot,
  CFPublication,
  CFPublicationSegmentTarget,
} from "@/lib/types";

type SegmentUsageRow = ContentFactorySegmentUsageRow<
  CFExternalSegment,
  CFPublication,
  CFBundle,
  CFPublicationSegmentTarget,
  CFMetricSnapshot
>;

type ContentFactorySegmentUsageTableProps = {
  rows: SegmentUsageRow[];
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "No activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function publicationTitle(publication: CFPublication): string {
  return publication.title?.trim() || `Publication ${publication.id.slice(0, 8)}`;
}

export function ContentFactorySegmentUsageTable({
  rows,
}: ContentFactorySegmentUsageTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
        <Users className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-sm font-semibold text-foreground">
          No segment usage found
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Adjust filters or add segment targets on publication pages.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const activeRoles = CF_SEGMENT_ROLES.filter(
          (role) => row.roleCounts[role] > 0,
        );
        const activeBundleStatuses = CF_BUNDLE_STATUSES.filter(
          (status) => row.bundleStatusCounts[status] > 0,
        );
        const recentPublications = row.publications.slice(0, 3);

        return (
          <div
            key={row.segment.id}
            className="rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm"
          >
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {formatContentFactorySegmentCount(row.segment.population_count)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      row.segment.is_active
                        ? "border-status-done-fg/30 bg-status-done-bg text-status-done-fg"
                        : "border-muted-foreground/20 bg-muted text-muted-foreground"
                    }
                  >
                    {row.segment.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {row.segment.source_segment_id}
                  </code>
                </div>

                <Link
                  href={`/content-factory/segments/${row.segment.id}`}
                  className="block min-w-0 text-sm font-semibold text-foreground hover:text-primary"
                >
                  <span className="line-clamp-2">{row.segment.name}</span>
                </Link>

                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase text-muted-foreground">
                      Publications
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {row.publicationCount}
                    </span>
                  </div>
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase text-muted-foreground">
                      Bundles
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {row.bundleCount}
                    </span>
                  </div>
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase text-muted-foreground">
                      Published
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {row.publishedPublicationCount}
                    </span>
                  </div>
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase text-muted-foreground">
                      Metrics
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {row.metricEvidenceCount}
                    </span>
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="min-w-0 rounded-md bg-muted/30 px-3 py-2">
                    <span className="block text-2xs uppercase text-muted-foreground">
                      Roles
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {activeRoles.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No links</span>
                      ) : (
                        activeRoles.map((role) => (
                          <Badge key={role} variant="outline" className="max-w-full">
                            {CF_SEGMENT_ROLE_LABELS[role]} · {row.roleCounts[role]}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-md bg-muted/30 px-3 py-2">
                    <span className="block text-2xs uppercase text-muted-foreground">
                      Bundle states
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {activeBundleStatuses.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          No bundles
                        </span>
                      ) : (
                        activeBundleStatuses.map((status) => (
                          <ContentFactoryStatusBadge
                            key={status}
                            kind="bundle"
                            status={status}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-md bg-muted/30 px-3 py-2">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-2xs uppercase text-muted-foreground">
                      Recent publications
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" />
                      {formatDate(row.latestActivityAt)}
                    </span>
                  </div>

                  {recentPublications.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                      No publication links yet
                    </span>
                  ) : (
                    <div className="space-y-1.5">
                      {recentPublications.map((item) => (
                        <Link
                          key={`${row.segment.id}-${item.publication.id}-${item.target.role}`}
                          href={`/content-factory/publications/${item.publication.id}`}
                          className="flex min-w-0 items-center justify-between gap-3 rounded-md px-2 py-1 text-sm hover:bg-background"
                        >
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                              {publicationTitle(item.publication)}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {CF_BUNDLE_STATUS_LABELS[
                              item.bundle?.status as keyof typeof CF_BUNDLE_STATUS_LABELS
                            ] ?? "No bundle"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
