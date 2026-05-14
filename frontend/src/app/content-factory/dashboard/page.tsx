"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Factory,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { ContentFactoryStatusBadge } from "@/components/content-factory/ContentFactoryStatusBadge";
import { api } from "@/lib/api";
import {
  CF_BUNDLE_STATUS_LABELS,
  CF_BUNDLE_STATUSES,
  CF_PUBLICATION_STATUS_LABELS,
  CF_PUBLICATION_STATUSES,
  summarizeContentFactoryDashboard,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFFormat,
  CFPlatform,
  CFPublication,
  TeamMember,
} from "@/lib/types";

function formatDateTime(value: string | null): string {
  if (!value) return "Без даты";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Без даты";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildNameMap<T extends { id: string }>(
  items: T[],
  getName: (item: T) => string,
): Map<string, string> {
  return new Map(items.map((item) => [item.id, getName(item)]));
}

function publicationTitle(publication: CFPublication): string {
  return publication.title?.trim() || "Без названия";
}

function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-3 w-64 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

function StatusCountTile({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-3 py-3 shadow-sm">
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold leading-none text-foreground">
        {count}
      </p>
    </div>
  );
}

function PublicationList({
  title,
  icon: Icon,
  publications,
  emptyText,
  platforms,
  formats,
  members,
}: {
  title: string;
  icon: React.ElementType;
  publications: CFPublication[];
  emptyText: string;
  platforms: Map<string, string>;
  formats: Map<string, string>;
  members: Map<string, string>;
}) {
  return (
    <section className="rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {publications.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {publications.map((publication) => (
            <div key={publication.id} className="space-y-2 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {publicationTitle(publication)}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {platforms.get(publication.platform_id) ?? "Платформа"} ·{" "}
                    {formats.get(publication.format_id) ?? "Формат"} ·{" "}
                    {members.get(publication.responsible_id) ?? "Ответственный"}
                  </p>
                </div>
                <ContentFactoryStatusBadge
                  kind="publication"
                  status={publication.status}
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                {formatDateTime(
                  publication.actual_published_at ?? publication.scheduled_at,
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ContentFactoryDashboardPage() {
  const { toastError } = useToast();
  const [bundles, setBundles] = useState<CFBundle[]>([]);
  const [publications, setPublications] = useState<CFPublication[]>([]);
  const [platforms, setPlatforms] = useState<CFPlatform[]>([]);
  const [formats, setFormats] = useState<CFFormat[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [bundleRes, publicationRes, platformRes, formatRes, memberRes] =
        await Promise.all([
          api.getCFBundles({ limit: 500 }),
          api.getCFPublications({ limit: 500 }),
          api.getCFPlatforms().catch(() => [] as CFPlatform[]),
          api.getCFFormats().catch(() => [] as CFFormat[]),
          api.getTeam().catch(() => [] as TeamMember[]),
        ]);
      if (!isLatestRequest()) return;
      setBundles(bundleRes);
      setPublications(publicationRes);
      setPlatforms(platformRes);
      setFormats(formatRes);
      setMembers(memberRes);
    } catch {
      if (isLatestRequest()) {
        toastError("Не удалось загрузить Контент-фабрику");
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
  const summary = useMemo(
    () => summarizeContentFactoryDashboard({ bundles, publications }),
    [bundles, publications],
  );

  if (loading) {
    return <DashboardLoadingSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Factory className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              Контент-фабрика
            </h1>
            <p className="text-sm text-muted-foreground">
              Статусы, ближайшие публикации и производственные задержки
            </p>
          </div>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-8 w-full gap-1.5 rounded-md px-3 text-xs sm:w-auto"
        >
          <Link href="/content-factory/calendar">
            <CalendarDays className="h-3.5 w-3.5" />
            Календарь
          </Link>
        </Button>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3 border-y border-border/60 py-2">
          <h2 className="text-sm font-semibold text-foreground">Кампании</h2>
          <p className="text-xs text-muted-foreground">{bundles.length} всего</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {CF_BUNDLE_STATUSES.map((status) => (
            <StatusCountTile
              key={status}
              label={CF_BUNDLE_STATUS_LABELS[status]}
              count={summary.bundleStatusCounts[status]}
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3 border-y border-border/60 py-2">
          <h2 className="text-sm font-semibold text-foreground">Публикации</h2>
          <p className="text-xs text-muted-foreground">
            {publications.length} всего
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {CF_PUBLICATION_STATUSES.map((status) => (
            <StatusCountTile
              key={status}
              label={CF_PUBLICATION_STATUS_LABELS[status]}
              count={summary.publicationStatusCounts[status]}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <PublicationList
          title="Ближайшие"
          icon={CalendarDays}
          publications={summary.upcomingPublications}
          emptyText="Запланированных публикаций пока нет"
          platforms={platformNames}
          formats={formatNames}
          members={memberNames}
        />
        <PublicationList
          title="Задержки"
          icon={AlertTriangle}
          publications={summary.overdueProductionItems}
          emptyText="Просроченных производственных публикаций нет"
          platforms={platformNames}
          formats={formatNames}
          members={memberNames}
        />
        <PublicationList
          title="Опубликовано"
          icon={CheckCircle2}
          publications={summary.recentlyPublished}
          emptyText="Недавних публикаций пока нет"
          platforms={platformNames}
          formats={formatNames}
          members={memberNames}
        />
      </div>

      <div className="flex justify-end">
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
    </div>
  );
}
