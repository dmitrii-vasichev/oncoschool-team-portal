"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
import type { CFConfidence, CFMetricSource, CFMetricWindow } from "@/lib/types";

const METRIC_WINDOWS: CFMetricWindow[] = ["3h", "24h", "72h", "7d", "final", "custom"];
const METRIC_SOURCES: CFMetricSource[] = [
  "manual",
  "api",
  "tgstat",
  "telemetr",
  "vk_api",
  "email_provider",
  "getcourse",
  "parser",
  "import",
];
const CONFIDENCES: CFConfidence[] = ["high", "medium", "low"];

const CONFIDENCE_LABELS: Record<CFConfidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseMetricValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (Number.isNaN(parsed)) {
    throw new Error("Metric value должен быть числом");
  }
  return parsed;
}

export function ContentFactoryMetricDialog({
  open,
  onOpenChange,
  publicationId,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicationId: string;
  onRecorded: () => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const [window, setWindow] = useState<CFMetricWindow>("24h");
  const [metricName, setMetricName] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [metricValueText, setMetricValueText] = useState("");
  const [source, setSource] = useState<CFMetricSource>("manual");
  const [sourceMethod, setSourceMethod] = useState("");
  const [confidence, setConfidence] = useState<CFConfidence>("medium");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWindow("24h");
    setMetricName("");
    setMetricValue("");
    setMetricValueText("");
    setSource("manual");
    setSourceMethod("");
    setConfidence("medium");
    setNote("");
    setError(null);
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanMetricName = metricName.trim();
    if (!cleanMetricName) {
      setError("Укажите metric name");
      return;
    }

    let parsedValue: number | null;
    try {
      parsedValue = parseMetricValue(metricValue);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Некорректное значение";
      setError(message);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.recordCFMetric(publicationId, {
        publication_id: publicationId,
        window,
        metric_name: cleanMetricName,
        metric_value: parsedValue,
        metric_value_text: nullableText(metricValueText),
        source,
        source_method: nullableText(sourceMethod),
        confidence,
        note: nullableText(note),
      });
      toastSuccess("Метрика сохранена");
      await onRecorded();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось сохранить метрику";
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
          <DialogTitle className="text-lg">Новая метрика</DialogTitle>
          <DialogDescription>
            Ручной срез результата: окно, источник, confidence и короткая заметка.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Window</Label>
              <Select
                value={window}
                onValueChange={(value) => setWindow(value as CFMetricWindow)}
                disabled={saving}
              >
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] border-border/70 shadow-xl">
                  {METRIC_WINDOWS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={source}
                onValueChange={(value) => setSource(value as CFMetricSource)}
                disabled={saving}
              >
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] border-border/70 shadow-xl">
                  {METRIC_SOURCES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Confidence</Label>
              <Select
                value={confidence}
                onValueChange={(value) => setConfidence(value as CFConfidence)}
                disabled={saving}
              >
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] border-border/70 shadow-xl">
                  {CONFIDENCES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {CONFIDENCE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="space-y-2">
              <Label>Metric name</Label>
              <Input
                value={metricName}
                onChange={(event) => setMetricName(event.target.value)}
                placeholder="views, clicks, registrations"
                className="h-9 border-border/70 bg-muted/20 text-sm"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                value={metricValue}
                onChange={(event) => setMetricValue(event.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="h-9 border-border/70 bg-muted/20 text-sm"
                disabled={saving}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Text value</Label>
              <Input
                value={metricValueText}
                onChange={(event) => setMetricValueText(event.target.value)}
                placeholder="optional"
                className="h-9 border-border/70 bg-muted/20 text-sm"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Source method</Label>
              <Input
                value={sourceMethod}
                onChange={(event) => setSourceMethod(event.target.value)}
                placeholder="manual export, dashboard screenshot"
                className="h-9 border-border/70 bg-muted/20 text-sm"
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-20 border-border/70 bg-muted/20 text-sm"
              disabled={saving}
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save metric
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
