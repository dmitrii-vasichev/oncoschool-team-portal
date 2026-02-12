"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function TaskFilters({
  filters,
  onFiltersChange,
  members,
}: {
  filters: TaskFilterValues;
  onFiltersChange: (filters: TaskFilterValues) => void;
  members: TeamMember[];
}) {
  const hasFilters =
    filters.search || filters.priority || filters.source || filters.assignee_id;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="pl-8 h-9 w-48"
        />
      </div>

      <Select
        value={filters.priority || "all"}
        onValueChange={(v) =>
          onFiltersChange({ ...filters, priority: v === "all" ? "" : v })
        }
      >
        <SelectTrigger className="h-9 w-36">
          <SelectValue placeholder="Приоритет" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все приоритеты</SelectItem>
          {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((p) => (
            <SelectItem key={p} value={p}>
              {TASK_PRIORITY_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.source || "all"}
        onValueChange={(v) =>
          onFiltersChange({ ...filters, source: v === "all" ? "" : v })
        }
      >
        <SelectTrigger className="h-9 w-32">
          <SelectValue placeholder="Источник" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все источники</SelectItem>
          {(Object.keys(TASK_SOURCE_LABELS) as TaskSource[]).map((s) => (
            <SelectItem key={s} value={s}>
              {TASK_SOURCE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.assignee_id || "all"}
        onValueChange={(v) =>
          onFiltersChange({ ...filters, assignee_id: v === "all" ? "" : v })
        }
      >
        <SelectTrigger className="h-9 w-40">
          <SelectValue placeholder="Исполнитель" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все</SelectItem>
          <SelectItem value="unassigned">Не назначен</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFiltersChange(EMPTY_FILTERS)}
          className="h-9"
        >
          <X className="h-4 w-4 mr-1" />
          Сбросить
        </Button>
      )}
    </div>
  );
}

export { EMPTY_FILTERS };
