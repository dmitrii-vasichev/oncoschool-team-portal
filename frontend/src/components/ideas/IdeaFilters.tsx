"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IDEA_STATUS_TABS } from "@/lib/ideaUtils";
import { cn } from "@/lib/utils";
import type { Department, IdeaStatus, TeamMember } from "@/lib/types";

export interface IdeaFilterValues {
  status: "all" | IdeaStatus;
  review_owner_id: string;
  author_id: string;
  department_id: string;
}

export const EMPTY_IDEA_FILTERS: IdeaFilterValues = {
  status: "all",
  review_owner_id: "",
  author_id: "",
  department_id: "",
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

export function IdeaFilters({
  filters,
  members,
  departments,
  onChange,
}: {
  filters: IdeaFilterValues;
  members: TeamMember[];
  departments: Department[];
  onChange: (filters: IdeaFilterValues) => void;
}) {
  const memberOptions = members.map((member) => ({
    value: member.id,
    label: member.full_name,
  }));
  const departmentOptions = departments.map((department) => ({
    value: department.id,
    label: department.name,
  }));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex min-w-max items-center gap-1 rounded-lg bg-muted/70 p-1">
          {IDEA_STATUS_TABS.map((tab) => (
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

      <div className="grid gap-2 sm:grid-cols-3">
        <FilterSelect
          label="Ревьюер"
          value={filters.review_owner_id || "all"}
          onChange={(value) =>
            onChange({
              ...filters,
              review_owner_id: value === "all" ? "" : value,
            })
          }
          options={[
            { value: "all", label: "Все ответственные" },
            ...memberOptions,
          ]}
        />

        <FilterSelect
          label="Автор"
          value={filters.author_id || "all"}
          onChange={(value) =>
            onChange({ ...filters, author_id: value === "all" ? "" : value })
          }
          options={[
            { value: "all", label: "Все авторы" },
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
      </div>
    </div>
  );
}
