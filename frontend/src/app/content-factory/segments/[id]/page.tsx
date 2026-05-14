"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, RefreshCw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { ContentFactorySegmentRefreshDialog } from "@/components/content-factory/ContentFactorySegmentRefreshDialog";
import { ContentFactorySegmentSnapshotList } from "@/components/content-factory/ContentFactorySegmentSnapshotList";
import { usePageTitle } from "@/hooks/usePageTitle";
import { api } from "@/lib/api";
import {
  CF_SEGMENT_SOURCE_LABELS,
  formatContentFactorySegmentCount,
  getContentFactoryDisplayName,
} from "@/lib/contentFactoryUtils";
import type { CFExternalSegment, CFSegmentSnapshot, TeamMember } from "@/lib/types";

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

function SegmentDetailLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-36 rounded-md" />
      <Skeleton className="h-36 rounded-lg" />
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}

export default function ContentFactorySegmentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toastError } = useToast();
  const { setPageTitle } = usePageTitle();
  const [segment, setSegment] = useState<CFExternalSegment | null>(null);
  const [snapshots, setSnapshots] = useState<CFSegmentSnapshot[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [segmentRes, snapshotRes, memberRes] = await Promise.all([
        api.getCFSegment(id),
        api.getCFSegmentSnapshots(id).catch(() => [] as CFSegmentSnapshot[]),
        api.getTeam().catch(() => [] as TeamMember[]),
      ]);
      if (!isLatestRequest()) return;
      setSegment(segmentRes);
      setSnapshots(snapshotRes);
      setMembers(memberRes);
    } catch (err) {
      if (isLatestRequest()) {
        toastError(
          err instanceof Error ? err.message : "Не удалось загрузить сегмент",
        );
        setSegment(null);
      }
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (segment) setPageTitle(segment.name);
    return () => setPageTitle(null);
  }, [segment, setPageTitle]);

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.full_name])),
    [members],
  );

  async function handleRefreshed() {
    await fetchData();
  }

  if (loading) {
    return <SegmentDetailLoadingSkeleton />;
  }

  if (!segment) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
        <Users className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-sm font-semibold text-foreground">
          Segment not found
        </h1>
        <Link
          href="/content-factory/segments"
          className="mt-2 inline-flex text-sm text-primary hover:underline"
        >
          Back to segments
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Link
            href="/content-factory/segments"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Segments
          </Link>
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold leading-7 text-foreground">
                  {segment.name}
                </h1>
                <Badge variant="outline">
                  {CF_SEGMENT_SOURCE_LABELS[segment.source]}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    segment.is_active
                      ? "border-status-done-fg/30 bg-status-done-bg text-status-done-fg"
                      : "border-muted-foreground/20 bg-muted text-muted-foreground"
                  }
                >
                  {segment.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {segment.description?.trim() || "Description is empty"}
              </p>
            </div>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 rounded-md px-3 text-xs"
          onClick={() => setRefreshOpen(true)}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh population
        </Button>
      </div>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <span className="block text-2xs uppercase text-muted-foreground">
              Population
            </span>
            <span className="text-sm font-semibold text-foreground">
              {formatContentFactorySegmentCount(segment.population_count)}
            </span>
          </div>
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <span className="block text-2xs uppercase text-muted-foreground">
              Source ID
            </span>
            <span className="text-sm font-semibold text-foreground">
              {segment.source_segment_id}
            </span>
          </div>
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <span className="block text-2xs uppercase text-muted-foreground">
              Owner
            </span>
            <span className="text-sm font-semibold text-foreground">
              {memberNames.get(segment.owner_id ?? "") ??
                getContentFactoryDisplayName(segment.owner_id, [])}
            </span>
          </div>
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <span className="block text-2xs uppercase text-muted-foreground">
              Last refresh
            </span>
            <span className="text-sm font-semibold text-foreground">
              {formatDateTime(segment.last_fetched_at ?? segment.updated_at)}
            </span>
          </div>
        </div>

        {segment.source_url && (
          <a
            href={segment.source_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Open source segment
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </section>

      <ContentFactorySegmentSnapshotList snapshots={snapshots} />

      <ContentFactorySegmentRefreshDialog
        open={refreshOpen}
        onOpenChange={setRefreshOpen}
        segment={segment}
        onRefreshed={handleRefreshed}
      />
    </div>
  );
}
