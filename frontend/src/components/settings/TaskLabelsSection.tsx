"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Loader2,
  Pencil,
  Search,
  Tags,
} from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { TaskLabelChips } from "@/components/tasks/TaskLabelChips";
import { TaskLabelEditDialog } from "@/components/tasks/TaskLabelEditDialog";
import { labelSwatchClass } from "@/components/tasks/taskLabelUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import type { TaskLabel, TaskLabelColor } from "@/lib/types";
import { cn } from "@/lib/utils";

type LabelFilter = "active" | "archived";

const FILTERS: Array<{ value: LabelFilter; label: string }> = [
  { value: "active", label: "Активные" },
  { value: "archived", label: "Архив" },
];

export function TaskLabelsSection() {
  const { toastError, toastSuccess } = useToast();
  const { members } = useTeam({ includeInactive: true, includeTest: true });
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<LabelFilter>("active");
  const [editingLabel, setEditingLabel] = useState<TaskLabel | null>(null);
  const [archiveLabel, setArchiveLabel] = useState<TaskLabel | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyLabelId, setBusyLabelId] = useState<string | null>(null);
  const labelRequestSeqRef = useRef(0);
  const debouncedSearchRef = useRef("");

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.full_name])),
    [members]
  );

  const loadLabels = useCallback(
    async (options?: { quiet?: boolean }) => {
      const requestSeq = labelRequestSeqRef.current + 1;
      labelRequestSeqRef.current = requestSeq;
      if (!options?.quiet) setLoading(true);
      try {
        const result = await api.getTaskLabels({
          search: debouncedSearchRef.current.trim() || undefined,
          limit: 100,
          include_archived: true,
        });
        if (labelRequestSeqRef.current !== requestSeq) return;
        setLabels(result);
      } catch (error) {
        if (labelRequestSeqRef.current !== requestSeq) return;
        toastError(
          error instanceof Error ? error.message : "Не удалось загрузить метки"
        );
      } finally {
        if (labelRequestSeqRef.current === requestSeq) {
          setLoading(false);
        }
      }
    },
    [toastError]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    debouncedSearchRef.current = debouncedSearch;
    void loadLabels();
  }, [debouncedSearch, loadLabels]);

  const visibleLabels = useMemo(
    () =>
      labels.filter((label) =>
        filter === "archived" ? label.is_archived : !label.is_archived
      ),
    [filter, labels]
  );

  const activeCount = labels.filter((label) => !label.is_archived).length;
  const archivedCount = labels.length - activeCount;
  const isArchivedFilter = filter === "archived";

  function ownerName(label: TaskLabel) {
    if (!label.created_by_id) return "Системная";
    return memberNames.get(label.created_by_id) ?? "Неизвестный участник";
  }

  async function reloadAfterFailure(message: string, error: unknown) {
    toastError(error instanceof Error ? error.message : message);
    await loadLabels({ quiet: true });
  }

  async function handleEditLabel(data: { name: string; color: TaskLabelColor }) {
    if (!editingLabel) return;
    setSavingEdit(true);
    try {
      await api.updateTaskLabel(editingLabel.id, data);
      toastSuccess("Метка обновлена");
      setEditingLabel(null);
      await loadLabels({ quiet: true });
    } catch (error) {
      await reloadAfterFailure("Не удалось обновить метку", error);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleArchiveLabel() {
    if (!archiveLabel) return;
    setBusyLabelId(archiveLabel.id);
    try {
      await api.archiveTaskLabel(archiveLabel.id);
      toastSuccess("Метка архивирована");
      setArchiveLabel(null);
      await loadLabels({ quiet: true });
    } catch (error) {
      await reloadAfterFailure("Не удалось архивировать метку", error);
    } finally {
      setBusyLabelId(null);
    }
  }

  async function handleRestoreLabel(label: TaskLabel) {
    setBusyLabelId(label.id);
    try {
      await api.restoreTaskLabel(label.id);
      toastSuccess("Метка восстановлена");
      await loadLabels({ quiet: true });
    } catch (error) {
      await reloadAfterFailure("Не удалось восстановить метку", error);
    } finally {
      setBusyLabelId(null);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-3 p-6 pb-0">
          <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <Tags className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="font-heading font-semibold text-base">
              Метки задач
            </h2>
            <p className="text-xs text-muted-foreground">
              Редактирование и архивация меток для каталога задач
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск меток"
                className="h-9 pl-9"
              />
            </div>
            <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
              {FILTERS.map((item) => {
                const count = item.value === "active" ? activeCount : archivedCount;
                const isSelected = filter === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      isSelected
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                    <span className="ml-1 text-2xs text-muted-foreground">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : visibleLabels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
              <p className="text-sm font-medium">
                {isArchivedFilter ? "В архиве нет меток" : "Активные метки не найдены"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search.trim()
                  ? "Попробуйте изменить поисковый запрос."
                  : "Здесь появятся метки после создания в задачах."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/60">
              {visibleLabels.map((label) => {
                const isBusy = busyLabelId === label.id;
                return (
                  <div
                    key={label.id}
                    className="flex flex-col gap-3 px-3 py-3 hover:bg-muted/30 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className={cn(
                          "h-3 w-3 shrink-0 rounded-full",
                          labelSwatchClass(label.color)
                        )}
                      />
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <TaskLabelChips
                            labels={[label]}
                            maxVisible={1}
                            className="min-w-0"
                          />
                          {label.is_archived && (
                            <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                              Архив
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          Владелец: {ownerName(label)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-xs text-muted-foreground sm:text-right">
                        <span className="font-medium text-foreground">
                          {label.usage_count}
                        </span>{" "}
                        использ.
                      </div>
                      <div className="flex items-center gap-1">
                        {!label.is_archived && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => setEditingLabel(label)}
                              disabled={isBusy}
                              title="Редактировать"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                              onClick={() => setArchiveLabel(label)}
                              disabled={isBusy}
                              title="Архивировать"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {label.is_archived && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg"
                            onClick={() => void handleRestoreLabel(label)}
                            disabled={isBusy}
                          >
                            {isBusy ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <ArchiveRestore className="mr-2 h-4 w-4" />
                            )}
                            Восстановить
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

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
        confirmDisabled={!!archiveLabel && busyLabelId === archiveLabel.id}
        cancelDisabled={!!archiveLabel && busyLabelId === archiveLabel.id}
        onConfirm={() => void handleArchiveLabel()}
      />
    </>
  );
}
