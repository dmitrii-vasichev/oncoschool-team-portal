"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Edit3,
  ExternalLink,
  FileText,
  Link2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { ContentFactoryMetricHistory } from "@/components/content-factory/ContentFactoryMetricHistory";
import { ContentFactoryPublicationDialog } from "@/components/content-factory/ContentFactoryPublicationDialog";
import { ContentFactoryPublicationVersionList } from "@/components/content-factory/ContentFactoryPublicationVersionList";
import { ContentFactorySegmentTargetsPanel } from "@/components/content-factory/ContentFactorySegmentTargetsPanel";
import { ContentFactoryStatusBadge } from "@/components/content-factory/ContentFactoryStatusBadge";
import { ContentFactoryUtmHelper } from "@/components/content-factory/ContentFactoryUtmHelper";
import { api } from "@/lib/api";
import {
  getContentFactoryDisplayName,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFExternalSegment,
  CFFormat,
  CFMetricSnapshot,
  CFNosology,
  CFPlatform,
  CFPublication,
  CFPublicationSegmentTarget,
  CFPublicationVersion,
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

function PublicationLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-36 rounded-md" />
      <Skeleton className="h-36 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </div>
  );
}

export default function ContentFactoryPublicationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toastError } = useToast();
  const [publication, setPublication] = useState<CFPublication | null>(null);
  const [bundle, setBundle] = useState<CFBundle | null>(null);
  const [versions, setVersions] = useState<CFPublicationVersion[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [platforms, setPlatforms] = useState<CFPlatform[]>([]);
  const [formats, setFormats] = useState<CFFormat[]>([]);
  const [rubrics, setRubrics] = useState<CFRubric[]>([]);
  const [nosologies, setNosologies] = useState<CFNosology[]>([]);
  const [segments, setSegments] = useState<CFExternalSegment[]>([]);
  const [segmentTargets, setSegmentTargets] = useState<
    CFPublicationSegmentTarget[]
  >([]);
  const [metrics, setMetrics] = useState<CFMetricSnapshot[]>([]);
  const [editOpen, setEditOpen] = useState(false);
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
        versionRes,
        memberRes,
        platformRes,
        formatRes,
        rubricRes,
        nosologyRes,
        segmentRes,
        segmentTargetRes,
        metricRes,
      ] = await Promise.all([
        api.getCFPublication(id),
        api.getCFPublicationVersions(id),
        api.getTeam().catch(() => [] as TeamMember[]),
        api.getCFPlatforms().catch(() => [] as CFPlatform[]),
        api.getCFFormats().catch(() => [] as CFFormat[]),
        api.getCFRubrics().catch(() => [] as CFRubric[]),
        api.getCFNosologies().catch(() => [] as CFNosology[]),
        api.getCFSegments({ only_active: true }).catch(() => [] as CFExternalSegment[]),
        api.getCFPublicationSegmentTargets(id)
          .catch(() => [] as CFPublicationSegmentTarget[]),
        api.getCFMetrics(id).catch(() => [] as CFMetricSnapshot[]),
      ]);
      const bundleRes = await api
        .getCFBundle(publicationRes.bundle_id)
        .catch(() => null as CFBundle | null);
      if (!isLatestRequest()) return;
      setPublication(publicationRes);
      setVersions(versionRes);
      setBundle(bundleRes);
      setMembers(memberRes);
      setPlatforms(platformRes);
      setFormats(formatRes);
      setRubrics(rubricRes);
      setNosologies(nosologyRes);
      setSegments(segmentRes);
      setSegmentTargets(segmentTargetRes);
      setMetrics(metricRes);
    } catch (err) {
      if (isLatestRequest()) {
        toastError(
          err instanceof Error ? err.message : "Не удалось загрузить публикацию",
        );
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

  async function handleSaved() {
    await fetchData();
  }

  if (loading) {
    return <PublicationLoadingSkeleton />;
  }

  if (!publication) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2 text-xs">
          <Link href="/content-factory/bundles">
            <ArrowLeft className="h-3.5 w-3.5" />
            К bundles
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            Публикация не найдена
          </h2>
        </div>
      </div>
    );
  }

  const platformName = getContentFactoryDisplayName(publication.platform_id, platforms);
  const formatName = getContentFactoryDisplayName(publication.format_id, formats);
  const rubricName = getContentFactoryDisplayName(publication.rubric_id, rubrics);
  const nosologyName = getContentFactoryDisplayName(
    publication.nosology_id,
    nosologies,
  );
  const responsibleName =
    memberNames.get(publication.responsible_id) ?? "Ответственный";
  const bundleHref = `/content-factory/bundles/${publication.bundle_id}`;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2 text-xs">
          <Link href={bundleHref}>
            <ArrowLeft className="h-3.5 w-3.5" />
            К bundle
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
              <ContentFactoryStatusBadge
                kind="publication"
                status={publication.status}
              />
              <span className="text-xs text-muted-foreground">
                v{publication.version_number}
              </span>
              {bundle && (
                <Link
                  href={bundleHref}
                  className="truncate text-xs text-primary hover:underline"
                >
                  {bundle.name}
                </Link>
              )}
            </div>
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              {publicationTitle(publication)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {platformName} · {formatName} · {responsibleName}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 rounded-md px-3 text-xs"
            onClick={() => setEditOpen(true)}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit publication
          </Button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="rounded-lg border border-border/70 bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Текст</h2>
            </div>
            <div className="px-4 py-4">
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                {publication.body_text?.trim() || "Текст не заполнен"}
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Media refs</h2>
            </div>
            {publication.media_refs.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Media refs не указаны
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {publication.media_refs.map((ref, index) => (
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

          <ContentFactoryPublicationVersionList versions={versions} members={members} />

          <ContentFactoryMetricHistory
            publicationId={publication.id}
            metrics={metrics}
            members={members}
            onRecorded={handleSaved}
          />
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">
              Production details
            </h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Schedule</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-foreground">
                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDateTime(publication.scheduled_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Published</dt>
                <dd className="mt-1 text-foreground">
                  {formatDateTime(publication.actual_published_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Rubric</dt>
                <dd className="mt-1 text-foreground">{rubricName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Nosology</dt>
                <dd className="mt-1 text-foreground">{nosologyName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Post ID</dt>
                <dd className="mt-1 text-foreground">
                  {publication.platform_post_id || "Не указан"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Post URL</dt>
                <dd className="mt-1">
                  {publication.platform_post_url ? (
                    <a
                      href={publication.platform_post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      Открыть
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-foreground">Не указан</span>
                  )}
                </dd>
              </div>
              {publication.cancelled_reason && (
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Cancelled reason
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-foreground">
                    {publication.cancelled_reason}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <ContentFactorySegmentTargetsPanel
            publicationId={publication.id}
            segments={segments}
            targets={segmentTargets}
            onChanged={handleSaved}
          />

          <ContentFactoryUtmHelper
            publication={publication}
            bundle={bundle}
            platforms={platforms}
            formats={formats}
            segments={segments}
            segmentTargets={segmentTargets}
            onApplied={handleSaved}
          />
        </aside>
      </div>

      <ContentFactoryPublicationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        publication={publication}
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
