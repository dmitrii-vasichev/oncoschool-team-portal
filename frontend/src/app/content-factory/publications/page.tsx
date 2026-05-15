"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Plus,
  RefreshCw,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import {
  ContentFactoryFilters,
  EMPTY_CONTENT_FACTORY_FILTERS,
  type ContentFactoryFilterValues,
} from "@/components/content-factory/ContentFactoryFilters";
import { ContentFactoryPublicationDialog } from "@/components/content-factory/ContentFactoryPublicationDialog";
import { ContentFactoryStatusBadge } from "@/components/content-factory/ContentFactoryStatusBadge";
import { api } from "@/lib/api";
import {
  filterContentFactoryPublicationIndex,
  formatContentFactoryPublicationCount,
  sortContentFactoryPublicationsForIndex,
  summarizeContentFactoryPublicationIndex,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFFormat,
  CFNosology,
  CFPlatform,
  CFPublication,
  CFRubric,
  TeamMember,
} from "@/lib/types";

function buildNameMap<T extends { id: string }>(
  items: T[],
  getName: (item: T) => string,
): Map<string, string> {
  return new Map(items.map((item) => [item.id, getName(item)]));
}

function formatDateTime(value: string | null): string {
  if (!value) return "Не заполнено";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Не заполнено";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function publicationTitle(publication: CFPublication): string {
  return publication.title?.trim() || "Без названия";
}

function textPreview(value: string | null): string {
  const text = value?.trim();
  if (!text) return "Текст не заполнен";
  return text.length > 220 ? `${text.slice(0, 220)}...` : text;
}

function PublicationsLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-3 w-72 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-3 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-xs font-medium text-muted-foreground">
          {label}
        </p>
        <Icon
          className={
            tone === "warning"
              ? "h-4 w-4 text-amber-600"
              : "h-4 w-4 text-muted-foreground"
          }
        />
      </div>
      <p className="mt-2 text-2xl font-semibold leading-none text-foreground">
        {value}
      </p>
    </div>
  );
}

