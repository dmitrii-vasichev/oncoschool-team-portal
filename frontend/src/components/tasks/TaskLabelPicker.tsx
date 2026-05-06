"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import type { TaskLabel } from "@/lib/types";
import { cn } from "@/lib/utils";

import { TaskLabelChips } from "./TaskLabelChips";

type TaskLabelPickerVariant = "default" | "compact";
type TaskLabelPickerDisplayMode = "chips" | "summary";

export function TaskLabelPicker({
  value,
  onChange,
  disabled = false,
  maxVisible = 3,
  placeholder = "Метки",
  variant = "default",
  displayMode = "chips",
  triggerClassName,
  showChevron = false,
}: {
  value: TaskLabel[];
  onChange: (labels: TaskLabel[]) => void;
  disabled?: boolean;
  maxVisible?: number;
  placeholder?: string;
  variant?: TaskLabelPickerVariant;
  displayMode?: TaskLabelPickerDisplayMode;
  triggerClassName?: string;
  showChevron?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<TaskLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const selectedIds = useMemo(
    () => new Set(value.map((label) => label.id)),
    [value]
  );
  const controlsDisabled = disabled || creating;
  const normalizedSearch = search.trim();
  const canCreate =
    normalizedSearch.length > 0 &&
    !options.some(
      (label) => label.name.toLowerCase() === normalizedSearch.toLowerCase()
    );
  const summaryText =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0].name
        : `${value[0].name} +${value.length - 1}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError(false);
    setLoading(true);
    api
      .getTaskLabels({ search: normalizedSearch || undefined, limit: 20 })
      .then((labels) => {
        if (!cancelled) setOptions(labels);
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, normalizedSearch]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  function handleOpenChange(nextOpen: boolean) {
    if (disabled || creating) {
      if (disabled) setOpen(false);
      return;
    }
    setOpen(nextOpen);
  }

  function toggleLabel(label: TaskLabel) {
    if (controlsDisabled) return;
    if (selectedIds.has(label.id)) {
      onChange(value.filter((item) => item.id !== label.id));
      return;
    }
    onChange([...value, label]);
  }

  async function createLabel() {
    if (!normalizedSearch || controlsDisabled) return;
    const labelName = normalizedSearch;
    const selectedIdsAtCall = new Set(valueRef.current.map((label) => label.id));
    setCreating(true);
    try {
      const label = await api.createTaskLabel({ name: labelName });
      const latestLabels = valueRef.current;
      const latestIds = new Set(latestLabels.map((item) => item.id));
      if (!selectedIdsAtCall.has(label.id) && !latestIds.has(label.id)) {
        onChange([...latestLabels, label]);
      }
      setSearch("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-auto min-w-0 justify-between gap-2",
            variant === "compact"
              ? "min-h-6 w-auto max-w-full rounded-full px-2.5 py-0.5 text-xs font-medium leading-none"
              : "min-h-10 w-full px-3 py-2",
            triggerClassName
          )}
        >
          <span className="flex min-w-0 flex-1 items-center">
            {value.length && displayMode === "summary" ? (
              <span className="min-w-0 truncate text-foreground">
                {summaryText}
              </span>
            ) : value.length ? (
              <TaskLabelChips
                labels={value}
                maxVisible={maxVisible}
                className={cn(
                  "flex-nowrap overflow-hidden",
                  variant === "compact" ? "max-w-[220px]" : "w-full"
                )}
              />
            ) : (
              <span className="truncate text-muted-foreground">
                {placeholder}
              </span>
            )}
          </span>
          {showChevron && (
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[calc(100vw-1rem)] max-w-[320px] p-2"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={controlsDisabled}
            placeholder="Найти или создать метку"
            className="h-9 pl-9"
          />
        </div>
        <div className="mt-2 max-h-64 overflow-y-auto">
          {loading && (
            <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загрузка...
            </div>
          )}
          {!loading &&
            options.map((label) => (
              <button
                key={label.id}
                type="button"
                onClick={() => toggleLabel(label)}
                disabled={controlsDisabled}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="truncate">{label.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {label.usage_count}
                  {selectedIds.has(label.id) && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </span>
              </button>
            ))}
          {!loading && loadError && (
            <div className="px-2 py-3 text-sm text-muted-foreground">
              Не удалось загрузить метки
            </div>
          )}
          {!loading && !loadError && options.length === 0 && !canCreate && (
            <div className="px-2 py-3 text-sm text-muted-foreground">
              Метки не найдены
            </div>
          )}
          {!loading && canCreate && (
            <button
              type="button"
              onClick={() => void createLabel()}
              disabled={controlsDisabled}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Создать &quot;{normalizedSearch}&quot;
            </button>
          )}
        </div>
        {value.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
            {value.map((label) => (
              <button
                key={label.id}
                type="button"
                aria-label={`Удалить метку ${label.name}`}
                disabled={controlsDisabled}
                onClick={() =>
                  !controlsDisabled &&
                  onChange(value.filter((item) => item.id !== label.id))
                }
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs disabled:pointer-events-none disabled:opacity-50"
              >
                {label.name}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
