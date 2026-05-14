"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { ContentFactorySegmentUsageTable } from "@/components/content-factory/ContentFactorySegmentUsageTable";
import { api } from "@/lib/api";
import {
  CF_SEGMENT_ROLE_LABELS,
  buildContentFactorySegmentUsageRows,
  filterContentFactorySegmentUsageRows,
  summarizeContentFactorySegmentUsage,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFExternalSegment,
  CFMetricSnapshot,
  CFPublication,
  CFPublicationSegmentTarget,
  CFSegmentRole,
} from "@/lib/types";

type UsageFilter = "all" | "used" | "unused";
type RoleFilter = "all" | CFSegmentRole;

function AnalyticsLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44 rounded-md" />
          <Skeleton className="h-3 w-80 rounded-md" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-36 rounded-lg" />
      <Skeleton className="h-36 rounded-lg" />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-3 py-3 shadow-sm">
      <span className="block text-2xs uppercase text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block text-xl font-semibold text-foreground">
        {value}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{helper}</span>
    </div>
  );
}

async function mapWithConcurrency<TItem, TResult>(
  items: TItem[],
  limit: number,
  mapper: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    }),
  );

  return results;
}

export default function ContentFactorySegmentAnalyticsPage() {
  const { toastError } = useToast();
  const [segments, setSegments] = useState<CFExternalSegment[]>([]);
  const [publications, setPublications] = useState<CFPublication[]>([]);
  const [bundles, setBundles] = useState<CFBundle[]>([]);
  const [segmentTargetsByPublicationId, setSegmentTargetsByPublicationId] =
    useState<Record<string, CFPublicationSegmentTarget[]>>({});
  const [metricsByPublicationId, setMetricsByPublicationId] =
    useState<Record<string, CFMetricSnapshot[]>>({});
  const [search, setSearch] = useState("");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [partialEvidence, setPartialEvidence] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    setPartialEvidence(false);
    try {
      const [segmentRes, publicationRes, bundleRes] = await Promise.all([
        api.getCFSegments({ only_active: false }),
        api.getCFPublications({ limit: 500 }),
        api.getCFBundles({ limit: 500 }),
      ]);

      let secondaryFailed = false;
      const [targetEntries, metricEntries] = await Promise.all([
        mapWithConcurrency(
          publicationRes,
          8,
          async (publication) => {
            try {
              const targets = await api.getCFPublicationSegmentTargets(
                publication.id,
              );
              return [publication.id, targets] as const;
            } catch {
              secondaryFailed = true;
              return [publication.id, [] as CFPublicationSegmentTarget[]] as const;
            }
          },
        ),
        mapWithConcurrency(
          publicationRes,
          8,
          async (publication) => {
            try {
              const metrics = await api.getCFMetrics(publication.id);
              return [publication.id, metrics] as const;
            } catch {
              secondaryFailed = true;
              return [publication.id, [] as CFMetricSnapshot[]] as const;
            }
          },
        ),
      ]);

      if (!isLatestRequest()) return;
      setSegments(segmentRes);
      setPublications(publicationRes);
      setBundles(bundleRes);
      setSegmentTargetsByPublicationId(Object.fromEntries(targetEntries));
      setMetricsByPublicationId(Object.fromEntries(metricEntries));
      setPartialEvidence(secondaryFailed);
      if (secondaryFailed) {
        toastError("Часть segment analytics evidence не удалось загрузить");
      }
    } catch (err) {
      if (!isLatestRequest()) return;
      toastError(
        err instanceof Error
          ? err.message
          : "Не удалось загрузить аналитику сегментов",
      );
      setSegments([]);
      setPublications([]);
      setBundles([]);
      setSegmentTargetsByPublicationId({});
      setMetricsByPublicationId({});
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows = useMemo(
    () =>
      buildContentFactorySegmentUsageRows({
        segments,
        publications,
        bundles,
        segmentTargetsByPublicationId,
        metricsByPublicationId,
      }),
    [
      bundles,
      metricsByPublicationId,
      publications,
      segmentTargetsByPublicationId,
      segments,
    ],
  );

  const summary = useMemo(
    () => summarizeContentFactorySegmentUsage(rows),
    [rows],
  );

  const filteredRows = useMemo(
    () =>
      filterContentFactorySegmentUsageRows(rows, {
        search,
        usage: usageFilter,
        role: roleFilter,
      }),
    [roleFilter, rows, search, usageFilter],
  );

  if (loading) {
    return <AnalyticsLoadingSkeleton />;
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
              <BarChart3 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-7 text-foreground">
                Segment usage analytics
              </h1>
              <p className="text-sm text-muted-foreground">
                Publication links, bundle context, role mix, and manual metric evidence
              </p>
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-full gap-1.5 px-2.5 text-xs sm:w-auto"
          onClick={() => void fetchData()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Обновить
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <SummaryCard
          label="In use"
          value={summary.segmentsInUse}
          helper={`${summary.totalSegments} total segments`}
        />
        <SummaryCard
          label="Unused active"
          value={summary.unusedActiveSegments}
          helper="active with no targets"
        />
        <SummaryCard
          label="Target links"
          value={summary.totalTargetLinks}
          helper="publication segment rows"
        />
        <SummaryCard
          label="Published"
          value={summary.publishedPublications}
          helper="unique publications"
        />
        <SummaryCard
          label="Metric evidence"
          value={summary.metricEvidenceCount}
          helper={partialEvidence ? "partial load" : "manual snapshots"}
        />
      </div>

      <div className="grid gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm lg:grid-cols-[1fr_auto]">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search segments, source IDs, publications"
              className="h-9 border-border/70 bg-muted/20 pl-8 text-sm"
            />
          </div>
          <Select
            value={usageFilter}
            onValueChange={(value) => setUsageFilter(value as UsageFilter)}
          >
            <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70] border-border/70 shadow-xl">
              <SelectItem value="all">All usage</SelectItem>
              <SelectItem value="used">Used</SelectItem>
              <SelectItem value="unused">Unused</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as RoleFilter)}
          >
            <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70] border-border/70 shadow-xl">
              <SelectItem value="all">All roles</SelectItem>
              {Object.entries(CF_SEGMENT_ROLE_LABELS).map(([role, label]) => (
                <SelectItem key={role} value={role}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="self-center text-sm text-muted-foreground">
          {filteredRows.length} rows shown
        </p>
      </div>

      <ContentFactorySegmentUsageTable rows={filteredRows} />
    </div>
  );
}
