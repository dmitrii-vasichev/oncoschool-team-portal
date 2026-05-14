"use client";

import { Edit3, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CF_REFERENCE_TABLE_LABELS,
  getContentFactoryReferenceLabel,
  type ContentFactoryReferenceTableKey,
} from "@/lib/contentFactoryUtils";
import type {
  CFFunnelTemplate,
  CFFormat,
  CFNosology,
  CFPlatform,
  CFRubric,
} from "@/lib/types";

export type ContentFactoryReferenceRecord =
  | CFPlatform
  | CFFormat
  | CFRubric
  | CFNosology
  | CFFunnelTemplate;

type Props = {
  tableKey: ContentFactoryReferenceTableKey;
  records: ContentFactoryReferenceRecord[];
  isAdmin: boolean;
  deletingId?: string | null;
  onEdit: (record: ContentFactoryReferenceRecord) => void;
  onDelete: (record: ContentFactoryReferenceRecord) => void;
};

function detailText(
  tableKey: ContentFactoryReferenceTableKey,
  record: ContentFactoryReferenceRecord,
): string {
  if (tableKey === "platforms") {
    const platform = record as CFPlatform;
    const capabilityCount = Object.keys(platform.capabilities ?? {}).length;
    return `${capabilityCount} capability keys · order ${platform.display_order}`;
  }
  if (tableKey === "formats") {
    const format = record as CFFormat;
    const objective = format.default_objective?.trim() || "No objective";
    return `${objective} · ${format.requires_medical_review ? "medical review" : "no medical review"} · order ${format.display_order}`;
  }
  if (tableKey === "rubrics") {
    const rubric = record as CFRubric;
    return rubric.deprecated_at ? `Deprecated ${rubric.deprecated_at}` : "Active taxonomy row";
  }
  if (tableKey === "nosologies") {
    const nosology = record as CFNosology;
    return nosology.deprecated_at
      ? `Deprecated ${nosology.deprecated_at}`
      : "Active taxonomy row";
  }
  const template = record as CFFunnelTemplate;
  return `${template.template_publications?.length ?? 0} publication recipe items`;
}

export function ContentFactoryReferenceTable({
  tableKey,
  records,
  isAdmin,
  deletingId,
  onEdit,
  onDelete,
}: Props) {
  if (records.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
        <h2 className="text-sm font-semibold text-foreground">
          {CF_REFERENCE_TABLE_LABELS[tableKey]} are empty
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin users can add the first reference row from this workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] gap-3 border-b border-border/70 bg-muted/25 px-4 py-2 text-xs font-medium uppercase text-muted-foreground">
        <span>Code</span>
        <span>Details</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-border/60">
        {records.map((record) => (
          <div
            key={record.id}
            className="grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-muted/20 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto]"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground">
                  {record.code}
                </code>
                <Badge
                  variant="outline"
                  className={
                    record.is_active
                      ? "border-status-done-fg/30 bg-status-done-bg text-status-done-fg"
                      : "border-muted-foreground/20 bg-muted text-muted-foreground"
                  }
                >
                  {record.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="truncate text-sm font-semibold text-foreground">
                {getContentFactoryReferenceLabel(record)}
              </p>
            </div>

            <p className="min-w-0 self-center text-sm leading-6 text-muted-foreground">
              {detailText(tableKey, record)}
            </p>

            <div className="flex items-center justify-end gap-1.5">
              {isAdmin ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(record)}
                    aria-label="Edit reference record"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(record)}
                    disabled={deletingId === record.id}
                    aria-label="Delete reference record"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Read-only</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
