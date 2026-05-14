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
  CF_BUNDLE_STATUS_LABELS,
  CF_BUNDLE_STATUSES,
  CF_PRODUCT_STREAM_LABELS,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFBundleStatus,
  CFFunnelTemplate,
  CFProductStream,
  TeamMember,
} from "@/lib/types";

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function sourceRefsToText(refs: unknown[]): string {
  return refs.map((ref) => String(ref)).join("\n");
}

function textToRefs(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function ContentFactoryBundleDialog({
  open,
  onOpenChange,
  bundle,
  members,
  funnelTemplates,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle?: CFBundle | null;
  members: TeamMember[];
  funnelTemplates: CFFunnelTemplate[];
  onSaved: (bundle: CFBundle) => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const [name, setName] = useState("");
  const [productStream, setProductStream] =
    useState<CFProductStream>("onco_school");
  const [status, setStatus] = useState<CFBundleStatus>("planning");
  const [ownerId, setOwnerId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [funnelTemplateId, setFunnelTemplateId] = useState("none");
  const [brief, setBrief] = useState("");
  const [sourceRefsText, setSourceRefsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeMembers = members.filter((member) => member.is_active);
  const activeTemplates = funnelTemplates.filter((template) => template.is_active);
  const editing = Boolean(bundle);
  const productStreamOptions = Object.entries(CF_PRODUCT_STREAM_LABELS) as Array<
    [CFProductStream, string]
  >;

  useEffect(() => {
    if (!open) return;
    setName(bundle?.name ?? "");
    setProductStream(bundle?.product_stream ?? "onco_school");
    setStatus(bundle?.status ?? "planning");
    setOwnerId(bundle?.owner_id ?? activeMembers[0]?.id ?? "");
    setEventDate(toDateInputValue(bundle?.event_date));
    setFunnelTemplateId(bundle?.funnel_template_id ?? "none");
    setBrief(bundle?.brief ?? "");
    setSourceRefsText(sourceRefsToText(bundle?.source_material_refs ?? []));
    setError(null);
  }, [activeMembers, bundle, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Введите название кампании");
      return;
    }
    if (!ownerId) {
      setError("Выберите владельца");
      return;
    }

    const payload = {
      name: trimmedName,
      product_stream: productStream,
      status,
      owner_id: ownerId,
      event_date: eventDate ? new Date(`${eventDate}T00:00:00`).toISOString() : null,
      brief: brief.trim() || null,
      funnel_template_id: funnelTemplateId === "none" ? null : funnelTemplateId,
      source_material_refs: textToRefs(sourceRefsText),
    };

    setSaving(true);
    setError(null);
    try {
      const saved = bundle
        ? await api.updateCFBundle(bundle.id, payload)
        : await api.createCFBundle(payload);
      await onSaved(saved);
      onOpenChange(false);
      toastSuccess(editing ? "Кампания обновлена" : "Кампания создана");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось сохранить кампанию";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-1.5rem)] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {editing ? "Редактировать кампанию" : "Новая кампания"}
          </DialogTitle>
          <DialogDescription>
            Соберите кампанию: направление, владелец, дата, описание и исходные материалы.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-2">
            <Label htmlFor="cf-bundle-name">Название</Label>
            <Input
              id="cf-bundle-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-9 border-border/70 bg-muted/20"
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Поток</Label>
              <Select
                value={productStream}
                onValueChange={(value) => setProductStream(value as CFProductStream)}
                disabled={saving}
              >
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                  {productStreamOptions.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Статус</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as CFBundleStatus)}
                disabled={saving}
              >
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                  {CF_BUNDLE_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CF_BUNDLE_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Владелец</Label>
              <Select value={ownerId || undefined} onValueChange={setOwnerId} disabled={saving}>
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue placeholder="Выберите участника" />
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
            <div className="space-y-2">
              <Label htmlFor="cf-bundle-event-date">Дата события</Label>
              <Input
                id="cf-bundle-event-date"
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                className="h-9 border-border/70 bg-muted/20"
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Шаблон воронки</Label>
            <Select
              value={funnelTemplateId}
              onValueChange={setFunnelTemplateId}
              disabled={saving}
            >
              <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                <SelectItem value="none">Без шаблона</SelectItem>
                {activeTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-bundle-brief">Описание кампании</Label>
            <Textarea
              id="cf-bundle-brief"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              rows={4}
              className="min-h-[108px] resize-y border-border/70 bg-muted/20"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-bundle-source-refs">Исходные материалы</Label>
            <Textarea
              id="cf-bundle-source-refs"
              value={sourceRefsText}
              onChange={(event) => setSourceRefsText(event.target.value)}
              placeholder="Одна ссылка или заметка на строку"
              rows={3}
              className="min-h-[84px] resize-y border-border/70 bg-muted/20"
              disabled={saving}
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
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
