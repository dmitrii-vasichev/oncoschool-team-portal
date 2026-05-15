"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { ContentFactoryStatusBadge } from "@/components/content-factory/ContentFactoryStatusBadge";
import { api } from "@/lib/api";
import {
  formatContentFactoryPublicationCount,
  getContentFactoryDisplayName,
  getContentFactoryReviewQueueGroups,
  getContentFactoryReviewQueueItemSignal,
  summarizeContentFactoryReviewQueue,
  type ContentFactoryReviewQueueItemSignal,
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

function publicationTitle(publication: CFPublication): string {
  return publication.title?.trim() || "Без названия";
}

function textPreview(value: string | null): string {
  const text = value?.trim();
  if (!text) return "Текст не заполнен";
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

type ReviewSummaryTone = "default" | "critical";

function reviewSummaryToneClassName(tone: ReviewSummaryTone): string {
  if (tone === "critical") {
    return "border-red-200 bg-red-50/80 text-red-700";
  }
  return "border-border/70 bg-card text-foreground";
}

function ReviewSummaryCard({
  label,
  value,
  caption,
  tone = "default",
}: {
  label: string;
  value: number;
  caption: string;
  tone?: ReviewSummaryTone;
}) {
  const Icon = tone === "critical" ? AlertTriangle : CheckCircle2;

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 shadow-sm ${reviewSummaryToneClassName(
        tone,
      )}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 shrink-0" />
      </div>
      <div className="mt-2 text-2xl font-semibold leading-none">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

function reviewSignalToneClassName(
  tone: ContentFactoryReviewQueueItemSignal["tone"],
): string {
  switch (tone) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "info":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "muted":
    default:
      return "border-border/70 bg-muted/40 text-muted-foreground";
  }
}

function ReviewSignalPill({
  signal,
}: {
  signal: ContentFactoryReviewQueueItemSignal;
}) {
  const Icon = signal.urgent ? AlertTriangle : CheckCircle2;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${reviewSignalToneClassName(
        signal.tone,
      )}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {signal.label}
    </span>
  );
}

function ReviewLoadingSkeleton() {
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
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}

export default function ContentFactoryReviewPage() {
  const { toastError } = useToast();
  const [publications, setPublications] = useState<CFPublication[]>([]);
  const [bundles, setBundles] = useState<CFBundle[]>([]);
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
      const [publicationRes, bundleRes, platformRes, formatRes, memberRes] =
        await Promise.all([
          api.getCFPublications({ limit: 500 }),
          api.getCFBundles({ limit: 500 }).catch(() => [] as CFBundle[]),
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
      if (isLatestRequest()) toastError("Не удалось загрузить очередь проверки");
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const queueGroups = useMemo(
    () => getContentFactoryReviewQueueGroups(publications),
    [publications],
  );
  const queueSummary = useMemo(
    () => summarizeContentFactoryReviewQueue(publications),
    [publications],
  );
  const bundleNames = useMemo(
    () => new Map(bundles.map((bundle) => [bundle.id, bundle.name])),
    [bundles],
  );
  const platformNames = useMemo(
    () => new Map(platforms.map((platform) => [platform.id, platform.display_name])),
    [platforms],
  );
  const formatNames = useMemo(
    () => new Map(formats.map((format) => [format.id, format.display_name])),
    [formats],
  );
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.full_name])),
    [members],
  );
  const queueCount = queueGroups.reduce(
    (total, queue) => total + queue.publications.length,
    0,
  );

  if (loading) {
    return <ReviewLoadingSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ListChecks className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              Очередь проверки
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatContentFactoryPublicationCount(queueCount)} ждут проверки,
              согласования или расписания
            </p>
          </div>
        </div>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ReviewSummaryCard
          label="В очереди"
          value={queueSummary.total}
          caption="Все публикации в проверке"
        />
        <ReviewSummaryCard
          label="Производство"
          value={queueSummary.production}
          caption="Нужен текст или дизайн"
        />
        <ReviewSummaryCard
          label="Фактчек и врач"
          value={queueSummary.medicalReview}
          caption="Редакционная и медпроверка"
        />
        <ReviewSummaryCard
          label="Расписание"
          value={queueSummary.scheduling}
          caption="Одобрено или в календаре"
        />
        <ReviewSummaryCard
          label="Срочно"
          value={queueSummary.urgent}
          caption="Ошибки и просроченный план"
          tone={queueSummary.urgent > 0 ? "critical" : "default"}
        />
      </div>

      {queueGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <ListChecks className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            Очередь проверки пуста
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Сейчас нет публикаций в статусах проверки или согласования.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {queueGroups.map((queue) => (
            <section
              key={queue.key}
              className="rounded-lg border border-border/70 bg-card shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {queue.label}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {queue.publications.length}
                </span>
              </div>
              <div className="divide-y divide-border/60">
                {queue.publications.map((publication) => {
                  const signal = getContentFactoryReviewQueueItemSignal(publication);

                  return (
                    <Link
                      key={publication.id}
                      href={`/content-factory/publications/${publication.id}`}
                      className="block px-4 py-3 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {publicationTitle(publication)}
                            </p>
                            <ContentFactoryStatusBadge
                              kind="publication"
                              status={publication.status}
                            />
                            <ReviewSignalPill signal={signal} />
                          </div>
                          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {textPreview(publication.body_text)}
                          </p>
                          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                            <span className="block text-2xs font-semibold uppercase text-muted-foreground">
                              Сейчас нужно
                            </span>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              {signal.actionLabel}
                            </p>
                            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                              {signal.description}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="truncate">
                              {bundleNames.get(publication.bundle_id) ??
                                getContentFactoryDisplayName(publication.bundle_id, [])}
                            </span>
                            <span className="inline-flex items-center gap-1 font-medium text-primary">
                              Открыть
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </div>
                        <div className="grid shrink-0 gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:w-[360px]">
                          <div className="rounded-md bg-muted/30 px-2 py-1.5">
                            <span className="block text-2xs uppercase">Канал</span>
                            <span className="font-medium text-foreground">
                              {platformNames.get(publication.platform_id) ??
                                "Платформа"}{" "}
                              · {formatNames.get(publication.format_id) ?? "Формат"}
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
                          <div className="rounded-md bg-muted/30 px-2 py-1.5 sm:col-span-2">
                            <span className="block text-2xs uppercase">План</span>
                            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                              <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDateTime(publication.scheduled_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
