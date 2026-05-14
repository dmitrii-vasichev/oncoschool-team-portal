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
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import { formatContentFactorySegmentCount } from "@/lib/contentFactoryUtils";
import type { CFExternalSegment } from "@/lib/types";

function parsePopulation(value: string): number {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Population count must be a non-negative integer");
  }
  return parsed;
}

export function ContentFactorySegmentRefreshDialog({
  open,
  onOpenChange,
  segment,
  onRefreshed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: CFExternalSegment | null;
  onRefreshed: (segment: CFExternalSegment) => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const [populationCount, setPopulationCount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPopulationCount(segment ? String(segment.population_count) : "");
    setError(null);
  }, [open, segment]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!segment) return;

    let parsedPopulation: number;
    try {
      parsedPopulation = parsePopulation(populationCount);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid population count";
      setError(message);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const refreshed = await api.refreshCFSegment(segment.id, {
        population_count: parsedPopulation,
      });
      await onRefreshed(refreshed);
      onOpenChange(false);
      toastSuccess("Segment population refreshed");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to refresh segment";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Refresh population</DialogTitle>
          <DialogDescription>
            {segment
              ? `${segment.name}: current ${formatContentFactorySegmentCount(segment.population_count)}`
              : "Record a new segment population snapshot."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-2">
            <Label htmlFor="cf-segment-refresh-population">population_count</Label>
            <Input
              id="cf-segment-refresh-population"
              type="number"
              min="0"
              step="1"
              value={populationCount}
              onChange={(event) => setPopulationCount(event.target.value)}
              className="h-9 border-border/70 bg-muted/20"
              disabled={saving}
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !segment}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record snapshot
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
