"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CF_PUBLICATION_STATUS_LABELS,
  CF_PUBLICATION_STATUSES,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFFormat,
  CFPlatform,
  CFPublicationStatus,
  TeamMember,
} from "@/lib/types";

export interface ContentFactoryFilterValues {
  status: "all" | CFPublicationStatus;
  platform_id: string;
  format_id: string;
  responsible_id: string;
  bundle_id: string;
}

export const EMPTY_CONTENT_FACTORY_FILTERS: ContentFactoryFilterValues = {
  status: "all",
  platform_id: "",
  format_id: "",
  responsible_id: "",
  bundle_id: "",
};

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <span className="text-2xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label={label}
          className="h-8 w-full border-border/70 bg-background px-2.5 text-xs shadow-sm transition-colors hover:border-primary/30 focus:border-primary/40 focus:ring-primary/20"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[60] max-h-64 border-border/70 shadow-xl">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function hasActiveFilters(filters: ContentFactoryFilterValues): boolean {
  return (
    filters.status !== "all" ||
    Boolean(filters.platform_id) ||
    Boolean(filters.format_id) ||
    Boolean(filters.responsible_id) ||
    Boolean(filters.bundle_id)
  );
}

export function ContentFactoryFilters({
  filters,
  bundles,
  platforms,
  formats,
  members,
  onChange,
}: {
  filters: ContentFactoryFilterValues;
  bundles: CFBundle[];
  platforms: CFPlatform[];
  formats: CFFormat[];
  members: TeamMember[];
  onChange: (filters: ContentFactoryFilterValues) => void;
}) {
  const activeFilters = hasActiveFilters(filters);
  const statusOptions = CF_PUBLICATION_STATUSES.map((status) => ({
    value: status,
    label: CF_PUBLICATION_STATUS_LABELS[status],
  }));

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {activeFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onChange(EMPTY_CONTENT_FACTORY_FILTERS)}
          >
            <X className="h-3.5 w-3.5" />
            Сбросить
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <FilterSelect
          label="Статус"
          value={filters.status}
          onChange={(value) =>
            onChange({
              ...filters,
              status: value as ContentFactoryFilterValues["status"],
            })
          }
          options={[{ value: "all", label: "Все статусы" }, ...statusOptions]}
        />
        <FilterSelect
          label="Платформа"
          value={filters.platform_id || "all"}
          onChange={(value) =>
            onChange({ ...filters, platform_id: value === "all" ? "" : value })
          }
          options={[
            { value: "all", label: "Все платформы" },
            ...platforms.map((platform) => ({
              value: platform.id,
              label: platform.display_name,
            })),
          ]}
        />
        <FilterSelect
          label="Формат"
          value={filters.format_id || "all"}
          onChange={(value) =>
            onChange({ ...filters, format_id: value === "all" ? "" : value })
          }
          options={[
            { value: "all", label: "Все форматы" },
            ...formats.map((format) => ({
              value: format.id,
              label: format.display_name,
            })),
          ]}
        />
        <FilterSelect
          label="Ответственный"
          value={filters.responsible_id || "all"}
          onChange={(value) =>
            onChange({
              ...filters,
              responsible_id: value === "all" ? "" : value,
            })
          }
          options={[
            { value: "all", label: "Все ответственные" },
            ...members.map((member) => ({
              value: member.id,
              label: member.full_name,
            })),
          ]}
        />
        <FilterSelect
          label="Bundle"
          value={filters.bundle_id || "all"}
          onChange={(value) =>
            onChange({ ...filters, bundle_id: value === "all" ? "" : value })
          }
          options={[
            { value: "all", label: "Все bundles" },
            ...bundles.map((bundle) => ({
              value: bundle.id,
              label: bundle.name,
            })),
          ]}
        />
      </div>
    </div>
  );
}
