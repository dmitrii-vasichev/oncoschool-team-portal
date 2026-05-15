"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RadioTower,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import {
  cleanContentFactoryPublicationUpdate,
  getContentFactoryPublicationOperations,
  getContentFactoryPublicationReadiness,
  getContentFactoryPublicationVariantCoverage,
  type ContentFactoryPublicationReadinessStatus,
} from "@/lib/contentFactoryUtils";
import type {
  CFMetricSnapshot,
  CFPlatform,
  CFPublication,
  CFPublicationVariant,
  CFPublicationSegmentTarget,
} from "@/lib/types";

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

function toDateTimeLocalValue(value: string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const localTime = date.getTime() - date.getTimezoneOffset() * 60_000;
  return new Date(localTime).toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function OperationRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 border-t border-border/60 py-2 first:border-t-0 first:pt-0 last:pb-0">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

const READINESS_STATUS_CLASSES: Record<
  ContentFactoryPublicationReadinessStatus,
  string
> = {
  ready: "border-primary/20 bg-primary/10 text-primary",
  missing: "border-amber-300 bg-amber-50 text-amber-800",
  after_publish: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

function ReadinessIcon({
  status,
}: {
  status: ContentFactoryPublicationReadinessStatus;
}) {
  if (status === "ready") {
    return <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-primary" />;
  }
  if (status === "after_publish") {
    return <Clock3 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />;
  }
  return <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-700" />;
}

export function ContentFactoryPublicationOperationsPanel({
  publication,
  platform,
  metrics,
  segmentTargets,
  savedVariants,
  onSaved,
}: {
  publication: CFPublication;
  platform: CFPlatform | null;
  metrics: CFMetricSnapshot[];
  segmentTargets: CFPublicationSegmentTarget[];
  savedVariants: CFPublicationVariant[];
  onSaved: () => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actualPublishedAt, setActualPublishedAt] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [postId, setPostId] = useState("");
  const [saving, setSaving] = useState(false);
  const operations = useMemo(
    () => getContentFactoryPublicationOperations(publication, platform, metrics),
    [metrics, platform, publication],
  );
  const variantCoverage = useMemo(
    () =>
      getContentFactoryPublicationVariantCoverage({
        publication,
        savedVariants,
      }),
    [publication, savedVariants],
  );
  const readiness = useMemo(
    () =>
      getContentFactoryPublicationReadiness(
        publication,
        segmentTargets,
        metrics,
        variantCoverage,
      ),
    [metrics, publication, segmentTargets, variantCoverage],
  );
  const actionLabel =
    publication.status === "published"
      ? "Обновить факт публикации"
      : "Отметить как опубликовано";

  useEffect(() => {
    if (!dialogOpen) return;
    setActualPublishedAt(toDateTimeLocalValue(publication.actual_published_at));
    setPostUrl(publication.platform_post_url ?? "");
    setPostId(publication.platform_post_id ?? "");
  }, [
    dialogOpen,
    publication.actual_published_at,
    publication.platform_post_id,
    publication.platform_post_url,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!operations.canSavePublishFact) {
      toastError(
        operations.publishFactDisabledReason ??
          "Факт публикации пока нельзя сохранить",
      );
      return;
    }
    const publishedAtIso = fromDateTimeLocalValue(actualPublishedAt);
    if (!publishedAtIso) {
      toastError("Укажите дату и время публикации");
      return;
    }

    setSaving(true);
    try {
      await api.updateCFPublication(
        publication.id,
        cleanContentFactoryPublicationUpdate({
          status: "published",
          actual_published_at: publishedAtIso,
          platform_post_url: postUrl,
          platform_post_id: postId,
        }),
      );
      toastSuccess("Факт публикации сохранён");
      setDialogOpen(false);
      await onSaved();
    } catch (err) {
      toastError(
        err instanceof Error
          ? err.message
          : "Не удалось сохранить факт публикации",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <RadioTower className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Публикация и статистика
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Факт выхода, ссылка на пост и наличие метрик.
            </p>
          </div>
        </div>
        <CheckCircle2
          className={
            operations.missingPublishedAt || operations.missingPostUrl
              ? "h-4 w-4 text-muted-foreground"
              : "h-4 w-4 text-primary"
          }
        />
      </div>

      <div className="mt-3 rounded-md bg-muted/20 px-3 py-3">
        <OperationRow label="Факт публикации" value={operations.publishFactLabel} />
        <OperationRow
          label="Опубликовано"
          value={formatDateTime(publication.actual_published_at)}
        />
        <OperationRow
          label="Процесс публикации"
          value={operations.capabilities.publicationModeLabel}
        />
        <OperationRow
          label="Сбор статистики"
          value={operations.capabilities.metricsModeLabel}
        />
        <OperationRow
          label="Метрики"
          value={operations.metricEvidenceLabel}
        />
      </div>

      <div className="mt-3 rounded-md border border-border/70 bg-muted/10 px-3 py-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          Чек-лист готовности
        </p>
        <div className="mt-2 space-y-2">
          {readiness.map((item) => (
            <div
              key={item.key}
              className="flex items-start justify-between gap-3 rounded-md bg-background px-2 py-2"
            >
              <div className="flex min-w-0 items-start gap-2">
                <ReadinessIcon status={item.status} />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-5 text-foreground">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-2xs font-medium ${READINESS_STATUS_CLASSES[item.status]}`}
              >
                {item.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {(operations.missingPublishedAt ||
        operations.missingPostUrl ||
        operations.needsMetricEvidence) && (
        <div className="mt-3 space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-1">
              {operations.missingPublishedAt && (
                <p>Заполните дату фактической публикации.</p>
              )}
              {operations.missingPostUrl && (
                <p>Добавьте ссылку на опубликованный пост.</p>
              )}
              {operations.needsMetricEvidence && (
                <p>После публикации добавьте первые метрики вручную или через импорт.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {publication.platform_post_url ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 w-full justify-center gap-1.5 rounded-md px-3 text-xs"
          >
            <a
              href={publication.platform_post_url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Открыть пост
            </a>
          </Button>
        ) : null}
        {publication.platform_post_id ? (
          <p className="truncate text-xs text-muted-foreground">
            ID поста: {publication.platform_post_id}
          </p>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="h-8 w-full gap-1.5 rounded-md px-3 text-xs"
          disabled={!operations.canSavePublishFact}
          onClick={() => {
            if (!operations.canSavePublishFact) return;
            setDialogOpen(true);
          }}
        >
          <Activity className="h-3.5 w-3.5" />
          {actionLabel}
        </Button>
        {operations.publishFactDisabledReason ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {operations.publishFactDisabledReason}
          </p>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-xl rounded-xl">
          <DialogHeader>
            <DialogTitle>Факт публикации</DialogTitle>
            <DialogDescription>
              Сохраните дату выхода, ссылку на пост и ID на площадке.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="cf-publication-actual-at">Дата и время выхода</Label>
              <Input
                id="cf-publication-actual-at"
                type="datetime-local"
                value={actualPublishedAt}
                onChange={(event) => setActualPublishedAt(event.target.value)}
                className="border-border/70 bg-muted/20"
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cf-publication-post-url">Ссылка на пост</Label>
              <Input
                id="cf-publication-post-url"
                value={postUrl}
                onChange={(event) => setPostUrl(event.target.value)}
                placeholder="https://..."
                className="border-border/70 bg-muted/20"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cf-publication-post-id">ID поста на площадке</Label>
              <Input
                id="cf-publication-post-id"
                value={postId}
                onChange={(event) => setPostId(event.target.value)}
                placeholder="Например, 12345"
                className="border-border/70 bg-muted/20"
                disabled={saving}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Сохранить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
