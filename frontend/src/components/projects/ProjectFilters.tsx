"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROJECT_STATUS_LABELS } from "@/lib/projectUtils";
import { cn } from "@/lib/utils";
import type { Department, ProjectStatus, TeamMember } from "@/lib/types";

export interface ProjectFilterValues {
  status: "all" | ProjectStatus;
  search: string;
  owner_id: string;
  department_id: string;
  source_idea_id: string;
  created_from: string;
  created_to: string;
}

export const EMPTY_PROJECT_FILTERS: ProjectFilterValues = {
  status: "all",
  search: "",
  owner_id: "",
  department_id: "",
  source_idea_id: "",
  created_from: "",
  created_to: "",
};

const PROJECT_STATUS_TABS: Array<{
  value: ProjectFilterValues["status"];
  label: string;
}> = [
  { value: "all", label: "Все" },
  { value: "planned", label: PROJECT_STATUS_LABELS.planned },
  { value: "in_progress", label: PROJECT_STATUS_LABELS.in_progress },
  { value: "paused", label: PROJECT_STATUS_LABELS.paused },
  { value: "completed", label: PROJECT_STATUS_LABELS.completed },
  { value: "cancelled", label: PROJECT_STATUS_LABELS.cancelled },
];

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

function FilterTextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <span className="text-2xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 border-border/70 bg-background px-2.5 text-xs shadow-sm transition-colors placeholder:text-muted-foreground/70 hover:border-primary/30 focus:border-primary/40 focus:ring-primary/20"
      />
    </div>
  );
}

function hasActiveFilters(filters: ProjectFilterValues): boolean {
  return (
    filters.status !== "all" ||
    Boolean(filters.search.trim()) ||
    Boolean(filters.owner_id) ||
    Boolean(filters.department_id) ||
    Boolean(filters.source_idea_id.trim()) ||
    Boolean(filters.created_from.trim()) ||
    Boolean(filters.created_to.trim())
  );
}

export function ProjectFilters({
  filters,
  members,
  departments,
  onChange,
}: {
  filters: ProjectFilterValues;
  members: TeamMember[];
  departments: Department[];
  onChange: (filters: ProjectFilterValues) => void;
}) {
  const memberOptions = members.map((member) => ({
    value: member.id,
    label: member.full_name,
  }));
  const departmentOptions = departments.map((department) => ({
    value: department.id,
    label: department.name,
  }));
  const activeFilters = hasActiveFilters(filters);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex min-w-max items-center gap-1 rounded-lg bg-muted/70 p-1">
            {PROJECT_STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => onChange({ ...filters, status: tab.value })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  filters.status === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(EMPTY_PROJECT_FILTERS)}
            className="h-8 w-full justify-center gap-1.5 rounded-md px-2 text-xs sm:w-auto"
          >
            <X className="h-3.5 w-3.5" />
            Сбросить
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <FilterTextInput
          label="Поиск"
          value={filters.search}
          onChange={(value) => onChange({ ...filters, search: value })}
          placeholder="Название или описание"
        />

        <FilterSelect
          label="Владелец"
          value={filters.owner_id || "all"}
          onChange={(value) =>
            onChange({ ...filters, owner_id: value === "all" ? "" : value })
          }
          options={[
            { value: "all", label: "Все владельцы" },
            ...memberOptions,
          ]}
        />

        <FilterSelect
          label="Отдел"
          value={filters.department_id || "all"}
          onChange={(value) =>
            onChange({
              ...filters,
              department_id: value === "all" ? "" : value,
            })
          }
          options={[
            { value: "all", label: "Все отделы" },
            ...departmentOptions,
          ]}
        />

        <FilterTextInput
          label="ID идеи"
          value={filters.source_idea_id}
          onChange={(value) => onChange({ ...filters, source_idea_id: value })}
          placeholder="Источник"
        />

        <FilterTextInput
          label="Создан с"
          value={filters.created_from}
          onChange={(value) => onChange({ ...filters, created_from: value })}
          placeholder="YYYY-MM-DD"
        />

        <FilterTextInput
          label="Создан до"
          value={filters.created_to}
          onChange={(value) => onChange({ ...filters, created_to: value })}
          placeholder="YYYY-MM-DD"
        />
      </div>
    </div>
  );
}
