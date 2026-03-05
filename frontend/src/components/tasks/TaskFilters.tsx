"use client";

import { useMemo, useState } from "react";
import { Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { TaskPriority, TaskSource } from "@/lib/types";
import { TASK_PRIORITY_LABELS, TASK_SOURCE_LABELS } from "@/lib/types";
import type { Department, TeamMember } from "@/lib/types";

export interface TaskFilterValues {
  search: string;
  priority: string;
  source: string;
  department_id: string;
  assignee_id: string;
  created_by_id: string;
}

const EMPTY_FILTERS: TaskFilterValues = {
  search: "",
  priority: "",
  source: "",
  department_id: "",
  assignee_id: "",
  created_by_id: "",
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

interface TaskFiltersProps {
  filters: TaskFilterValues;
  onFiltersChange: (filters: TaskFilterValues) => void;
  members: TeamMember[];
  departments: Department[];
  showDepartmentFilter?: boolean;
}

export function TaskFilters({
  filters,
  onFiltersChange,
  members,
  departments,
  showDepartmentFilter = true,
}: TaskFiltersProps) {
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const memberOptions = useMemo(
    () =>
      filters.department_id
        ? members.filter((m) => m.department_id === filters.department_id)
        : members,
    [filters.department_id, members]
  );
  const selectedMemberFilterValue = useMemo(() => {
    if (filters.created_by_id) return `author:${filters.created_by_id}`;
    if (filters.assignee_id === "unassigned") return "assignee:unassigned";
    if (filters.assignee_id) return `assignee:${filters.assignee_id}`;
    return "all";
  }, [filters.assignee_id, filters.created_by_id]);

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
  if (showDepartmentFilter && filters.department_id) {
    const department = departments.find((d) => d.id === filters.department_id);
    activeFilters.push({
      key: "department_id",
      label: department?.name || "Отдел",
    });
  }
  if (filters.assignee_id) {
    const member = members.find((m) => m.id === filters.assignee_id);
    activeFilters.push({
      key: "assignee_id",
      label:
        filters.assignee_id === "unassigned"
          ? "Исполнитель: Не назначен"
          : `Исполнитель: ${member?.full_name || "—"}`,
    });
  }
  if (filters.created_by_id) {
    const member = members.find((m) => m.id === filters.created_by_id);
    activeFilters.push({
      key: "created_by_id",
      label: `Автор: ${member?.full_name || "—"}`,
    });
  }

  function removeFilter(key: keyof TaskFilterValues) {
    onFiltersChange({ ...filters, [key]: "" });
  }

  function handleMemberValueChange(value: string) {
    if (value === "all") {
      onFiltersChange({
        ...filters,
        assignee_id: "",
        created_by_id: "",
      });
      return;
    }

    if (value === "assignee:unassigned") {
      onFiltersChange({
        ...filters,
        assignee_id: "unassigned",
        created_by_id: "",
      });
      return;
    }

    if (value.startsWith("assignee:")) {
      onFiltersChange({
        ...filters,
        assignee_id: value.slice("assignee:".length),
        created_by_id: "",
      });
      return;
    }

    onFiltersChange({
      ...filters,
      assignee_id: "",
      created_by_id: value.startsWith("author:")
        ? value.slice("author:".length)
        : "",
    });
  }

  return (
    <div className="flex-1 space-y-3">
      {/* Main filter row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-nowrap">
        {/* Search */}
        <div className="relative group w-full lg:w-[220px] lg:shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
          <Input
            placeholder="Найти задачу..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
            className="h-10 w-full bg-card pl-9 shadow-sm focus:border-primary/40 focus:shadow-md"
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
          className="h-10 w-full rounded-xl gap-1.5 border-border/60 shadow-sm sm:w-auto lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Фильтры
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${filtersExpanded ? "rotate-180" : ""}`}
          />
        </Button>

        {/* Desktop filters — always visible */}
        <div
          className={`
            w-full flex-col gap-2
            sm:w-auto sm:flex-row sm:flex-wrap sm:items-center
            lg:flex-1 lg:min-w-0 lg:w-auto lg:flex-nowrap
            ${filtersExpanded ? "flex" : "hidden lg:flex"}
          `}
        >
          {/* Priority */}
          <Select
            value={filters.priority || "all"}
            onValueChange={(v) =>
              onFiltersChange({ ...filters, priority: v === "all" ? "" : v })
            }
          >
            <SelectTrigger className="h-10 w-full shrink-0 bg-card border-border/60 shadow-sm data-[state=open]:border-primary/40 data-[state=open]:shadow-md sm:w-[140px] lg:w-[138px]">
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
            <SelectTrigger className="h-10 w-full shrink-0 bg-card border-border/60 shadow-sm data-[state=open]:border-primary/40 data-[state=open]:shadow-md sm:w-[140px] lg:w-[138px]">
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

          {/* Department */}
          {showDepartmentFilter && (
            <Select
              value={filters.department_id || "all"}
              onValueChange={(v) => {
                const nextDepartmentId = v === "all" ? "" : v;
                const shouldResetAssignee =
                  Boolean(nextDepartmentId) &&
                  Boolean(filters.assignee_id) &&
                  filters.assignee_id !== "unassigned" &&
                  !members.some(
                    (m) =>
                      m.id === filters.assignee_id &&
                      m.department_id === nextDepartmentId
                  );
                const shouldResetAuthor =
                  Boolean(nextDepartmentId) &&
                  Boolean(filters.created_by_id) &&
                  !members.some(
                    (m) =>
                      m.id === filters.created_by_id &&
                      m.department_id === nextDepartmentId
                  );

                onFiltersChange({
                  ...filters,
                  department_id: nextDepartmentId,
                  assignee_id: shouldResetAssignee ? "" : filters.assignee_id,
                  created_by_id: shouldResetAuthor ? "" : filters.created_by_id,
                });
              }}
            >
              <SelectTrigger className="h-10 w-full shrink-0 bg-card border-border/60 shadow-sm data-[state=open]:border-primary/40 data-[state=open]:shadow-md sm:w-[170px] lg:w-[160px]">
                <SelectValue placeholder="Отдел" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все отделы</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Member filter (assignee + author in one dropdown) */}
          <Select
            value={selectedMemberFilterValue}
            onValueChange={handleMemberValueChange}
          >
            <SelectTrigger className="h-10 w-full shrink-0 bg-card border-border/60 shadow-sm data-[state=open]:border-primary/40 data-[state=open]:shadow-md sm:w-[190px] lg:w-[180px]">
              <SelectValue placeholder="Участник" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все участники</SelectItem>
              <SelectSeparator />

              <SelectGroup>
                <SelectLabel>Исполнитель</SelectLabel>
                <SelectItem value="assignee:unassigned">
                  <span className="text-muted-foreground">Не назначен</span>
                </SelectItem>
                {memberOptions.map((m) => (
                  <SelectItem key={`assignee:${m.id}`} value={`assignee:${m.id}`}>
                    <span className="flex items-center gap-2">
                      <UserAvatar name={m.full_name} avatarUrl={m.avatar_url} size="sm" />
                      <span className="truncate">{m.full_name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>

              <SelectSeparator />

              <SelectGroup>
                <SelectLabel>Автор</SelectLabel>
                {memberOptions.map((m) => (
                  <SelectItem key={`author:${m.id}`} value={`author:${m.id}`}>
                    <span className="flex items-center gap-2">
                      <UserAvatar name={m.full_name} avatarUrl={m.avatar_url} size="sm" />
                      <span className="truncate">{m.full_name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
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
