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
import { UserAvatar } from "@/components/shared/UserAvatar";
import { DatePicker } from "@/components/shared/DatePicker";
import {
  AlertTriangle,
  ArrowUp,
  Minus,
  ArrowDown,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import type { TeamMember, TaskPriority } from "@/lib/types";
import { TASK_PRIORITY_LABELS } from "@/lib/types";
import { PermissionService } from "@/lib/permissions";

const PRIORITY_OPTIONS: {
  value: TaskPriority;
  icon: typeof AlertTriangle;
  color: string;
  activeColor: string;
  ringColor: string;
}[] = [
  {
    value: "urgent",
    icon: AlertTriangle,
    color: "text-priority-urgent-fg",
    activeColor: "bg-priority-urgent-bg border-priority-urgent-dot",
    ringColor: "ring-priority-urgent-dot/30",
  },
  {
    value: "high",
    icon: ArrowUp,
    color: "text-priority-high-fg",
    activeColor: "bg-priority-high-bg border-priority-high-dot",
    ringColor: "ring-priority-high-dot/30",
  },
  {
    value: "medium",
    icon: Minus,
    color: "text-priority-medium-fg",
    activeColor: "bg-priority-medium-bg border-priority-medium-dot",
    ringColor: "ring-priority-medium-dot/30",
  },
  {
    value: "low",
    icon: ArrowDown,
    color: "text-priority-low-fg",
    activeColor: "bg-priority-low-bg border-priority-low-dot",
    ringColor: "ring-priority-low-dot/30",
  },
];

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
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState<string>(
    canAssignToOthers ? "" : currentUser.id
  );
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAssigneeId(canAssignToOthers ? "" : currentUser.id);
    setDeadline("");
    setError(null);
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
      <DialogContent className="sm:max-w-[480px] backdrop-blur-sm">
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

          {/* Priority — visual buttons */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Приоритет</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRIORITY_OPTIONS.map(({ value, icon: Icon, color, activeColor, ringColor }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  className={`
                    flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-2.5
                    text-xs font-medium
                    ${
                      priority === value
                        ? `${activeColor} ${color} ring-2 ${ringColor} shadow-sm`
                        : "border-border/40 text-muted-foreground hover:border-border hover:bg-muted/50"
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {TASK_PRIORITY_LABELS[value]}
                </button>
              ))}
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
