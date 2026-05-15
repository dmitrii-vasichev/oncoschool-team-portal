"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  parseContentFactoryPublicationPlanImportRows,
  type ContentFactoryPublicationPlanImportRow,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFFormat,
  CFNosology,
  CFPlatform,
  CFRubric,
  TeamMember,
} from "@/lib/types";

const SAMPLE_IMPORT = `Дата | Тема | Канал | Формат | Статус | Ответственный | Рубрика | Нозология | Текст | Примечания
29.01.2026 | Анонс эфира | Telegram | Анонс | Запланировано | Дмитрий | Эфир | РМЖ | Текст поста | взять фото
2026-01-30 13:30 | История пациента | ВК | История пациента | Черновик | Надя | | | | проверить согласие`;

function buildNameMap<T extends { id: string }>(
  items: T[],
  getName: (item: T) => string,
): Map<string, string> {
  return new Map(items.map((item) => [item.id, getName(item)]));
}

function formatImportDate(value: string | null | undefined): string {
  if (!value) return "Дата не заполнена";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата не заполнена";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function ImportRowPreview({
  row,
  bundleNames,
  platformNames,
  formatNames,
  memberNames,
}: {
  row: ContentFactoryPublicationPlanImportRow;
  bundleNames: Map<string, string>;
  platformNames: Map<string, string>;
  formatNames: Map<string, string>;
  memberNames: Map<string, string>;
}) {
  if (!row.payload) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
        <div className="flex items-start gap-2 text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">
              Строка {row.lineNumber}: {row.error}
            </p>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {row.raw}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/70 bg-muted/10 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {row.payload.title || row.payload.body_text || "Публикация"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {bundleNames.get(row.payload.bundle_id) ?? "Кампания"} ·{" "}
            {platformNames.get(row.payload.platform_id) ?? "Площадка"} ·{" "}
            {formatNames.get(row.payload.format_id) ?? "Формат"} ·{" "}
            {memberNames.get(row.payload.responsible_id) ?? "Ответственный"}
          </p>
        </div>
        <p className="shrink-0 text-xs font-medium text-muted-foreground">
          {formatImportDate(row.payload.scheduled_at)}
        </p>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Статус: {CF_PUBLICATION_STATUS_LABELS[row.payload.status ?? "draft"]}
      </p>
    </div>
  );
}

export function ContentFactoryPublicationPlanImportDialog({
  open,
  onOpenChange,
  bundles,
  platforms,
  formats,
  rubrics,
  nosologies,
  members,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundles: CFBundle[];
  platforms: CFPlatform[];
  formats: CFFormat[];
  rubrics: CFRubric[];
  nosologies: CFNosology[];
  members: TeamMember[];
  onImported: () => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const activeMembers = useMemo(
    () => members.filter((member) => member.is_active),
    [members],
  );
  const [rawInput, setRawInput] = useState("");
  const [defaultBundleId, setDefaultBundleId] = useState("");
  const [defaultPlatformId, setDefaultPlatformId] = useState("");
  const [defaultFormatId, setDefaultFormatId] = useState("");
  const [defaultResponsibleId, setDefaultResponsibleId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDefaultBundleId((current) => current || bundles[0]?.id || "");
    setDefaultPlatformId((current) => current || platforms[0]?.id || "");
    setDefaultFormatId((current) => current || formats[0]?.id || "");
    setDefaultResponsibleId((current) => current || activeMembers[0]?.id || "");
  }, [activeMembers, bundles, formats, open, platforms]);

  const preview = useMemo(
    () =>
      parseContentFactoryPublicationPlanImportRows(rawInput, {
        bundles,
        platforms,
        formats,
        rubrics,
        nosologies,
        members,
        defaults: {
          bundle_id: defaultBundleId,
          platform_id: defaultPlatformId,
          format_id: defaultFormatId,
          responsible_id: defaultResponsibleId,
        },
      }),
    [
      bundles,
      defaultBundleId,
      defaultFormatId,
      defaultPlatformId,
      defaultResponsibleId,
      formats,
      members,
      nosologies,
      platforms,
      rawInput,
      rubrics,
    ],
  );
  const hasValidRows = preview.validRows.length > 0;
  const canImport = hasValidRows && preview.invalidRows.length === 0 && !saving;
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

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  async function handleImport() {
    if (!canImport) return;

    setSaving(true);
    try {
      for (const row of preview.validRows) {
        if (!row.payload) continue;
        await api.createCFPublicationForBundle(
          row.payload.bundle_id,
          row.payload,
        );
      }
      toastSuccess(`Импортировано публикаций: ${preview.validRows.length}`);
      await onImported();
      setRawInput("");
      onOpenChange(false);
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Не удалось импортировать план",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-1.5rem)] overflow-y-auto sm:max-w-[880px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Импорт плана</DialogTitle>
          <DialogDescription>
            Вставьте строки из Excel или Google Sheets. Сначала проверьте
            предпросмотр и исправьте ошибки, затем создайте публикации.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>Кампания по умолчанию</Label>
              <Select
                value={defaultBundleId || undefined}
                onValueChange={setDefaultBundleId}
                disabled={saving}
              >
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue placeholder="Кампания" />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                  {bundles.map((bundle) => (
                    <SelectItem key={bundle.id} value={bundle.id}>
                      {bundle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Площадка по умолчанию</Label>
              <Select
                value={defaultPlatformId || undefined}
                onValueChange={setDefaultPlatformId}
                disabled={saving}
              >
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue placeholder="Площадка" />
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
              <Label>Формат по умолчанию</Label>
              <Select
                value={defaultFormatId || undefined}
                onValueChange={setDefaultFormatId}
                disabled={saving}
              >
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
              <Label>Ответственный по умолчанию</Label>
              <Select
                value={defaultResponsibleId || undefined}
                onValueChange={setDefaultResponsibleId}
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

          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
            <p className="font-medium text-foreground">Пример</p>
            <pre className="mt-1 whitespace-pre-wrap font-mono text-2xs">
              {SAMPLE_IMPORT}
            </pre>
          </div>

          <Textarea
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            placeholder="Дата | Тема | Канал | Формат | Статус | Ответственный | Рубрика | Нозология | Текст | Примечания"
            className="min-h-44 border-border/70 bg-muted/20 text-sm"
            disabled={saving}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Готово к созданию: {preview.validRows.length}
              </div>
            </div>
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                С ошибками: {preview.invalidRows.length}
              </div>
            </div>
          </div>

          {preview.rows.length > 0 ? (
            <div className="space-y-2">
              {preview.rows.map((row) => (
                <ImportRowPreview
                  key={`${row.lineNumber}-${row.raw}`}
                  row={row}
                  bundleNames={bundleNames}
                  platformNames={platformNames}
                  formatNames={formatNames}
                  memberNames={memberNames}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-border/70 bg-muted/10 px-3 py-4 text-center text-sm text-muted-foreground">
              Вставьте строки, чтобы увидеть предпросмотр.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canImport}
            onClick={() => void handleImport()}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Импортировать план
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
