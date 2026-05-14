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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import { CF_SEGMENT_SOURCE_LABELS } from "@/lib/contentFactoryUtils";
import type { CFExternalSegment, CFSegmentSource, TeamMember } from "@/lib/types";

const SEGMENT_SOURCES: CFSegmentSource[] = ["getcourse"];

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parsePopulation(value: string): number {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Population count must be a non-negative integer");
  }
  return parsed;
}

export function ContentFactorySegmentDialog({
  open,
  onOpenChange,
  members,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMember[];
  onCreated: (segment: CFExternalSegment) => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const [source, setSource] = useState<CFSegmentSource>("getcourse");
  const [sourceSegmentId, setSourceSegmentId] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [populationCount, setPopulationCount] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [ownerId, setOwnerId] = useState("none");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeMembers = useMemo(
    () => members.filter((member) => member.is_active),
    [members],
  );

  useEffect(() => {
    if (!open) return;
    setSource("getcourse");
    setSourceSegmentId("");
    setSourceUrl("");
    setName("");
    setDescription("");
    setPopulationCount("0");
    setIsActive(true);
    setOwnerId("none");
    setError(null);
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanSourceSegmentId = sourceSegmentId.trim();
    if (!cleanName) {
      setError("Name is required");
      return;
    }
    if (!cleanSourceSegmentId) {
      setError("Source segment ID is required");
      return;
    }

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
      const created = await api.createCFSegment({
        source,
        source_segment_id: cleanSourceSegmentId,
        source_url: nullableText(sourceUrl),
        name: cleanName,
        description: nullableText(description),
        population_count: parsedPopulation,
        is_active: isActive,
        owner_id: ownerId === "none" ? null : ownerId,
      });
      await onCreated(created);
      onOpenChange(false);
      toastSuccess("Segment created");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create segment";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-1.5rem)] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="text-lg">New segment mirror</DialogTitle>
          <DialogDescription>
            Add an external audience segment so publications can target it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={source}
                onValueChange={(value) => setSource(value as CFSegmentSource)}
                disabled={saving}
              >
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] border-border/70 shadow-xl">
                  {SEGMENT_SOURCES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {CF_SEGMENT_SOURCE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf-segment-source-id">source_segment_id</Label>
              <Input
                id="cf-segment-source-id"
                value={sourceSegmentId}
                onChange={(event) => setSourceSegmentId(event.target.value)}
                className="h-9 border-border/70 bg-muted/20"
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-segment-name">Name</Label>
            <Input
              id="cf-segment-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-9 border-border/70 bg-muted/20"
              disabled={saving}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cf-segment-population">population_count</Label>
              <Input
                id="cf-segment-population"
                type="number"
                min="0"
                step="1"
                value={populationCount}
                onChange={(event) => setPopulationCount(event.target.value)}
                className="h-9 border-border/70 bg-muted/20"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId} disabled={saving}>
                <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                  <SelectItem value="none">No owner</SelectItem>
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
            <Label htmlFor="cf-segment-source-url">Source URL</Label>
            <Input
              id="cf-segment-source-url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              className="h-9 border-border/70 bg-muted/20"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-segment-description">Description</Label>
            <Textarea
              id="cf-segment-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-20 border-border/70 bg-muted/20"
              disabled={saving}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label htmlFor="cf-segment-active" className="text-sm font-medium">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Inactive segments stay visible in the registry but are hidden from normal pickers.
              </p>
            </div>
            <Switch
              id="cf-segment-active"
              checked={isActive}
              onCheckedChange={setIsActive}
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
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create segment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
