"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import {
  CF_PUBLICATION_STATUS_LABELS,
  CF_PUBLICATION_STATUSES,
  cleanContentFactoryPublicationUpdate,
} from "@/lib/contentFactoryUtils";
import type {
  CFFormat,
  CFJsonObject,
  CFNosology,
  CFPlatform,
  CFPublication,
  CFPublicationStatus,
  CFRubric,
  TeamMember,
} from "@/lib/types";

function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function dateTimeLocalToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function refsToText(refs: unknown[]): string {
  return refs.map((ref) => String(ref)).join("\n");
}

function textToRefs(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseUtmJson(value: string): CFJsonObject {
  const parsed: unknown = value.trim() ? JSON.parse(value) : {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("UTM должен быть JSON-объектом");
  }
  return parsed as CFJsonObject;
}

export function ContentFactoryPublicationDialog({
  open,
  onOpenChange,
  publication,
  bundleId,
  platforms,
  formats,
  rubrics,
  nosologies,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publication?: CFPublication | null;
  bundleId?: string;
  platforms: CFPlatform[];
  formats: CFFormat[];
  rubrics: CFRubric[];
  nosologies: CFNosology[];
  members: TeamMember[];
  onSaved: (publication: CFPublication) => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const [platformId, setPlatformId] = useState("");
  const [formatId, setFormatId] = useState("");
  const [rubricId, setRubricId] = useState("none");
  const [nosologyId, setNosologyId] = useState("none");
  const [responsibleId, setResponsibleId] = useState("");
  const [status, setStatus] = useState<CFPublicationStatus>("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [actualPublishedAt, setActualPublishedAt] = useState("");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [mediaRefsText, setMediaRefsText] = useState("");
  const [utmText, setUtmText] = useState("{}");
  const [platformPostUrl, setPlatformPostUrl] = useState("");
  const [platformPostId, setPlatformPostId] = useState("");
  const [cancelledReason, setCancelledReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeMembers = members.filter((member) => member.is_active);
  const editing = Boolean(publication);

  useEffect(() => {
    if (!open) return;
    setPlatformId(publication?.platform_id ?? platforms[0]?.id ?? "");
    setFormatId(publication?.format_id ?? formats[0]?.id ?? "");
    setRubricId(publication?.rubric_id ?? "none");
    setNosologyId(publication?.nosology_id ?? "none");
    setResponsibleId(publication?.responsible_id ?? activeMembers[0]?.id ?? "");
    setStatus(publication?.status ?? "draft");
    setScheduledAt(toDateTimeLocalValue(publication?.scheduled_at));
    setActualPublishedAt(toDateTimeLocalValue(publication?.actual_published_at));
    setTitle(publication?.title ?? "");
    setBodyText(publication?.body_text ?? "");
    setMediaRefsText(refsToText(publication?.media_refs ?? []));
    setUtmText(JSON.stringify(publication?.utm ?? {}, null, 2));
    setPlatformPostUrl(publication?.platform_post_url ?? "");
    setPlatformPostId(publication?.platform_post_id ?? "");
    setCancelledReason(publication?.cancelled_reason ?? "");
    setError(null);
  }, [activeMembers, formats, open, platforms, publication]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!platformId) {
      setError("Выберите платформу");
      return;
    }
    if (!formatId) {
      setError("Выберите формат");
      return;
    }
    if (!responsibleId) {
      setError("Выберите ответственного");
      return;
    }
    if (!editing && !bundleId) {
      setError("Кампания не найдена");
      return;
    }
    const targetBundleId = bundleId ?? publication?.bundle_id;
    if (!targetBundleId) {
      setError("Кампания не найдена");
      return;
    }

    let utm: CFJsonObject;
    try {
      utm = parseUtmJson(utmText);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Некорректный UTM JSON";
      setError(message);
      return;
    }

    const sharedPayload = {
      platform_id: platformId,
      format_id: formatId,
      rubric_id: rubricId === "none" ? null : rubricId,
      nosology_id: nosologyId === "none" ? null : nosologyId,
      responsible_id: responsibleId,
      title: title,
      body_text: bodyText,
      media_refs: textToRefs(mediaRefsText),
      scheduled_at: dateTimeLocalToIso(scheduledAt),
      status,
      utm,
    };

    setSaving(true);
    setError(null);
    try {
      const saved = publication
        ? await api.updateCFPublication(
            publication.id,
            cleanContentFactoryPublicationUpdate({
              ...sharedPayload,
              actual_published_at: dateTimeLocalToIso(actualPublishedAt),
              platform_post_url: platformPostUrl,
              platform_post_id: platformPostId,
              cancelled_reason: cancelledReason,
            }),
          )
        : await api.createCFPublicationForBundle(targetBundleId, {
            ...sharedPayload,
            bundle_id: targetBundleId,
          });
      await onSaved(saved);
      onOpenChange(false);
      toastSuccess(publication ? "Публикация обновлена" : "Публикация создана");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось сохранить публикацию";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-1.5rem)] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {publication ? "Редактировать публикацию" : "Новая публикация"}
          </DialogTitle>
          <DialogDescription>
            Производственные поля, расписание, текст, UTM-метки и ссылки на опубликованный пост.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Платформа</Label>
              <Select value={platformId || undefined} onValueChange={setPlatformId} disabled={saving}>
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue placeholder="Платформа" />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                  {platforms.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Формат</Label>
              <Select value={formatId || undefined} onValueChange={setFormatId} disabled={saving}>
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue placeholder="Формат" />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                  {formats.map((format) => (
                    <SelectItem key={format.id} value={format.id}>
                      {format.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ответственный</Label>
              <Select
                value={responsibleId || undefined}
                onValueChange={setResponsibleId}
                disabled={saving}
              >
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue placeholder="Ответственный" />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                  {activeMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Рубрика</Label>
              <Select value={rubricId} onValueChange={setRubricId} disabled={saving}>
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                  <SelectItem value="none">Без рубрики</SelectItem>
                  {rubrics.map((rubric) => (
                    <SelectItem key={rubric.id} value={rubric.id}>
                      {rubric.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Нозология</Label>
              <Select value={nosologyId} onValueChange={setNosologyId} disabled={saving}>
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                  <SelectItem value="none">Без нозологии</SelectItem>
                  {nosologies.map((nosology) => (
                    <SelectItem key={nosology.id} value={nosology.id}>
                      {nosology.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Статус</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as CFPublicationStatus)}
                disabled={saving}
              >
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                  {CF_PUBLICATION_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CF_PUBLICATION_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cf-publication-scheduled-at">Запланировано</Label>
              <Input
                id="cf-publication-scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="h-9 border-border/70 bg-muted/20"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-publication-actual-at">Опубликовано фактически</Label>
              <Input
                id="cf-publication-actual-at"
                type="datetime-local"
                value={actualPublishedAt}
                onChange={(event) => setActualPublishedAt(event.target.value)}
                className="h-9 border-border/70 bg-muted/20"
                disabled={saving || !publication}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-publication-title">Заголовок</Label>
            <Input
              id="cf-publication-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-9 border-border/70 bg-muted/20"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-publication-body">Текст</Label>
            <Textarea
              id="cf-publication-body"
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              rows={8}
              className="min-h-[180px] resize-y border-border/70 bg-muted/20"
              disabled={saving}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cf-publication-media">Медиа и материалы</Label>
              <Textarea
                id="cf-publication-media"
                value={mediaRefsText}
                onChange={(event) => setMediaRefsText(event.target.value)}
                placeholder="Одна ссылка или ID материала на строку"
                rows={4}
                className="min-h-[108px] resize-y border-border/70 bg-muted/20"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-publication-utm">UTM-метки</Label>
              <Textarea
                id="cf-publication-utm"
                value={utmText}
                onChange={(event) => setUtmText(event.target.value)}
                rows={4}
                className="min-h-[108px] resize-y border-border/70 bg-muted/20 font-mono text-xs"
                disabled={saving}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cf-publication-url">Ссылка на опубликованный пост</Label>
              <Input
                id="cf-publication-url"
                value={platformPostUrl}
                onChange={(event) => setPlatformPostUrl(event.target.value)}
                className="h-9 border-border/70 bg-muted/20"
                disabled={saving || !publication}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-publication-post-id">ID поста на площадке</Label>
              <Input
                id="cf-publication-post-id"
                value={platformPostId}
                onChange={(event) => setPlatformPostId(event.target.value)}
                className="h-9 border-border/70 bg-muted/20"
                disabled={saving || !publication}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-publication-cancelled-reason">Причина отмены</Label>
            <Textarea
              id="cf-publication-cancelled-reason"
              value={cancelledReason}
              onChange={(event) => setCancelledReason(event.target.value)}
              rows={2}
              className="min-h-[72px] resize-y border-border/70 bg-muted/20"
              disabled={saving || !publication}
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {publication ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
