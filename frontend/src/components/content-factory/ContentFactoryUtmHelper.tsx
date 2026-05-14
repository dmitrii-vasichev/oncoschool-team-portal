"use client";

import { useEffect, useMemo, useState } from "react";
import { Clipboard, Loader2, Sparkles } from "lucide-react";
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
  buildContentFactoryUtm,
  getContentFactoryDisplayName,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFExternalSegment,
  CFFormat,
  CFPlatform,
  CFPublication,
  CFPublicationSegmentTarget,
} from "@/lib/types";

function JsonBlock({ value }: { value: Record<string, unknown> }) {
  return (
    <pre className="max-h-40 overflow-auto rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function ContentFactoryUtmHelper({
  publication,
  bundle,
  platforms,
  formats,
  segments,
  segmentTargets,
  onApplied,
}: {
  publication: CFPublication;
  bundle: CFBundle | null;
  platforms: CFPlatform[];
  formats: CFFormat[];
  segments: CFExternalSegment[];
  segmentTargets: CFPublicationSegmentTarget[];
  onApplied: () => void | Promise<void>;
}) {
  const { toastSuccess, toastError } = useToast();
  const [selectedSegmentId, setSelectedSegmentId] = useState("none");
  const [cta, setCta] = useState("");
  const [saving, setSaving] = useState(false);

  const targetedSegmentIds = useMemo(
    () => segmentTargets.map((target) => target.external_segment_id),
    [segmentTargets],
  );
  const platform = platforms.find((item) => item.id === publication.platform_id);
  const format = formats.find((item) => item.id === publication.format_id);
  const generatedUtm = useMemo(
    () =>
      buildContentFactoryUtm({
        bundleId: bundle?.id ?? publication.bundle_id,
        publicationId: publication.id,
        platformCode: platform?.code ?? platform?.display_name ?? "platform",
        formatCode: format?.code ?? format?.display_name ?? "format",
        segmentId: selectedSegmentId === "none" ? null : selectedSegmentId,
        cta,
      }),
    [
      bundle?.id,
      cta,
      format?.code,
      format?.display_name,
      platform?.code,
      platform?.display_name,
      publication.bundle_id,
      publication.id,
      selectedSegmentId,
    ],
  );

  useEffect(() => {
    if (selectedSegmentId !== "none" && targetedSegmentIds.includes(selectedSegmentId)) {
      return;
    }
    setSelectedSegmentId(targetedSegmentIds[0] ?? "none");
  }, [selectedSegmentId, targetedSegmentIds]);

  async function handleApply() {
    setSaving(true);
    try {
      await api.updateCFPublication(publication.id, { utm: generatedUtm });
      toastSuccess("UTM применён");
      await onApplied();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Не удалось применить UTM");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(JSON.stringify(generatedUtm, null, 2));
    toastSuccess("UTM скопирован");
  }

  return (
    <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">UTM helper</h2>
      </div>

      <div className="mt-3 space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Segment</Label>
          <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
            <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
              <SelectItem value="none">Без segment term</SelectItem>
              {targetedSegmentIds.map((segmentId) => (
                <SelectItem key={segmentId} value={segmentId}>
                  {getContentFactoryDisplayName(segmentId, segments)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">CTA marker</Label>
          <Input
            value={cta}
            onChange={(event) => setCta(event.target.value)}
            placeholder="register, read_more"
            className="h-9 border-border/70 bg-muted/20 text-sm"
            disabled={saving}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Generated
          </p>
          <JsonBlock value={generatedUtm} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Current
          </p>
          <JsonBlock value={publication.utm} />
        </div>

        <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-10"
            onClick={() => void handleCopy()}
          >
            <Clipboard className="h-3.5 w-3.5" />
            <span className="sr-only">Copy UTM</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 rounded-md px-3 text-xs"
            disabled={saving}
            onClick={() => void handleApply()}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Apply to publication
          </Button>
        </div>
      </div>
    </section>
  );
}
