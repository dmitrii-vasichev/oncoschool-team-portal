"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { DatePicker } from "@/components/shared/DatePicker";
import { TaskLabelPicker } from "@/components/tasks/TaskLabelPicker";
import {
  AlertTriangle,
  CalendarDays,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import type {
  TaskChecklistItem,
  TaskLabel,
  TeamMember,
  TaskPriority,
} from "@/lib/types";
import { PermissionService } from "@/lib/permissions";

function createChecklistId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  currentUser,
  members,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: TeamMember;
  members: TeamMember[];
  onCreated: () => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const canAssignToOthers = PermissionService.canCreateTaskForOthers(currentUser);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>(
    canAssignToOthers ? "" : currentUser.id
  );
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setDescription("");
    setLabels([]);
    setPriority("normal");
    setChecklist([]);
    setNewChecklistItem("");
    setAssigneeId(canAssignToOthers ? "" : currentUser.id);
    setDeadline("");
    setError(null);
  }

  function addChecklistItem() {
    const itemTitle = newChecklistItem.trim();
    if (!itemTitle) return;
    setChecklist((items) => [
      ...items,
      {
        id: createChecklistId(),
        title: itemTitle,
        is_completed: false,
      },
    ]);
    setNewChecklistItem("");
  }

  function removeChecklistItem(itemId: string) {
    setChecklist((items) => items.filter((item) => item.id !== itemId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Введите название задачи");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.createTask({
        title: title.trim(),
        description: description.trim() || null,
        checklist,
        label_ids: labels.map((label) => label.id),
        priority,
        assignee_id: assigneeId || null,
        source: "web",
        deadline: deadline || null,
      });
      resetForm();
      onOpenChange(false);
      onCreated();
      toastSuccess("Задача создана");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка создания задачи";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px] backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">Новая задача</DialogTitle>
          <DialogDescription>
            Заполните детали для создания задачи
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="create-title" className="text-sm font-medium">
              Название <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Что нужно сделать?"
              className="h-11 bg-muted/30 border-border/60 focus:bg-card"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="create-desc" className="text-sm font-medium">
              Описание
            </Label>
            <Textarea
              id="create-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Подробности задачи..."
              rows={3}
              className="bg-muted/30 border-border/60 focus:bg-card resize-none min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Метки</Label>
            <TaskLabelPicker
              value={labels}
              onChange={setLabels}
              disabled={saving}
              placeholder="Добавить метки"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-urgent" className="text-sm font-medium">
              Срочность
            </Label>
            <div
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                priority === "urgent"
                  ? "border-priority-urgent-dot/60 bg-priority-urgent-bg text-priority-urgent-fg"
                  : "border-border/60 bg-muted/30"
              }`}
            >
              <span className="text-sm font-medium">
                {priority === "urgent" ? "Срочная" : "Обычная"}
              </span>
              <Switch
                id="create-urgent"
                checked={priority === "urgent"}
                onCheckedChange={(checked) =>
                  setPriority(checked ? "urgent" : "normal")
                }
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="create-checklist-item"
              className="text-sm font-medium"
            >
              Чек-лист
            </Label>
            <div className="space-y-2">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(item.id)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Удалить пункт чек-листа"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <Input
                  id="create-checklist-item"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addChecklistItem();
                    }
                  }}
                  placeholder="Добавить пункт"
                  disabled={saving}
                  className="h-10 bg-muted/30 border-border/60"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addChecklistItem}
                  disabled={saving || !newChecklistItem.trim()}
                  className="h-10 gap-1.5 border-border/60"
                >
                  <Plus className="h-4 w-4" />
                  Добавить
                </Button>
              </div>
            </div>
          </div>

          {/* Deadline + Assignee row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                <CalendarDays className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                Дедлайн
              </Label>
              <DatePicker
                value={deadline}
                onChange={setDeadline}
                placeholder="Выбрать"
                clearable
                className="w-full h-10 bg-muted/30 border-border/60"
              />
            </div>

            {canAssignToOthers && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Исполнитель</Label>
                <Select
                  value={assigneeId || "none"}
                  onValueChange={(v) =>
                    setAssigneeId(v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger className="h-10 bg-muted/30 border-border/60">
                    <SelectValue placeholder="Не назначен" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Не назначен</span>
                    </SelectItem>
                    {members
                      .filter((m) => m.is_active)
                      .map((m) => (
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
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Footer */}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border/60"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={saving || !title.trim()}
              className="min-w-[100px] bg-accent hover:bg-accent/90 text-accent-foreground shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : (
                "Создать"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
