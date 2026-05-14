"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Edit3,
  FileText,
  FolderKanban,
  Link2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { ContentFactoryBundleDialog } from "@/components/content-factory/ContentFactoryBundleDialog";
import { ContentFactoryPublicationDialog } from "@/components/content-factory/ContentFactoryPublicationDialog";
import { ContentFactoryStatusBadge } from "@/components/content-factory/ContentFactoryStatusBadge";
import { api } from "@/lib/api";
import {
  CF_PRODUCT_STREAM_LABELS,
  CF_PUBLICATION_STATUS_LABELS,
  CF_PUBLICATION_STATUSES,
  formatContentFactoryPublicationCount,
  getContentFactoryDisplayName,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFFunnelTemplate,
  CFFormat,
  CFNosology,
  CFPlatform,
  CFPublication,
  CFRubric,
  TeamMember,
} from "@/lib/types";

function formatDateTime(value: string | null): string {
  if (!value) return "Без даты";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Без даты";
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
  return text.length > 150 ? `${text.slice(0, 150)}...` : text;
}

function DetailLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-32 rounded-md" />
      <Skeleton className="h-36 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}

export default function ContentFactoryBundleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toastError } = useToast();
  const [bundle, setBundle] = useState<CFBundle | null>(null);
  const [publications, setPublications] = useState<CFPublication[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [platforms, setPlatforms] = useState<CFPlatform[]>([]);
  const [formats, setFormats] = useState<CFFormat[]>([]);
  const [rubrics, setRubrics] = useState<CFRubric[]>([]);
  const [nosologies, setNosologies] = useState<CFNosology[]>([]);
  const [funnelTemplates, setFunnelTemplates] = useState<CFFunnelTemplate[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [createPublicationOpen, setCreatePublicationOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [
        bundleRes,
        publicationRes,
        memberRes,
        platformRes,
        formatRes,
        rubricRes,
        nosologyRes,
        templateRes,
      ] = await Promise.all([
        api.getCFBundle(id),
        api.getCFPublicationsForBundle(id),
        api.getTeam().catch(() => [] as TeamMember[]),
        api.getCFPlatforms().catch(() => [] as CFPlatform[]),
        api.getCFFormats().catch(() => [] as CFFormat[]),
        api.getCFRubrics().catch(() => [] as CFRubric[]),
        api.getCFNosologies().catch(() => [] as CFNosology[]),
        api.getCFFunnelTemplates().catch(() => [] as CFFunnelTemplate[]),
      ]);
      if (!isLatestRequest()) return;
      setBundle(bundleRes);
      setPublications(publicationRes);
      setMembers(memberRes);
      setPlatforms(platformRes);
      setFormats(formatRes);
      setRubrics(rubricRes);
      setNosologies(nosologyRes);
      setFunnelTemplates(templateRes);
    } catch (err) {
      if (isLatestRequest()) {
        toastError(err instanceof Error ? err.message : "Не удалось загрузить кампанию");
      }
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.full_name])),
    [members],
  );
  const platformNames = useMemo(
    () => new Map(platforms.map((platform) => [platform.id, platform.display_name])),
    [platforms],
  );
  const formatNames = useMemo(
    () => new Map(formats.map((format) => [format.id, format.display_name])),
    [formats],
  );
  const templateNames = useMemo(
    () => new Map(funnelTemplates.map((template) => [template.id, template.name])),
    [funnelTemplates],
  );

  const publicationsByStatus = useMemo(
    () =>
      CF_PUBLICATION_STATUSES.map((status) => ({
        status,
        publications: publications.filter((publication) => publication.status === status),
      })).filter((group) => group.publications.length > 0),
    [publications],
  );

  async function handleSaved() {
    await fetchData();
  }

  if (loading) {
    return <DetailLoadingSkeleton />;
  }

  if (!bundle) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2 text-xs">
          <Link href="/content-factory/bundles">
            <ArrowLeft className="h-3.5 w-3.5" />
            К кампаниям
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            Кампания не найдена
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2 text-xs">
          <Link href="/content-factory/bundles">
            <ArrowLeft className="h-3.5 w-3.5" />
            К кампаниям
          </Link>
        </Button>
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

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ContentFactoryStatusBadge kind="bundle" status={bundle.status} />
              <span className="text-xs text-muted-foreground">
                {CF_PRODUCT_STREAM_LABELS[bundle.product_stream]}
              </span>
            </div>
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              {bundle.name}
            </h1>
            <p className="max-w-4xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {bundle.brief?.trim() || "Описание кампании не заполнено"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-md px-3 text-xs"
              onClick={() => setEditOpen(true)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Редактировать
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 rounded-md px-3 text-xs"
              onClick={() => setCreatePublicationOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Новая публикация
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-lg border border-border/70 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Публикации
              </h2>
              <span className="text-xs text-muted-foreground">
                {formatContentFactoryPublicationCount(publications.length)}
              </span>
            </div>

            {publications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                В этой кампании ещё нет публикаций
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {publicationsByStatus.map((group) => (
                  <div key={group.status} className="space-y-2 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                        {CF_PUBLICATION_STATUS_LABELS[group.status]}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {group.publications.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.publications.map((publication) => (
                        <Link
                          key={publication.id}
                          href={`/content-factory/publications/${publication.id}`}
                          className="block rounded-md border border-border/60 bg-background px-3 py-3 transition-colors hover:border-primary/30 hover:bg-muted/20"
                        >
                          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {publicationTitle(publication)}
                              </p>
                              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                {textPreview(publication.body_text)}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {platformNames.get(publication.platform_id) ?? "Платформа"} ·{" "}
                                {formatNames.get(publication.format_id) ?? "Формат"} ·{" "}
                                {memberNames.get(publication.responsible_id) ??
                                  "Ответственный"}
                              </p>
                            </div>
                            <ContentFactoryStatusBadge
                              kind="publication"
                              status={publication.status}
                            />
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {formatDateTime(publication.scheduled_at)}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Детали кампании</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Владелец</dt>
                <dd className="mt-1 text-foreground">
                  {memberNames.get(bundle.owner_id) ?? "Не указан"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Дата события</dt>
                <dd className="mt-1 text-foreground">{formatDateTime(bundle.event_date)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Шаблон</dt>
                <dd className="mt-1 text-foreground">
                  {templateNames.get(bundle.funnel_template_id ?? "") ?? "Без шаблона"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">ID кампании</dt>
                <dd className="mt-1 font-mono text-xs text-muted-foreground">
                  {getContentFactoryDisplayName(bundle.id, [])}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Исходные материалы
              </h2>
            </div>
            {bundle.source_material_refs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Исходные материалы не указаны
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {bundle.source_material_refs.map((ref, index) => (
                  <li
                    key={`${String(ref)}-${index}`}
                    className="break-words rounded-md bg-muted/30 px-2 py-1.5 text-sm text-muted-foreground"
                  >
                    {String(ref)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <ContentFactoryBundleDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        bundle={bundle}
        members={members}
        funnelTemplates={funnelTemplates}
        onSaved={handleSaved}
      />
      <ContentFactoryPublicationDialog
        open={createPublicationOpen}
        onOpenChange={setCreatePublicationOpen}
        bundleId={bundle.id}
        platforms={platforms}
        formats={formats}
        rubrics={rubrics}
        nosologies={nosologies}
        members={members}
        onSaved={handleSaved}
      />
    </div>
  );
}
