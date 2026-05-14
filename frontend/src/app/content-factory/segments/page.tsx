"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { ContentFactorySegmentDialog } from "@/components/content-factory/ContentFactorySegmentDialog";
import { ContentFactorySegmentRefreshDialog } from "@/components/content-factory/ContentFactorySegmentRefreshDialog";
import { api } from "@/lib/api";
import {
  CF_SEGMENT_SOURCE_LABELS,
  filterContentFactorySegments,
  formatContentFactorySegmentCount,
  getContentFactoryDisplayName,
  summarizeContentFactorySegments,
} from "@/lib/contentFactoryUtils";
import type { CFExternalSegment, CFSegmentSource, TeamMember } from "@/lib/types";

type ActiveFilter = "all" | "active" | "inactive";
type SourceFilter = "all" | CFSegmentSource;

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "No refresh";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No refresh";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function SegmentsLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-3 w-72 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-28 rounded-lg" />
      <Skeleton className="h-28 rounded-lg" />
    </div>
  );
}

export default function ContentFactorySegmentsPage() {
  const { toastError } = useToast();
  const [segments, setSegments] = useState<CFExternalSegment[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshSegment, setRefreshSegment] = useState<CFExternalSegment | null>(null);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [segmentRes, memberRes] = await Promise.all([
        api.getCFSegments({ only_active: false }),
        api.getTeam().catch(() => [] as TeamMember[]),
      ]);
      if (!isLatestRequest()) return;
      setSegments(segmentRes);
      setMembers(memberRes);
    } catch {
      if (isLatestRequest()) toastError("Не удалось загрузить сегменты");
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSegments = useMemo(
    () =>
      filterContentFactorySegments(segments, {
        search,
        active: activeFilter,
        source: sourceFilter,
      }),
    [activeFilter, search, segments, sourceFilter],
  );
  const summary = useMemo(() => summarizeContentFactorySegments(segments), [segments]);
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.full_name])),
    [members],
  );

  async function handleChanged() {
    await fetchData();
  }

  if (loading) {
    return <SegmentsLoadingSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              Segments
            </h1>
            <p className="text-sm text-muted-foreground">
              Audience mirrors, population refreshes, and snapshot history
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
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
          <Button
            type="button"
            size="sm"
            className="h-8 w-full gap-1.5 rounded-md px-3 text-xs sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New segment
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm lg:grid-cols-[1fr_auto]">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or source ID"
              className="h-9 border-border/70 bg-muted/20 pl-8 text-sm"
            />
          </div>
          <Select
            value={activeFilter}
            onValueChange={(value) => setActiveFilter(value as ActiveFilter)}
          >
            <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70] border-border/70 shadow-xl">
              <SelectItem value="all">All states</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sourceFilter}
            onValueChange={(value) => setSourceFilter(value as SourceFilter)}
          >
            <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70] border-border/70 shadow-xl">
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="getcourse">GetCourse</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="self-center text-sm text-muted-foreground">
          {summary.total} total · {summary.active} active · {summary.inactive} inactive ·{" "}
          {formatContentFactorySegmentCount(summary.population)} people
        </p>
      </div>

      {filteredSegments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            No segments found
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a known external segment ID or adjust the filters.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSegments.map((segment) => (
            <div
              key={segment.id}
              className="rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/20"
            >
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <Link
                  href={`/content-factory/segments/${segment.id}`}
                  className="min-w-0 flex-1 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
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
                    <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {segment.source_segment_id}
                    </code>
                  </div>
                  <h2 className="truncate text-sm font-semibold text-foreground">
                    {segment.name}
                  </h2>
                  <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {segment.description?.trim() || "Description is empty"}
                  </p>
                </Link>

                <div className="grid shrink-0 gap-2 text-xs text-muted-foreground sm:grid-cols-3 lg:w-[500px]">
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase">Population</span>
                    <span className="font-medium text-foreground">
                      {formatContentFactorySegmentCount(segment.population_count)}
                    </span>
                  </div>
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase">Owner</span>
                    <span className="font-medium text-foreground">
                      {memberNames.get(segment.owner_id ?? "") ??
                        getContentFactoryDisplayName(segment.owner_id, [])}
                    </span>
                  </div>
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase">Updated</span>
                    <span className="font-medium text-foreground">
                      {formatDateTime(segment.last_fetched_at ?? segment.updated_at)}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
                  onClick={() => setRefreshSegment(segment)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ContentFactorySegmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        onCreated={handleChanged}
      />
      <ContentFactorySegmentRefreshDialog
        open={Boolean(refreshSegment)}
        onOpenChange={(open) => {
          if (!open) setRefreshSegment(null);
        }}
        segment={refreshSegment}
        onRefreshed={handleChanged}
      />
    </div>
  );
}
