"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock3, Factory, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import {
  ContentFactoryFilters,
  EMPTY_CONTENT_FACTORY_FILTERS,
  type ContentFactoryFilterValues,
} from "@/components/content-factory/ContentFactoryFilters";
import { ContentFactoryStatusBadge } from "@/components/content-factory/ContentFactoryStatusBadge";
import { api } from "@/lib/api";
import {
  filterContentFactoryPublications,
  groupPublicationsByDate,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFFormat,
  CFPlatform,
  CFPublication,
  TeamMember,
} from "@/lib/types";

function buildNameMap<T extends { id: string }>(
  items: T[],
  getName: (item: T) => string,
): Map<string, string> {
  return new Map(items.map((item) => [item.id, getName(item)]));
}

function formatTime(value: string | null): string {
  if (!value) return "Без времени";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Без времени";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function publicationTitle(publication: CFPublication): string {
  return publication.title?.trim() || "Без названия";
}

function CalendarLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-3 w-64 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-44 rounded-lg" />
      <Skeleton className="h-44 rounded-lg" />
    </div>
  );
}

export default function ContentFactoryCalendarPage() {
  const { toastError } = useToast();
  const [publications, setPublications] = useState<CFPublication[]>([]);
  const [bundles, setBundles] = useState<CFBundle[]>([]);
  const [platforms, setPlatforms] = useState<CFPlatform[]>([]);
  const [formats, setFormats] = useState<CFFormat[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [filters, setFilters] = useState<ContentFactoryFilterValues>(
    EMPTY_CONTENT_FACTORY_FILTERS,
  );
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [publicationRes, bundleRes, platformRes, formatRes, memberRes] =
        await Promise.all([
          api.getCFPublications({ limit: 500 }),
          api.getCFBundles({ limit: 500 }),
          api.getCFPlatforms().catch(() => [] as CFPlatform[]),
          api.getCFFormats().catch(() => [] as CFFormat[]),
          api.getTeam().catch(() => [] as TeamMember[]),
        ]);
      if (!isLatestRequest()) return;
      setPublications(publicationRes);
      setBundles(bundleRes);
      setPlatforms(platformRes);
      setFormats(formatRes);
      setMembers(memberRes);
    } catch {
      if (isLatestRequest()) {
        toastError("Не удалось загрузить календарь Content Factory");
      }
    } finally {
      if (isLatestRequest()) {
        setLoading(false);
      }
    }
  }, [toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const bundleNames = useMemo(
    () => buildNameMap(bundles, (bundle) => bundle.name),
    [bundles],
  );
  const platformNames = useMemo(
    () => buildNameMap(platforms, (platform) => platform.display_name),
    [platforms],
  );
  const formatNames = useMemo(
    () => buildNameMap(formats, (format) => format.display_name),
    [formats],
  );
  const memberNames = useMemo(
    () => buildNameMap(members, (member) => member.full_name),
    [members],
  );

  const filteredPublications = useMemo(
    () =>
      filterContentFactoryPublications(publications, {
        status: filters.status === "all" ? "" : filters.status,
        platform_id: filters.platform_id,
        format_id: filters.format_id,
        responsible_id: filters.responsible_id,
        bundle_id: filters.bundle_id,
      }),
    [filters, publications],
  );
  const groups = useMemo(
    () => groupPublicationsByDate(filteredPublications),
    [filteredPublications],
  );

  if (loading) {
    return <CalendarLoadingSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              Календарь контента
            </h1>
            <p className="text-sm text-muted-foreground">
              Публикации по датам, статусам, платформам и ответственным
            </p>
          </div>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-8 w-full gap-1.5 rounded-md px-3 text-xs sm:w-auto"
        >
          <Link href="/content-factory/dashboard">
            <Factory className="h-3.5 w-3.5" />
            Dashboard
          </Link>
        </Button>
      </div>

      <ContentFactoryFilters
        filters={filters}
        bundles={bundles}
        platforms={platforms}
        formats={formats}
        members={members}
        onChange={setFilters}
      />

      <div className="flex items-center justify-between gap-3 border-y border-border/60 py-2">
        <p className="text-sm text-muted-foreground">
          {filteredPublications.length} из {publications.length} публикаций
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          onClick={() => void fetchData()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Обновить
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            Публикаций по выбранным фильтрам нет
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Сбросьте фильтры или проверьте план публикаций позже.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <section
              key={group.dateKey}
              className="rounded-lg border border-border/70 bg-card shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {group.label}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {group.publications.length}
                </span>
              </div>
              <div className="divide-y divide-border/60">
                {group.publications.map((publication) => (
                  <div
                    key={publication.id}
                    className="grid gap-3 px-4 py-3 lg:grid-cols-[96px_minmax(0,1fr)_180px]"
                  >
                    <div className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatTime(publication.scheduled_at)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {publicationTitle(publication)}
                        </p>
                        <ContentFactoryStatusBadge
                          kind="publication"
                          status={publication.status}
                        />
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {bundleNames.get(publication.bundle_id) ?? "Bundle"} ·{" "}
                        {platformNames.get(publication.platform_id) ?? "Платформа"} ·{" "}
                        {formatNames.get(publication.format_id) ?? "Формат"}
                      </p>
                    </div>
                    <div className="flex h-8 items-center truncate text-xs text-muted-foreground lg:justify-end">
                      {memberNames.get(publication.responsible_id) ??
                        "Ответственный"}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
