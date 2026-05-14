"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/api";
import { CF_RETRO_TYPE_LABELS } from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFJsonObject,
  CFRetroNote,
  CFRetroType,
  TeamMember,
} from "@/lib/types";

const RETRO_TYPES: CFRetroType[] = ["weekly", "monthly", "bundle", "adhoc"];

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readableValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function linesFromValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => readableValue(item).trim())
      .filter(Boolean);
  }
  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const notes = objectValue.notes;
    if (Array.isArray(notes)) {
      return notes
        .map((item) => readableValue(item).trim())
        .filter(Boolean);
    }
    return Object.entries(objectValue)
      .flatMap(([key, item]) => {
        if (Array.isArray(item)) {
          return item.map((entry) => `${key}: ${readableValue(entry)}`);
        }
        const text = readableValue(item);
        return text ? [`${key}: ${text}`] : [];
      })
      .map((line) => line.trim())
      .filter(Boolean);
  }
  const text = readableValue(value).trim();
  return text ? [text] : [];
}

function textFromValue(value: unknown): string {
  return linesFromValue(value).join("\n");
}

function linesFromText(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function objectFromText(value: string): CFJsonObject {
  const notes = linesFromText(value);
  return notes.length > 0 ? { notes } : {};
}

export function ContentFactoryRetroDialog({
  open,
  onOpenChange,
  retro,
  bundles,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retro?: CFRetroNote | null;
  bundles: CFBundle[];
  members: TeamMember[];
  onSaved: (retro: CFRetroNote) => void | Promise<void>;
}) {
  const { user } = useCurrentUser();
  const { toastSuccess, toastError } = useToast();
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [retroType, setRetroType] = useState<CFRetroType>("weekly");
  const [bundleId, setBundleId] = useState("none");
  const [facilitatorId, setFacilitatorId] = useState("");
  const [bestByObjectiveText, setBestByObjectiveText] = useState("");
  const [brokenText, setBrokenText] = useState("");
  const [learningsText, setLearningsText] = useState("");
  const [decisionsText, setDecisionsText] = useState("");
  const [actionsText, setActionsText] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(retro);
  const activeMembers = useMemo(
    () => members.filter((member) => member.is_active),
    [members],
  );
  const activeBundles = useMemo(
    () => bundles.filter((bundle) => bundle.status !== "archived"),
    [bundles],
  );

  useEffect(() => {
    if (!open) return;
    const defaultDate = todayInputValue();
    setPeriodStart(toDateInputValue(retro?.period_start) || defaultDate);
    setPeriodEnd(toDateInputValue(retro?.period_end) || defaultDate);
    setRetroType(retro?.retro_type ?? "weekly");
    setBundleId(retro?.bundle_id ?? "none");
    setFacilitatorId(retro?.facilitator_id ?? user?.id ?? activeMembers[0]?.id ?? "");
    setBestByObjectiveText(textFromValue(retro?.best_by_objective));
    setBrokenText(textFromValue(retro?.broken));
    setLearningsText(textFromValue(retro?.learnings));
    setDecisionsText(textFromValue(retro?.decisions));
    setActionsText(textFromValue(retro?.actions));
    setNotes(retro?.notes ?? "");
    setError(null);
  }, [activeMembers, open, retro, user?.id]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!periodStart || !periodEnd) {
      setError("Укажите период ретроспективы");
      return;
    }
    if (!facilitatorId) {
      setError("Выберите фасилитатора");
      return;
    }

    const best_by_objective = objectFromText(bestByObjectiveText);
    const broken = linesFromText(brokenText);
    const learnings = objectFromText(learningsText);
    const decisions = objectFromText(decisionsText);
    const actions = linesFromText(actionsText);

    setSaving(true);
    setError(null);
    try {
      const saved = retro
        ? await api.updateCFRetro(retro.id, {
            best_by_objective,
            broken,
            learnings,
            decisions,
            actions,
            notes: nullableText(notes),
          })
        : await api.createCFRetro({
            period_start: periodStart,
            period_end: periodEnd,
            retro_type: retroType,
            bundle_id: bundleId === "none" ? null : bundleId,
            facilitator_id: facilitatorId,
            best_by_objective,
            broken,
            learnings,
            decisions,
            actions,
            notes: nullableText(notes),
          });
      await onSaved(saved);
      onOpenChange(false);
      toastSuccess(editing ? "Ретро обновлено" : "Ретро создано");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось сохранить ретро";
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
            {editing ? "Редактировать ретроспективу" : "Новая ретроспектива"}
          </DialogTitle>
          <DialogDescription>
            Зафиксируйте лучшие связки, сбои, решения и следующие действия команды.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cf-retro-period-start">Начало периода</Label>
              <Input
                id="cf-retro-period-start"
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                className="h-9 border-border/70 bg-muted/20"
                disabled={saving || editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-retro-period-end">Конец периода</Label>
              <Input
                id="cf-retro-period-end"
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                className="h-9 border-border/70 bg-muted/20"
                disabled={saving || editing}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Формат ретроспективы</Label>
              <Select
                value={retroType}
                onValueChange={(value) => setRetroType(value as CFRetroType)}
                disabled={saving || editing}
              >
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] border-border/70 shadow-xl">
                  {RETRO_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {CF_RETRO_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Кампания</Label>
              <Select value={bundleId} onValueChange={setBundleId} disabled={saving || editing}>
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                  <SelectItem value="none">Без кампании</SelectItem>
                  {activeBundles.map((bundle) => (
                    <SelectItem key={bundle.id} value={bundle.id}>
                      {bundle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Фасилитатор</Label>
              <Select
                value={facilitatorId || undefined}
                onValueChange={setFacilitatorId}
                disabled={saving || editing}
              >
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-retro-best-by-objective">Что сработало</Label>
            <Textarea
              id="cf-retro-best-by-objective"
              value={bestByObjectiveText}
              onChange={(event) => setBestByObjectiveText(event.target.value)}
              placeholder="Одна мысль на строку: удачные связки, каналы, форматы, офферы, решения команды."
              rows={5}
              className="min-h-[120px] resize-y border-border/70 bg-muted/20 text-sm"
              disabled={saving}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cf-retro-broken">Что сломалось</Label>
              <Textarea
                id="cf-retro-broken"
                value={brokenText}
                onChange={(event) => setBrokenText(event.target.value)}
                placeholder="Сбои, задержки, спорные места, всё, что мешало выпуску."
                rows={5}
                className="min-h-[120px] resize-y border-border/70 bg-muted/20 text-sm"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-retro-actions">Следующие действия</Label>
              <Textarea
                id="cf-retro-actions"
                value={actionsText}
                onChange={(event) => setActionsText(event.target.value)}
                placeholder="Конкретные шаги: кто, что делает, что проверяем дальше."
                rows={5}
                className="min-h-[120px] resize-y border-border/70 bg-muted/20 text-sm"
                disabled={saving}
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cf-retro-learnings">Выводы</Label>
              <Textarea
                id="cf-retro-learnings"
                value={learningsText}
                onChange={(event) => setLearningsText(event.target.value)}
                placeholder="Что поняли про аудиторию, контент, процесс или измерение результата."
                rows={5}
                className="min-h-[120px] resize-y border-border/70 bg-muted/20 text-sm"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-retro-decisions">Решения</Label>
              <Textarea
                id="cf-retro-decisions"
                value={decisionsText}
                onChange={(event) => setDecisionsText(event.target.value)}
                placeholder="Что меняем в правилах, шаблонах, сроках, каналах или ответственности."
                rows={5}
                className="min-h-[120px] resize-y border-border/70 bg-muted/20 text-sm"
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-retro-notes">Дополнительные заметки</Label>
            <Textarea
              id="cf-retro-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Контекст, который важно сохранить целиком."
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

          <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