export default function ContentFactoryPublicationsPage() {
  const router = useRouter();
  const { toastError } = useToast();
  const [publications, setPublications] = useState<CFPublication[]>([]);
  const [bundles, setBundles] = useState<CFBundle[]>([]);
  const [platforms, setPlatforms] = useState<CFPlatform[]>([]);
  const [formats, setFormats] = useState<CFFormat[]>([]);
  const [rubrics, setRubrics] = useState<CFRubric[]>([]);
  const [nosologies, setNosologies] = useState<CFNosology[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [filters, setFilters] = useState<ContentFactoryFilterValues>(
    EMPTY_CONTENT_FACTORY_FILTERS,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [
        publicationRes,
        bundleRes,
        platformRes,
        formatRes,
        rubricRes,
        nosologyRes,
        memberRes,
      ] = await Promise.all([
          api.getCFPublications({ limit: 500 }),
          api.getCFBundles({ limit: 500 }),
          api.getCFPlatforms().catch(() => [] as CFPlatform[]),
          api.getCFFormats().catch(() => [] as CFFormat[]),
          api.getCFRubrics().catch(() => [] as CFRubric[]),
          api.getCFNosologies().catch(() => [] as CFNosology[]),
          api.getTeam().catch(() => [] as TeamMember[]),
        ]);
      if (!isLatestRequest()) return;
      setPublications(publicationRes);
      setBundles(bundleRes);
      setPlatforms(platformRes);
      setFormats(formatRes);
      setRubrics(rubricRes);
      setNosologies(nosologyRes);
      setMembers(memberRes);
    } catch {
      if (isLatestRequest()) {
        toastError("Не удалось загрузить публикации");
      }
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePublicationCreated = useCallback(
    async (saved: CFPublication) => {
      await fetchData();
      router.push(`/content-factory/publications/${saved.id}`);
    },
    [fetchData, router],
  );

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
  const summary = useMemo(
    () => summarizeContentFactoryPublicationIndex(publications),
    [publications],
  );
  const filteredPublications = useMemo(
    () =>
      sortContentFactoryPublicationsForIndex(
        filterContentFactoryPublicationIndex(
          publications,
          {
            status: filters.status === "all" ? "" : filters.status,
            platform_id: filters.platform_id,
            format_id: filters.format_id,
            responsible_id: filters.responsible_id,
            bundle_id: filters.bundle_id,
          },
          searchQuery,
          {
            bundleNames,
            platformNames,
            formatNames,
            responsibleNames: memberNames,
          },
        ),
      ),
    [
      bundleNames,
      filters,
      formatNames,
      memberNames,
      platformNames,
      publications,
      searchQuery,
    ],
  );

  if (loading) {
    return <PublicationsLoadingSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              Публикации
            </h1>
            <p className="text-sm text-muted-foreground">
              Все посты, письма и материалы Контент-фабрики в одном списке
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            size="sm"
            className="h-8 w-full gap-1.5 rounded-md px-3 text-xs sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Новая публикация
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 w-full gap-1.5 rounded-md px-3 text-xs sm:w-auto"
          >
            <Link href="/content-factory/calendar">
              <CalendarDays className="h-3.5 w-3.5" />
              К календарю
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryTile label="Всего" value={summary.total} icon={FileText} />
        <SummaryTile
          label="В работе"
          value={summary.inProduction}
          icon={Clock3}
        />
        <SummaryTile
          label="Запланировано"
          value={summary.scheduled}
          icon={CalendarDays}
        />
        <SummaryTile
          label="Опубликовано"
          value={summary.published}
          icon={CheckCircle2}
        />
        <SummaryTile
          label="Без ссылки"
          value={summary.publishedWithoutPostUrl}
          icon={AlertTriangle}
          tone={summary.publishedWithoutPostUrl > 0 ? "warning" : "default"}
        />
      </section>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
        <div className="grid gap-3">
          <div className="space-y-1">
            <label
              htmlFor="cf-publications-search"
              className="text-2xs font-medium uppercase text-muted-foreground"
            >
              Поиск
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cf-publications-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Название, текст, кампания, канал, ответственный"
                className="h-9 border-border/70 bg-background pl-9 text-sm shadow-sm"
              />
            </div>
          </div>

          <ContentFactoryFilters
            filters={filters}
            bundles={bundles}
            platforms={platforms}
            formats={formats}
            members={members}
            onChange={setFilters}
          />
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 border-y border-border/60 py-2">
        <p className="text-sm text-muted-foreground">
          Показано {filteredPublications.length} из{" "}
          {formatContentFactoryPublicationCount(publications.length)}
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

      {filteredPublications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            Публикаций по выбранным условиям нет
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Измените поиск или фильтры, чтобы увидеть другие материалы.
          </p>
        </div>
      ) : (
        <section className="rounded-lg border border-border/70 bg-card shadow-sm">
          <div className="divide-y divide-border/60">
            {filteredPublications.map((publication) => (
              <Link
                key={publication.id}
                href={`/content-factory/publications/${publication.id}`}
                className="block px-4 py-3 transition-colors hover:bg-muted/20"
              >
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_220px_150px]">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {publicationTitle(publication)}
                      </p>
                      <ContentFactoryStatusBadge
                        kind="publication"
                        status={publication.status}
                      />
                    </div>
                    <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {textPreview(publication.body_text)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {bundleNames.get(publication.bundle_id) ?? "Кампания"}
                    </p>
                  </div>

                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:block xl:space-y-2">
                    <div className="rounded-md bg-muted/30 px-2 py-1.5">
                      <span className="block text-2xs uppercase">Канал</span>
                      <span className="font-medium text-foreground">
                        {platformNames.get(publication.platform_id) ?? "Платформа"} ·{" "}
                        {formatNames.get(publication.format_id) ?? "Формат"}
                      </span>
                    </div>
                    <div className="rounded-md bg-muted/30 px-2 py-1.5">
                      <span className="block text-2xs uppercase">
                        Ответственный
                      </span>
                      <span className="font-medium text-foreground">
                        {memberNames.get(publication.responsible_id) ??
                          "Ответственный"}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:block xl:space-y-2">
                    <div className="rounded-md bg-muted/30 px-2 py-1.5">
                      <span className="block text-2xs uppercase">План</span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                        <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDateTime(publication.scheduled_at)}
                      </span>
                    </div>
                    <div className="rounded-md bg-muted/30 px-2 py-1.5">
                      <span className="block text-2xs uppercase">Факт</span>
                      <span className="font-medium text-foreground">
                        {formatDateTime(publication.actual_published_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground xl:justify-end">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {publication.platform_post_url ? "Ссылка есть" : "Без ссылки"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <ContentFactoryPublicationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        bundles={bundles}
        platforms={platforms}
        formats={formats}
        rubrics={rubrics}
        nosologies={nosologies}
        members={members}
        onSaved={handlePublicationCreated}
      />
    </div>
  );
}
