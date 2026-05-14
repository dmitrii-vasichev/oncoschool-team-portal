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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import {
  CF_REFERENCE_TABLE_LABELS,
  type ContentFactoryReferenceTableKey,
} from "@/lib/contentFactoryUtils";
import type {
  CFJsonObject,
} from "@/lib/types";
import type { ContentFactoryReferenceRecord } from "./ContentFactoryReferenceTable";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableKey: ContentFactoryReferenceTableKey;
  record?: ContentFactoryReferenceRecord | null;
  onSaved: (record: ContentFactoryReferenceRecord) => void | Promise<void>;
};

function toJsonText(value: unknown, fallback: unknown): string {
  return JSON.stringify(value ?? fallback, null, 2);
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isJsonObject(value: unknown): value is CFJsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseJsonObject(label: string, value: string): CFJsonObject {
  const parsed = JSON.parse(value || "{}") as unknown;
  if (!isJsonObject(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed;
}

function parseJsonArray(label: string, value: string): unknown[] {
  const parsed = JSON.parse(value || "[]") as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array`);
  }
  return parsed;
}

function hasDisplayName(
  record: ContentFactoryReferenceRecord | null | undefined,
): record is ContentFactoryReferenceRecord & { display_name: string } {
  return Boolean(record && "display_name" in record);
}

export function ContentFactoryReferenceDialog({
  open,
  onOpenChange,
  tableKey,
  record,
  onSaved,
}: Props) {
  const { toastSuccess, toastError } = useToast();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultObjective, setDefaultObjective] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [requiresMedicalReview, setRequiresMedicalReview] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [capabilities, setCapabilities] = useState("{}");
  const [templatePublications, setTemplatePublications] = useState("[]");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(record);
  const tableLabel = CF_REFERENCE_TABLE_LABELS[tableKey];

  useEffect(() => {
    if (!open) return;
    setCode(record?.code ?? "");
    setDisplayName(hasDisplayName(record) ? record.display_name : "");
    setName(record && "name" in record ? record.name : "");
    setDescription(record && "description" in record ? (record.description ?? "") : "");
    setDefaultObjective(
      record && "default_objective" in record ? (record.default_objective ?? "") : "",
    );
    setDisplayOrder(
      record && "display_order" in record ? String(record.display_order) : "0",
    );
    setRequiresMedicalReview(
      record && "requires_medical_review" in record
        ? record.requires_medical_review
        : false,
    );
    setIsActive(record?.is_active ?? true);
    setCapabilities(
      toJsonText(record && "capabilities" in record ? record.capabilities : {}, {}),
    );
    setTemplatePublications(
      toJsonText(
        record && "template_publications" in record
          ? record.template_publications
          : [],
        [],
      ),
    );
    setError(null);
  }, [open, record]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && saving) return;
    onOpenChange(nextOpen);
  }

  function validateBaseFields() {
    if (!editing && !code.trim()) {
      throw new Error("Code is required");
    }
    if (tableKey === "funnel_templates") {
      if (!name.trim()) throw new Error("Name is required");
    } else if (!displayName.trim()) {
      throw new Error("Display name is required");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    let saved: ContentFactoryReferenceRecord;
    try {
      validateBaseFields();
      setSaving(true);
      setError(null);

      if (tableKey === "platforms") {
        const parsedCapabilities = parseJsonObject("capabilities", capabilities);
        const payload = {
          display_name: displayName.trim(),
          is_active: isActive,
          capabilities: parsedCapabilities,
          display_order: Number(displayOrder || "0"),
        };
        saved = record
          ? await api.updateCFPlatform(record.id, payload)
          : await api.createCFPlatform({ code: code.trim(), ...payload });
      } else if (tableKey === "formats") {
        const payload = {
          display_name: displayName.trim(),
          default_objective: nullableText(defaultObjective),
          requires_medical_review: requiresMedicalReview,
          is_active: isActive,
          display_order: Number(displayOrder || "0"),
        };
        saved = record
          ? await api.updateCFFormat(record.id, payload)
          : await api.createCFFormat({ code: code.trim(), ...payload });
      } else if (tableKey === "rubrics") {
        const payload = {
          display_name: displayName.trim(),
          is_active: isActive,
        };
        saved = record
          ? await api.updateCFRubric(record.id, payload)
          : await api.createCFRubric({ code: code.trim(), ...payload });
      } else if (tableKey === "nosologies") {
        const payload = {
          display_name: displayName.trim(),
          is_active: isActive,
        };
        saved = record
          ? await api.updateCFNosology(record.id, payload)
          : await api.createCFNosology({ code: code.trim(), ...payload });
      } else {
        const parsedPublications = parseJsonArray(
          "template_publications",
          templatePublications,
        );
        const payload = {
          name: name.trim(),
          description: nullableText(description),
          template_publications: parsedPublications,
          is_active: isActive,
        };
        saved = record
          ? await api.updateCFFunnelTemplate(record.id, payload)
          : await api.createCFFunnelTemplate({ code: code.trim(), ...payload });
      }

      await onSaved(saved);
      onOpenChange(false);
      toastSuccess(editing ? "Reference updated" : "Reference created");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save reference record";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  const showDisplayName = tableKey !== "funnel_templates";
  const showFormatFields = tableKey === "formats";
  const showDisplayOrder = tableKey === "platforms" || tableKey === "formats";
  const showCapabilities = tableKey === "platforms";
  const showTemplatePublications = tableKey === "funnel_templates";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-1.5rem)] overflow-y-auto sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {editing ? `Edit ${tableLabel}` : `New ${tableLabel}`}
          </DialogTitle>
          <DialogDescription>
            Keep Content Factory dictionaries aligned with the current workflow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cf-reference-code">Code</Label>
              <Input
                id="cf-reference-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="h-9 border-border/70 bg-muted/20"
                disabled={saving || editing}
              />
            </div>
            {showDisplayName ? (
              <div className="space-y-2">
                <Label htmlFor="cf-reference-display-name">Display name</Label>
                <Input
                  id="cf-reference-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="h-9 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="cf-reference-name">Name</Label>
                <Input
                  id="cf-reference-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-9 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {showDisplayOrder && (
              <div className="space-y-2">
                <Label htmlFor="cf-reference-display-order">Display order</Label>
                <Input
                  id="cf-reference-display-order"
                  type="number"
                  value={displayOrder}
                  onChange={(event) => setDisplayOrder(event.target.value)}
                  className="h-9 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
            )}
            {showFormatFields && (
              <div className="space-y-2">
                <Label htmlFor="cf-reference-default-objective">
                  Default objective
                </Label>
                <Input
                  id="cf-reference-default-objective"
                  value={defaultObjective}
                  onChange={(event) => setDefaultObjective(event.target.value)}
                  className="h-9 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
            )}
            {showTemplatePublications && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="cf-reference-description">Description</Label>
                <Textarea
                  id="cf-reference-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-20 border-border/70 bg-muted/20"
                  disabled={saving}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label htmlFor="cf-reference-active" className="text-sm font-medium">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Inactive records stay visible here and disappear from normal pickers.
              </p>
            </div>
            <Switch
              id="cf-reference-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={saving}
            />
          </div>

          {showFormatFields && (
            <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label
                  htmlFor="cf-reference-medical-review"
                  className="text-sm font-medium"
                >
                  Requires medical review
                </Label>
                <p className="text-xs text-muted-foreground">
                  Use for formats that need doctor approval before scheduling.
                </p>
              </div>
              <Switch
                id="cf-reference-medical-review"
                checked={requiresMedicalReview}
                onCheckedChange={setRequiresMedicalReview}
                disabled={saving}
              />
            </div>
          )}

          {showCapabilities && (
            <div className="space-y-2">
              <Label htmlFor="cf-reference-capabilities">capabilities</Label>
              <Textarea
                id="cf-reference-capabilities"
                value={capabilities}
                onChange={(event) => setCapabilities(event.target.value)}
                className="min-h-36 border-border/70 bg-muted/20 font-mono text-xs"
                disabled={saving}
              />
            </div>
          )}

          {showTemplatePublications && (
            <div className="space-y-2">
              <Label htmlFor="cf-reference-template-publications">
                template_publications
              </Label>
              <Textarea
                id="cf-reference-template-publications"
                value={templatePublications}
                onChange={(event) => setTemplatePublications(event.target.value)}
                className="min-h-44 border-border/70 bg-muted/20 font-mono text-xs"
                disabled={saving}
              />
            </div>
          )}

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
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
