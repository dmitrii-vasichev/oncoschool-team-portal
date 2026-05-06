"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/api";
import { PermissionService } from "@/lib/permissions";
import type { TaskLabel, TaskLabelColor } from "@/lib/types";
import { cn } from "@/lib/utils";

import { TaskLabelEditDialog } from "./TaskLabelEditDialog";
import { TaskLabelChips } from "./TaskLabelChips";
import {
  TASK_LABEL_COLOR_OPTIONS,
  canArchiveTaskLabel,
  canEditTaskLabel,
  getTaskLabelPickerStateAfterArchive,
  labelSwatchClass,
} from "./taskLabelUtils";

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
  const { user } = useCurrentUser();
  const { toastError, toastSuccess } = useToast();
  const isModerator = user ? PermissionService.isModerator(user) : false;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<TaskLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [createColor, setCreateColor] = useState<TaskLabelColor>("teal");
  const [editingLabel, setEditingLabel] = useState<TaskLabel | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [archiveLabel, setArchiveLabel] = useState<TaskLabel | null>(null);
  const [archiving, setArchiving] = useState(false);
  const mountedRef = useRef(false);
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

  async function refreshLabels() {
    try {
      const labels = await api.getTaskLabels({
        search: normalizedSearch || undefined,
        limit: 20,
      });
      if (!mountedRef.current) return;
      setOptions(labels);
      setLoadError(false);
    } catch {
      if (!mountedRef.current) return;
      setLoadError(true);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
      const label = await api.createTaskLabel({
        name: labelName,
        color: createColor,
      });
      const latestLabels = valueRef.current;
      const latestIds = new Set(latestLabels.map((item) => item.id));
      if (!selectedIdsAtCall.has(label.id) && !latestIds.has(label.id)) {
        onChange([...latestLabels, label]);
      }
      setCreateColor("teal");
      setSearch("");
      setOpen(false);
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Не удалось создать метку"
      );
      await refreshLabels();
    } finally {
      setCreating(false);
    }
  }

  async function handleEditLabel(data: { name: string; color: TaskLabelColor }) {
    if (!editingLabel) return;
    setSavingEdit(true);
    try {
      const updated = await api.updateTaskLabel(editingLabel.id, data);
      setOptions((labels) =>
        labels.map((label) => (label.id === updated.id ? updated : label))
      );
      onChange(
        valueRef.current.map((label) =>
          label.id === updated.id ? updated : label
        )
      );
      toastSuccess("Метка обновлена");
      setEditingLabel(null);
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Не удалось обновить метку"
      );
      await refreshLabels();
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleArchiveLabel() {
    if (!archiveLabel) return;
    setArchiving(true);
    try {
      const archived = await api.archiveTaskLabel(archiveLabel.id);
      // Archived labels stay attached to existing tasks; only remove them from picker results.
      setOptions((labels) =>
        getTaskLabelPickerStateAfterArchive({
          options: labels,
          selectedLabels: valueRef.current,
          archivedLabelId: archived.id,
        }).options
      );
      toastSuccess("Метка архивирована");
      setArchiveLabel(null);
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Не удалось архивировать метку"
      );
      await refreshLabels();
    } finally {
      setArchiving(false);
    }
  }

  return (
    <>
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
                <div
                  key={label.id}
                  className="flex items-center gap-1 rounded-md hover:bg-muted"
                >
                  <button
                    type="button"
                    onClick={() => toggleLabel(label)}
                    disabled={controlsDisabled}
                    className="flex min-w-0 flex-1 items-center justify-between px-2 py-2 text-left text-sm disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          labelSwatchClass(label.color)
                        )}
                      />
                      <span className="truncate">{label.name}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {label.usage_count}
                      {selectedIds.has(label.id) && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </span>
                  </button>
                  {(canEditTaskLabel(label) || canArchiveTaskLabel(label)) && (
                    <span className="flex shrink-0 items-center pr-1">
                      {canEditTaskLabel(label) && (
                        <button
                          type="button"
                          aria-label={`Редактировать метку ${label.name}`}
                          disabled={controlsDisabled}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                          onClick={() => setEditingLabel(label)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canArchiveTaskLabel(label) && (
                        <button
                          type="button"
                          aria-label={`Архивировать метку ${label.name}`}
                          disabled={controlsDisabled}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                          onClick={() => setArchiveLabel(label)}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  )}
                </div>
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
              <div className="mt-2 grid grid-cols-8 gap-1 border-t border-border/60 pt-2">
                {TASK_LABEL_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={`Выбрать цвет ${option.label}`}
                    aria-pressed={createColor === option.value}
                    disabled={controlsDisabled}
                    onClick={() => setCreateColor(option.value)}
                    className={cn(
                      "flex h-7 items-center justify-center rounded-md border",
                      createColor === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border/60 hover:bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "h-3.5 w-3.5 rounded-full",
                        labelSwatchClass(option.value)
                      )}
                    />
                  </button>
                ))}
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
          {isModerator && (
            <div className="mt-2 border-t border-border/60 pt-2">
              <Link
                href="/settings?tab=task-labels"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
                Управлять метками
              </Link>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <TaskLabelEditDialog
        label={editingLabel}
        open={!!editingLabel}
        saving={savingEdit}
        onOpenChange={(open) => !open && setEditingLabel(null)}
        onSave={(data) => void handleEditLabel(data)}
      />
      <ConfirmDialog
        open={!!archiveLabel}
        onOpenChange={(open) => !open && setArchiveLabel(null)}
        title="Архивировать метку?"
        description="Метка останется на старых задачах, но больше не будет доступна для новых."
        confirmLabel="Архивировать"
        confirmDisabled={archiving}
        cancelDisabled={archiving}
        onConfirm={() => void handleArchiveLabel()}
      />
    </>
  );
}
