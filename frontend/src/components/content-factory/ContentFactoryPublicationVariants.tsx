"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Layers3,
  RotateCcw,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import {
  buildContentFactoryPublicationVariantHandoff,
  buildContentFactoryPublicationVariants,
  getContentFactoryPublicationVariantCoverage,
  type ContentFactoryPublicationVariantKey,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFFormat,
  CFPlatform,
  CFPublication,
  CFPublicationVariant,
} from "@/lib/types";

function formatSavedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "дата неизвестна";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatUtmForCopy(utm: Record<string, unknown>): string | null {
  const entries = Object.entries(utm).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    return String(value).trim().length > 0;
  });
  if (entries.length === 0) return null;
  return JSON.stringify(Object.fromEntries(entries), null, 2);
}

function buildEditedVariantCopyText({
  channelLabel,
  useCase,
  title,
  body,
  notes,
  utm,
}: {
  channelLabel: string;
  useCase: string;
  title: string;
  body: string;
  notes: string;
  utm: Record<string, unknown>;
}): string {
  const lines = [
    `Канал: ${channelLabel}`,
    `Назначение: ${useCase}`,
    "",
    "Заголовок:",
    title || "Без заголовка",
    "",
    "Текст:",
    body || "Текст адаптации не заполнен",
  ];
  const trimmedNotes = notes.trim();
  if (trimmedNotes) {
    lines.push("", "Заметки:", trimmedNotes);
  }
  const utmText = formatUtmForCopy(utm);
  if (utmText) {
    lines.push("", "UTM:", utmText);
  }
  return lines.join("\n");
}

