"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Pin, Settings2, Tags, Users } from "lucide-react";
import { TaskLabelChips } from "@/components/tasks/TaskLabelChips";
import { TaskLabelPicker } from "@/components/tasks/TaskLabelPicker";
import { useToast } from "@/components/shared/Toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  Department,
  MeetingBoardSettings,
  TaskLabel,
  TeamMember,
} from "@/lib/types";
import { getMeetingBoardScopeCounts } from "./meetingBoardPresentationUtils";

type BoardSettingsPatch = Partial<
  Pick<
    MeetingBoardSettings,
    | "added_member_ids"
    | "added_department_ids"
    | "pinned_task_ids"
    | "focus_label_ids"
    | "materials"
    | "board_notes"
  >
>;

interface MeetingBoardScopePanelProps {
  settings: MeetingBoardSettings;
  members: TeamMember[];
  departments: Department[];
  focusLabels: TaskLabel[];
  isModerator: boolean;
  onUpdateSettings?: (data: BoardSettingsPatch) => Promise<void>;
}

function namesForIds<T extends { id: string; name?: string; full_name?: string }>(
  ids: string[],
  items: T[],
) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return ids
    .map((id) => itemById.get(id)?.full_name || itemById.get(id)?.name)
    .filter((name): name is string => Boolean(name));
}

export function MeetingBoardScopePanel({
  settings,
  members,
  departments,
  focusLabels,
  isModerator,
  onUpdateSettings,
}: MeetingBoardScopePanelProps) {
  const { toastError, toastSuccess } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedFocusLabels = useMemo(() => {
    const selectedIds = new Set(settings.focus_label_ids || []);
    return focusLabels.filter((label) => selectedIds.has(label.id));
  }, [focusLabels, settings.focus_label_ids]);
  const [focusDraft, setFocusDraft] = useState<TaskLabel[]>(selectedFocusLabels);

  useEffect(() => {
    if (settingsOpen) setFocusDraft(selectedFocusLabels);
  }, [selectedFocusLabels, settingsOpen]);

  const {
    addedMemberCount,
    addedDepartmentCount,
    pinnedTaskCount,
    focusLabelCount,
  } = getMeetingBoardScopeCounts(settings);
  const addedMemberNames = namesForIds(settings.added_member_ids, members);
  const addedDepartmentNames = namesForIds(settings.added_department_ids, departments);

  const stats = [
    {
      label: "Люди",
      value: addedMemberCount,
      icon: Users,
    },
    {
      label: "Отделы",
      value: addedDepartmentCount,
      icon: Building2,
    },
    {
      label: "Закреплено",
      value: pinnedTaskCount,
      icon: Pin,
    },
  ];

  async function saveFocus() {
    if (!onUpdateSettings || saving) return;
    setSaving(true);
    try {
      await onUpdateSettings({
        focus_label_ids: focusDraft.map((label) => label.id),
      });
      toastSuccess("Фокус встречи обновлён");
      setSettingsOpen(false);
    } catch (error) {
      toastError(
        error instanceof Error ? error.message : "Не удалось обновить фокус встречи",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-heading font-semibold text-foreground">
              Область доски
            </h2>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {selectedFocusLabels.length > 0 ? (
              <TaskLabelChips labels={selectedFocusLabels} maxVisible={3} />
            ) : (
              <Badge
                variant="outline"
                className="rounded-full border-dashed text-muted-foreground"
              >
                Фокус не задан
              </Badge>
            )}
            {focusLabelCount > selectedFocusLabels.length && (
              <Badge variant="outline" className="rounded-full text-muted-foreground">
                +{focusLabelCount - selectedFocusLabels.length} меток
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <Badge
                key={item.label}
                variant="outline"
                className="gap-1.5 rounded-full bg-background/60 px-2.5 py-1 text-xs text-muted-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}: {item.value}
              </Badge>
            );
          })}

          {isModerator && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Настроить
            </Button>
          )}
        </div>
      </div>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col overflow-y-auto p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-border/70 px-5 py-4 pr-12 text-left">
            <SheetTitle>Область доски</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-5 px-5 py-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Tags className="h-4 w-4 text-primary" />
                Фокус встречи
              </div>
              <TaskLabelPicker
                value={focusDraft}
                onChange={setFocusDraft}
                disabled={saving}
                placeholder="Выбрать метки"
                displayMode="summary"
                showChevron
                allowCreate={false}
                showManagementActions={false}
              />
            </div>

            <Separator />

            <div className="grid gap-3">
              <ScopeReadout
                icon={Users}
                label="Люди"
                value={addedMemberCount}
                names={addedMemberNames}
              />
              <ScopeReadout
                icon={Building2}
                label="Отделы"
                value={addedDepartmentCount}
                names={addedDepartmentNames}
              />
              <ScopeReadout
                icon={Pin}
                label="Закреплено"
                value={pinnedTaskCount}
              />
            </div>
          </div>

          <SheetFooter className="gap-2 border-t border-border/70 px-5 py-4 sm:space-x-0">
            <Button
              variant="outline"
              onClick={() => setSettingsOpen(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button onClick={() => void saveFocus()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function ScopeReadout({
  icon: Icon,
  label,
  value,
  names = [],
}: {
  icon: typeof Users;
  label: string;
  value: number;
  names?: string[];
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">
            {label}
          </span>
        </div>
        <span className="text-sm font-semibold text-foreground">{value}</span>
      </div>
      {names.length > 0 && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {names.join(", ")}
        </p>
      )}
    </div>
  );
}
