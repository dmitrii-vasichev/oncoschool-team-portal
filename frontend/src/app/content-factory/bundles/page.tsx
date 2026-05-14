"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, Factory, FolderKanban, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import {
  ContentFactoryBundleFilters,
  EMPTY_CONTENT_FACTORY_BUNDLE_FILTERS,
} from "@/components/content-factory/ContentFactoryBundleFilters";
import { ContentFactoryBundleDialog } from "@/components/content-factory/ContentFactoryBundleDialog";
import { ContentFactoryStatusBadge } from "@/components/content-factory/ContentFactoryStatusBadge";
import { api } from "@/lib/api";
import {
  CF_PRODUCT_STREAM_LABELS,
  buildContentFactoryBundleParams,
  formatContentFactoryBundleCount,
  getContentFactoryDisplayName,
  type ContentFactoryBundleFilterValues,
} from "@/lib/contentFactoryUtils";
import type { CFBundle, CFFunnelTemplate, TeamMember } from "@/lib/types";

function formatDate(value: string | null): string {
  if (!value) return "Без даты";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Без даты";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function briefPreview(value: string | null): string {
  const text = value?.trim();
  if (!text) return "Описание кампании не заполнено";
  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

function BundlesLoadingSkeleton() {
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
      <Skeleton className="h-28 rounded-lg" />
      <Skeleton className="h-28 rounded-lg" />
    </div>
  );
}

export default function ContentFactoryBundlesPage() {
  const { toastError } = useToast();
  const [bundles, setBundles] = useState<CFBundle[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [funnelTemplates, setFunnelTemplates] = useState<CFFunnelTemplate[]>([]);
  const [filters, setFilters] = useState<ContentFactoryBundleFilterValues>(
    EMPTY_CONTENT_FACTORY_BUNDLE_FILTERS,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [bundleRes, memberRes, templateRes] = await Promise.all([
        api.getCFBundles(buildContentFactoryBundleParams(filters)),
        api.getTeam().catch(() => [] as TeamMember[]),
        api.getCFFunnelTemplates().catch(() => [] as CFFunnelTemplate[]),
      ]);
      if (!isLatestRequest()) return;
      setBundles(bundleRes);
      setMembers(memberRes);
      setFunnelTemplates(templateRes);
    } catch {
      if (isLatestRequest()) toastError("Не удалось загрузить кампании");
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [filters, toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const ownerNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.full_name])),
    [members],
  );
  const templateNames = useMemo(
    () => new Map(funnelTemplates.map((template) => [template.id, template.name])),
    [funnelTemplates],
  );

  async function handleBundleSaved() {
    await fetchData();
  }

  if (loading) {
    return <BundlesLoadingSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderKanban className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              Кампании
            </h1>
            <p className="text-sm text-muted-foreground">
              Смысловые блоки, события, описания и пакеты публикаций
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
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
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="h-8 w-full gap-1.5 rounded-md px-3 text-xs sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Новая кампания
          </Button>
        </div>
      </div>

      <ContentFactoryBundleFilters
        filters={filters}
        members={members}
        onChange={setFilters}
      />

      <div className="flex items-center justify-between gap-3 border-y border-border/60 py-2">
        <p className="text-sm text-muted-foreground">
          {formatContentFactoryBundleCount(bundles.length)}
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

      {bundles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <Factory className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            Кампаний по выбранным фильтрам нет
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Создайте кампанию или измените фильтры.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {bundles.map((bundle) => (
            <Link
              key={bundle.id}
              href={`/content-factory/bundles/${bundle.id}`}
              className="block rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/20"
            >
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {bundle.name}
                    </h2>
                    <ContentFactoryStatusBadge kind="bundle" status={bundle.status} />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {briefPreview(bundle.brief)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {CF_PRODUCT_STREAM_LABELS[bundle.product_stream]} ·{" "}
                    {ownerNames.get(bundle.owner_id) ?? "Владелец"} ·{" "}
                    {templateNames.get(bundle.funnel_template_id ?? "") ??
                      "Без шаблона"}
                  </p>
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3 lg:w-[320px]">
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase">Дата</span>
                    <span className="font-medium text-foreground">
                      {formatDate(bundle.event_date)}
                    </span>
                  </div>
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase">Материалы</span>
                    <span className="font-medium text-foreground">
                      {bundle.source_material_refs.length}
                    </span>
                  </div>
                  <div className="rounded-md bg-muted/30 px-2 py-1.5">
                    <span className="block text-2xs uppercase">ID</span>
                    <span className="font-medium text-foreground">
                      {getContentFactoryDisplayName(bundle.id, [])}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ContentFactoryBundleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        funnelTemplates={funnelTemplates}
        onSaved={handleBundleSaved}
      />
    </div>
  );
}