export function ContentFactoryPublicationVariants({
  publication,
  platform,
  format,
  bundle,
  savedVariants = [],
  onSaved,
}: {
  publication: CFPublication;
  platform: CFPlatform | null;
  format: CFFormat | null;
  bundle: CFBundle | null;
  savedVariants?: CFPublicationVariant[];
  onSaved?: () => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const generated = useMemo(
    () =>
      buildContentFactoryPublicationVariants({
        publication,
        platform,
        format,
        bundle,
      }),
    [bundle, format, platform, publication],
  );
  const coverage = useMemo(
    () =>
      getContentFactoryPublicationVariantCoverage({
        publication,
        savedVariants,
      }),
    [publication, savedVariants],
  );
  const handoff = useMemo(
    () =>
      buildContentFactoryPublicationVariantHandoff({
        publication,
        savedVariants,
      }),
    [publication, savedVariants],
  );
  const [selectedKey, setSelectedKey] =
    useState<ContentFactoryPublicationVariantKey>("telegram");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedVariant =
    generated.variants.find((variant) => variant.key === selectedKey) ??
    generated.variants[0];
  const selectedSavedVariant =
    savedVariants.find((variant) => variant.channel === selectedKey) ?? null;
  const savedChannelKeys = useMemo(
    () => new Set(coverage.savedChannels.map((channel) => channel.key)),
    [coverage],
  );
  const isSavedFromOlderPublication =
    selectedSavedVariant !== null &&
    selectedSavedVariant.source_version_number < publication.version_number;

  useEffect(() => {
    setDraftTitle(selectedSavedVariant?.title ?? selectedVariant.title);
    setDraftBody(selectedSavedVariant?.body_text ?? selectedVariant.body);
    setDraftNotes(selectedSavedVariant?.notes ?? "");
  }, [selectedSavedVariant, selectedVariant]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        buildEditedVariantCopyText({
          channelLabel: selectedVariant.channelLabel,
          useCase: selectedVariant.useCase,
          title: draftTitle,
          body: draftBody,
          notes: draftNotes,
          utm: publication.utm,
        }),
      );
      toastSuccess("Адаптация скопирована");
    } catch {
      toastError("Не удалось скопировать адаптацию");
    }
  }

  async function handleCopyReadyVariants() {
    if (!handoff.canCopy) {
      toastError(handoff.nextAction);
      return;
    }
    try {
      await navigator.clipboard.writeText(handoff.copyText);
      toastSuccess("Готовые адаптации скопированы");
    } catch {
      toastError("Не удалось скопировать готовые адаптации");
    }
  }

  async function handleSave() {
    const bodyText = draftBody.trim();
    if (!bodyText) {
      toastError("Заполните текст адаптации");
      return;
    }
    setSaving(true);
    try {
      await api.upsertCFPublicationVariant(publication.id, selectedKey, {
        title: draftTitle.trim() || null,
        body_text: bodyText,
        notes: draftNotes.trim() || null,
      });
      toastSuccess("Адаптация сохранена");
      await onSaved?.();
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Не удалось сохранить адаптацию",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleResetDraft() {
    setDraftTitle(selectedVariant.title);
    setDraftBody(selectedVariant.body);
    setDraftNotes("");
  }

  return (
    <section className="rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Layers3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Адаптации</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Сохранённые тексты под каналы без AI и автопубликации.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5 rounded-md px-3 text-xs"
            onClick={handleResetDraft}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Черновик
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5 rounded-md px-3 text-xs"
            onClick={() => void handleCopy()}
          >
            <Clipboard className="h-3.5 w-3.5" />
            Скопировать адаптацию
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 gap-1.5 rounded-md px-3 text-xs"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            <Save className="h-3.5 w-3.5" />
            Сохранить адаптацию
          </Button>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {generated.contextRows.map((row) => (
            <div
              key={row.label}
              className="min-w-0 rounded-md border border-border/60 bg-muted/15 px-3 py-2"
            >
              <p className="text-xs uppercase text-muted-foreground">
                {row.label}
              </p>
              <p className="mt-1 truncate text-sm font-medium text-foreground">
                {row.value}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Готовность адаптаций
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {coverage.savedCount} из {coverage.totalChannels} каналов
                сохранено
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {coverage.nextAction}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:min-w-[280px]">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="font-semibold text-foreground">
                    {coverage.readyCount}
                  </p>
                  <p className="text-muted-foreground">готово</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {coverage.missingCount}
                  </p>
                  <p className="text-muted-foreground">нет текста</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {coverage.staleCount}
                  </p>
                  <p className="text-muted-foreground">устарело</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full gap-1.5 rounded-md px-3 text-xs"
                disabled={!handoff.canCopy}
                onClick={() => void handleCopyReadyVariants()}
              >
                <Clipboard className="h-3.5 w-3.5" />
                Скопировать готовые
              </Button>
            </div>
          </div>
          {coverage.missingCount > 0 || coverage.staleCount > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs leading-5">
              {coverage.missingCount > 0 ? (
                <span className="rounded-md border border-border/60 bg-background px-2 py-1 text-muted-foreground">
                  Нет:{" "}
                  {coverage.missingChannels
                    .map((channel) => channel.label)
                    .join(", ")}
                </span>
              ) : null}
              {coverage.staleCount > 0 ? (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">
                  Устарели:{" "}
                  {coverage.staleChannels
                    .map((channel) => channel.label)
                    .join(", ")}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {generated.variants.map((variant) => {
            const isSaved = savedChannelKeys.has(variant.key);
            return (
              <button
                key={variant.key}
                type="button"
                className={`flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  selectedVariant.key === variant.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSelectedKey(variant.key)}
              >
                {variant.channelLabel}
                {isSaved ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-2 rounded-md border border-border/70 bg-muted/10 px-3 py-3">
            <p className="text-xs uppercase text-muted-foreground">Канал</p>
            <p className="text-sm font-semibold text-foreground">
              {selectedVariant.channelLabel}
            </p>
            <p className="text-xs uppercase text-muted-foreground">Назначение</p>
            <p className="text-sm leading-5 text-foreground">
              {selectedVariant.useCase}
            </p>
            <p className="text-xs uppercase text-muted-foreground">Длина</p>
            <p className="text-sm text-foreground">{selectedVariant.lengthHint}</p>
            <p className="text-xs uppercase text-muted-foreground">Состояние</p>
            <p className="text-sm leading-5 text-foreground">
              {selectedSavedVariant
                ? `Сохранено: ${formatSavedAt(selectedSavedVariant.updated_at)}`
                : "Черновик из публикации"}
            </p>
            {selectedSavedVariant ? (
              <p className="text-xs leading-5 text-muted-foreground">
                Версия источника: v{selectedSavedVariant.source_version_number}
              </p>
            ) : null}
          </div>

          <div className="min-w-0 space-y-3">
            {selectedVariant.warnings.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    {selectedVariant.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            {isSavedFromOlderPublication ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    Публикация уже v{publication.version_number}, а адаптация
                    сохранена от v{selectedSavedVariant?.source_version_number}.
                  </p>
                </div>
              </div>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Заголовок
              </span>
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Текст адаптации
              </span>
              <textarea
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
                rows={9}
                className="min-h-56 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground shadow-sm outline-none transition-colors focus:border-primary"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Заметки
              </span>
              <textarea
                value={draftNotes}
                onChange={(event) => setDraftNotes(event.target.value)}
                rows={3}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground shadow-sm outline-none transition-colors focus:border-primary"
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
