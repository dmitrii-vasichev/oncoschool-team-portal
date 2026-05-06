"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { TaskLabelPicker } from "@/components/tasks/TaskLabelPicker";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  buildActiveTaskFilterChips,
  clearStructuredTaskFilters,
  countActiveStructuredTaskFilters,
  removeTaskFilterChip,
  type ActiveTaskFilterChip,
  type TaskFilterValues,
} from "@/components/tasks/taskFilterUtils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { TaskSource } from "@/lib/types";
import { TASK_SOURCE_LABELS } from "@/lib/types";
import type { Department, TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";

export {
  EMPTY_FILTERS,
  type TaskFilterValues,
} from "@/components/tasks/taskFilterUtils";

const SOURCE_ICONS: Record<string, string> = {
  text: "📝",
  voice: "🎤",
  summary: "📋",
  web: "🌐",
};

const FILTER_CONTROL_CLASS =
  "h-8 w-full rounded-xl border-border/70 bg-background/80 shadow-none hover:border-primary/30 data-[state=open]:border-primary/40 data-[state=open]:shadow-none";

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
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const isDesktopSheet = useMediaQuery("(min-width: 768px)");
  const memberOptions = useMemo(
    () =>
      filters.department_id
        ? members.filter((m) => m.department_id === filters.department_id)
        : members,
    [filters.department_id, members],
  );
  const selectedMemberFilterValue = useMemo(() => {
    if (filters.created_by_id) return `author:${filters.created_by_id}`;
    if (filters.assignee_id === "unassigned") return "assignee:unassigned";
    if (filters.assignee_id) return `assignee:${filters.assignee_id}`;
    return "all";
  }, [filters.assignee_id, filters.created_by_id]);
  const activeFilterCount = countActiveStructuredTaskFilters(filters, {
    showDepartmentFilter,
  });
  const activeFilterChips = buildActiveTaskFilterChips({
    filters,
    members,
    departments,
    showDepartmentFilter,
  });
  const sheetSide = isDesktopSheet ? "right" : "bottom";

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

  function handleDepartmentValueChange(value: string) {
    const nextDepartmentId = value === "all" ? "" : value;
    const shouldResetAssignee =
      Boolean(nextDepartmentId) &&
      Boolean(filters.assignee_id) &&
      filters.assignee_id !== "unassigned" &&
      !members.some(
        (m) =>
          m.id === filters.assignee_id && m.department_id === nextDepartmentId,
      );
    const shouldResetAuthor =
      Boolean(nextDepartmentId) &&
      Boolean(filters.created_by_id) &&
      !members.some(
        (m) =>
          m.id === filters.created_by_id &&
          m.department_id === nextDepartmentId,
      );

    onFiltersChange({
      ...filters,
      department_id: nextDepartmentId,
      assignee_id: shouldResetAssignee ? "" : filters.assignee_id,
      created_by_id: shouldResetAuthor ? "" : filters.created_by_id,
    });
  }

  function resetStructuredFilters() {
    onFiltersChange(clearStructuredTaskFilters(filters));
  }

  function handleActiveChipClick(chip: ActiveTaskFilterChip) {
    if (chip.type === "label-overflow") {
      setFilterSheetOpen(true);
      return;
    }

    onFiltersChange(removeTaskFilterChip(filters, chip));
  }

  return (
    <div className="flex-1 space-y-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(280px,1fr)_auto]">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
          <Input
            placeholder="Найти задачу..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
            className="h-8 w-full rounded-xl border-border/70 bg-background/80 pl-9 pr-9 text-xs shadow-none focus:border-primary/40"
          />
          {filters.search && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => onFiltersChange({ ...filters, search: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rounded-full p-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          aria-label={
            activeFilterCount > 0
              ? `Открыть фильтры, активно ${activeFilterCount}`
              : "Открыть фильтры"
          }
          onClick={() => setFilterSheetOpen(true)}
          className="h-8 rounded-xl gap-1.5 border-border/70 bg-background/80 px-3 text-xs shadow-none"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 ? `Фильтры · ${activeFilterCount}` : "Фильтры"}
        </Button>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {activeFilterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-label={
                chip.type === "label-overflow"
                  ? "Открыть все выбранные метки"
                  : `Удалить фильтр ${chip.label}`
              }
              onClick={() => handleActiveChipClick(chip)}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20",
                chip.type !== "label-overflow" && "group",
              )}
            >
              <span className="truncate">{chip.label}</span>
              {chip.type !== "label-overflow" && (
                <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={resetStructuredFilters}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Сбросить
          </button>
        </div>
      )}

      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent
          side={sheetSide}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            isDesktopSheet
              ? "h-full w-full max-h-none sm:max-w-md"
              : "max-h-[85dvh] rounded-t-2xl",
          )}
        >
          <SheetHeader className="border-b border-border/70 px-5 py-4 pr-12 text-left">
            <SheetTitle>Фильтры</SheetTitle>
            <SheetDescription>Настройте вид доски задач</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              <FilterField label="Метки">
                <TaskLabelPicker
                  value={filters.labels}
                  onChange={(labels) => onFiltersChange({ ...filters, labels })}
                  maxVisible={2}
                  placeholder="Все метки"
                  displayMode="summary"
                  triggerClassName={FILTER_CONTROL_CLASS}
                  showChevron
                />
              </FilterField>

              {showDepartmentFilter && (
                <FilterField label="Отдел">
                  <Select
                    value={filters.department_id || "all"}
                    onValueChange={handleDepartmentValueChange}
                  >
                    <SelectTrigger className={FILTER_CONTROL_CLASS}>
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
                </FilterField>
              )}

              <FilterField label="Участник">
                <Select
                  value={selectedMemberFilterValue}
                  onValueChange={handleMemberValueChange}
                >
                  <SelectTrigger className={FILTER_CONTROL_CLASS}>
                    <SelectValue placeholder="Участник" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все участники</SelectItem>
                    <SelectSeparator />

                    <SelectGroup>
                      <SelectLabel>Исполнитель</SelectLabel>
                      <SelectItem value="assignee:unassigned">
                        <span className="text-muted-foreground">
                          Не назначен
                        </span>
                      </SelectItem>
                      {memberOptions.map((m) => (
                        <SelectItem
                          key={`assignee:${m.id}`}
                          value={`assignee:${m.id}`}
                        >
                          <span className="flex items-center gap-2">
                            <UserAvatar
                              name={m.full_name}
                              avatarUrl={m.avatar_url}
                              size="sm"
                            />
                            <span className="truncate">{m.full_name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>

                    <SelectSeparator />

                    <SelectGroup>
                      <SelectLabel>Автор</SelectLabel>
                      {memberOptions.map((m) => (
                        <SelectItem
                          key={`author:${m.id}`}
                          value={`author:${m.id}`}
                        >
                          <span className="flex items-center gap-2">
                            <UserAvatar
                              name={m.full_name}
                              avatarUrl={m.avatar_url}
                              size="sm"
                            />
                            <span className="truncate">{m.full_name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Срочность">
                <Select
                  value={filters.priority || "all"}
                  onValueChange={(v) =>
                    onFiltersChange({
                      ...filters,
                      priority: v === "all" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger className={FILTER_CONTROL_CLASS}>
                    <SelectValue placeholder="Срочность" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все задачи</SelectItem>
                    <SelectItem value="urgent">Срочные</SelectItem>
                    <SelectItem value="normal">Обычные</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Источник">
                <Select
                  value={filters.source || "all"}
                  onValueChange={(v) =>
                    onFiltersChange({
                      ...filters,
                      source: v === "all" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger className={FILTER_CONTROL_CLASS}>
                    <SelectValue placeholder="Источник" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все источники</SelectItem>
                    {(Object.keys(TASK_SOURCE_LABELS) as TaskSource[]).map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          <span className="flex items-center gap-2">
                            <span className="text-xs">{SOURCE_ICONS[s]}</span>
                            {TASK_SOURCE_LABELS[s]}
                          </span>
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </FilterField>
            </div>
          </div>

          <SheetFooter className="gap-2 border-t border-border/70 px-5 py-4 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={resetStructuredFilters}
              disabled={activeFilterCount === 0}
              className="h-10 rounded-xl"
            >
              Сбросить
            </Button>
            <SheetClose asChild>
              <Button type="button" className="h-10 rounded-xl">
                Готово
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const labelId = useId();

  return (
    <div className="space-y-1.5" aria-labelledby={labelId}>
      <div
        id={labelId}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </div>
      {children}
    </div>
  );
}
