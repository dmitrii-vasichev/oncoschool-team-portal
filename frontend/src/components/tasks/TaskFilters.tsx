"use client";

import { useState } from "react";
import { Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { TaskPriority, TaskSource } from "@/lib/types";
import { TASK_PRIORITY_LABELS, TASK_SOURCE_LABELS } from "@/lib/types";
import type { TeamMember } from "@/lib/types";

export interface TaskFilterValues {
  search: string;
  priority: string;
  source: string;
  assignee_id: string;
}

const EMPTY_FILTERS: TaskFilterValues = {
  search: "",
  priority: "",
  source: "",
  assignee_id: "",
};

const PRIORITY_DOT_COLORS: Record<string, string> = {
  urgent: "bg-priority-urgent-dot",
  high: "bg-priority-high-dot",
  medium: "bg-priority-medium-dot",
  low: "bg-priority-low-dot",
};

const SOURCE_ICONS: Record<string, string> = {
  text: "📝",
  voice: "🎤",
  summary: "📋",
  web: "🌐",
};

interface ActiveFilter {
  key: keyof TaskFilterValues;
  label: string;
}

export function TaskFilters({
  filters,
  onFiltersChange,
  members,
}: {
  filters: TaskFilterValues;
  onFiltersChange: (filters: TaskFilterValues) => void;
  members: TeamMember[];
}) {
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  const activeFilters: ActiveFilter[] = [];
  if (filters.priority) {
    activeFilters.push({
      key: "priority",
      label: TASK_PRIORITY_LABELS[filters.priority as TaskPriority],
    });
  }
  if (filters.source) {
    activeFilters.push({
      key: "source",
      label: TASK_SOURCE_LABELS[filters.source as TaskSource],
    });
  }
  if (filters.assignee_id) {
    const member = members.find((m) => m.id === filters.assignee_id);
    activeFilters.push({
      key: "assignee_id",
      label:
        filters.assignee_id === "unassigned"
          ? "Не назначен"
          : member?.full_name || "Исполнитель",
    });
  }

  function removeFilter(key: keyof TaskFilterValues) {
    onFiltersChange({ ...filters, [key]: "" });
  }

  return (
    <div className="flex-1 space-y-3">
      {/* Main filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
          <Input
            placeholder="Найти задачу..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
            className="pl-9 h-10 w-56 bg-card border-border/60 shadow-sm focus:shadow-md focus:border-primary/40"
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rounded-full p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Toggle filters button (mobile-friendly) */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersExpanded(!filtersExpanded)}
          className="h-10 gap-2 border-border/60 shadow-sm lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Фильтры
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${filtersExpanded ? "rotate-180" : ""}`}
          />
        </Button>

        {/* Desktop filters — always visible */}
        <div
          className={`flex items-center gap-2 flex-wrap ${filtersExpanded ? "flex" : "hidden lg:flex"}`}
        >
          {/* Priority */}
          <Select
            value={filters.priority || "all"}
            onValueChange={(v) =>
              onFiltersChange({ ...filters, priority: v === "all" ? "" : v })
            }
          >
            <SelectTrigger className="h-10 w-[150px] bg-card border-border/60 shadow-sm data-[state=open]:border-primary/40 data-[state=open]:shadow-md">
              <SelectValue placeholder="Приоритет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все приоритеты</SelectItem>
              {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map(
                (p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${PRIORITY_DOT_COLORS[p]}`}
                      />
                      {TASK_PRIORITY_LABELS[p]}
                    </span>
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          {/* Source */}
          <Select
            value={filters.source || "all"}
            onValueChange={(v) =>
              onFiltersChange({ ...filters, source: v === "all" ? "" : v })
            }
          >
            <SelectTrigger className="h-10 w-[150px] bg-card border-border/60 shadow-sm data-[state=open]:border-primary/40 data-[state=open]:shadow-md">
              <SelectValue placeholder="Источник" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все источники</SelectItem>
              {(Object.keys(TASK_SOURCE_LABELS) as TaskSource[]).map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-2">
                    <span className="text-xs">{SOURCE_ICONS[s]}</span>
                    {TASK_SOURCE_LABELS[s]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Assignee */}
          <Select
            value={filters.assignee_id || "all"}
            onValueChange={(v) =>
              onFiltersChange({
                ...filters,
                assignee_id: v === "all" ? "" : v,
              })
            }
          >
            <SelectTrigger className="h-10 w-[170px] bg-card border-border/60 shadow-sm data-[state=open]:border-primary/40 data-[state=open]:shadow-md">
              <SelectValue placeholder="Исполнитель" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все исполнители</SelectItem>
              <SelectItem value="unassigned">
                <span className="text-muted-foreground">Не назначен</span>
              </SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="flex items-center gap-2">
                    <UserAvatar name={m.full_name} avatarUrl={m.avatar_url} size="sm" />
                    <span className="truncate">{m.full_name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filter pills */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="text-xs text-muted-foreground">Фильтры:</span>
          {activeFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => removeFilter(f.key)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium hover:bg-primary/20 group"
            >
              {f.label}
              <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
          {activeFilters.length > 0 && (
            <button
              onClick={() => onFiltersChange(EMPTY_FILTERS)}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Сбросить все
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { EMPTY_FILTERS };
