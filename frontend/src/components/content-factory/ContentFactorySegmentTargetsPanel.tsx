"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
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
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import {
  getAvailableContentFactorySegments,
  getContentFactoryDisplayName,
} from "@/lib/contentFactoryUtils";
import type {
  CFExternalSegment,
  CFPublicationSegmentTarget,
  CFSegmentRole,
} from "@/lib/types";

const SEGMENT_ROLE_LABELS: Record<CFSegmentRole, string> = {
  target: "Целевая",
  exclusion: "Исключение",
  control: "Контроль",
  retargeting: "Ретаргетинг",
};

const SEGMENT_ROLES = Object.keys(SEGMENT_ROLE_LABELS) as CFSegmentRole[];

function formatCount(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU").format(value).replace(/\u00a0/g, " ");
}

export function ContentFactorySegmentTargetsPanel({
  publicationId,
  segments,
  targets,
  onChanged,
}: {
  publicationId: string;
  segments: CFExternalSegment[];
  targets: CFPublicationSegmentTarget[];
  onChanged: () => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [role, setRole] = useState<CFSegmentRole>("target");
  const [expectedCount, setExpectedCount] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingSegmentId, setRemovingSegmentId] = useState<string | null>(null);

  const availableSegments = useMemo(
    () => getAvailableContentFactorySegments(segments, targets),
    [segments, targets],
  );
  const segmentNames = useMemo(
    () => new Map(segments.map((segment) => [segment.id, segment.name])),
    [segments],
  );

  useEffect(() => {
    if (availableSegments.length === 0) {
      if (selectedSegmentId) setSelectedSegmentId("");
      return;
    }
    if (availableSegments.some((segment) => segment.id === selectedSegmentId)) {
      return;
    }
    setSelectedSegmentId(availableSegments[0].id);
  }, [availableSegments, selectedSegmentId]);

  async function handleAddTarget() {
    const externalSegmentId = selectedSegmentId || availableSegments[0]?.id;
    if (!externalSegmentId) return;
    const parsedExpected = expectedCount.trim()
      ? Number(expectedCount.replace(",", "."))
      : null;
    if (parsedExpected !== null && Number.isNaN(parsedExpected)) {
      toastError("Expected count должен быть числом");
      return;
    }

    setAdding(true);
    try {
      await api.addCFPublicationSegmentTarget(publicationId, {
        external_segment_id: externalSegmentId,
        role,
        expected_count: parsedExpected,
      });
      setExpectedCount("");
      toastSuccess("Сегмент добавлен");
      await onChanged();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Не удалось добавить сегмент");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveTarget(externalSegmentId: string) {
    setRemovingSegmentId(externalSegmentId);
    try {
      await api.removeCFPublicationSegmentTarget(publicationId, externalSegmentId);
      toastSuccess("Сегмент удалён");
      await onChanged();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Не удалось удалить сегмент");
    } finally {
      setRemovingSegmentId(null);
    }
  }

  return (
    <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Segments</h2>
      </div>

      <div className="mt-3 space-y-3">
        {targets.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            Сегменты для публикации ещё не выбраны.
          </p>
        ) : (
          <div className="space-y-2">
            {targets.map((target) => (
              <div
                key={target.external_segment_id}
                className="rounded-md border border-border/60 bg-background px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {segmentNames.get(target.external_segment_id) ??
                        getContentFactoryDisplayName(target.external_segment_id, [])}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {SEGMENT_ROLE_LABELS[target.role]} · expected{" "}
                      {formatCount(target.expected_count)} · actual{" "}
                      {formatCount(target.actual_count_at_send)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={removingSegmentId === target.external_segment_id}
                    onClick={() => void handleRemoveTarget(target.external_segment_id)}
                  >
                    {removingSegmentId === target.external_segment_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    <span className="sr-only">Remove segment</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border-t border-border/60 pt-3">
          <Label className="text-xs">Добавить сегмент</Label>
          <Select
            value={selectedSegmentId || undefined}
            onValueChange={setSelectedSegmentId}
            disabled={availableSegments.length === 0 || adding}
          >
            <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
              <SelectValue placeholder="Сегмент" />
            </SelectTrigger>
            <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
              {availableSegments.map((segment) => (
                <SelectItem key={segment.id} value={segment.id}>
                  {segment.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
            <Select
              value={role}
              onValueChange={(value) => setRole(value as CFSegmentRole)}
              disabled={adding}
            >
              <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[70] border-border/70 shadow-xl">
                {SEGMENT_ROLES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {SEGMENT_ROLE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={expectedCount}
              onChange={(event) => setExpectedCount(event.target.value)}
              type="number"
              min="0"
              placeholder="count"
              className="h-9 border-border/70 bg-muted/20 text-sm"
              disabled={adding}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 w-full gap-1.5 rounded-md px-3 text-xs"
            disabled={availableSegments.length === 0 || adding}
            onClick={() => void handleAddTarget()}
          >
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add segment
          </Button>
        </div>
      </div>
    </section>
  );
}
