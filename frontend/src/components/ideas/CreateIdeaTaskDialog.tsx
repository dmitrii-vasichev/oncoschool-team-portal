"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { Idea, IdeaLinkedTaskCreateRequest, TeamMember } from "@/lib/types";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border/70 bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors hover:border-primary/30 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";

export function CreateIdeaTaskDialog({
  open,
  onOpenChange,
  idea,
  ideaDepartmentId,
  members,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea: Idea;
  ideaDepartmentId?: string | null;
  members: TeamMember[];
  onCreated: (idea: Idea) => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const targetDepartmentName = ideaDepartmentId
    ? idea.departments.find((department) => department.id === ideaDepartmentId)?.department
        ?.name || null
    : null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setDescription("");
    setAssigneeId("");
    setDeadline("");
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !saving) resetForm();
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Введите название задачи");
      return;
    }

    const trimmedDescription = description.trim();
    const payload: IdeaLinkedTaskCreateRequest = {
      title: trimmedTitle,
      description: trimmedDescription || null,
      assignee_id: assigneeId || null,
      deadline: deadline || null,
      priority: "normal",
    };

    setSaving(true);
    setError(null);
    try {
      const updated = ideaDepartmentId
        ? await api.createIdeaDepartmentTask(idea.id, ideaDepartmentId, payload)
        : await api.createIdeaTask(idea.id, payload);
      resetForm();
      onCreated(updated);
      onOpenChange(false);
      toastSuccess("Задача создана");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось создать задачу";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-1.5rem)] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Новая задача по идее</DialogTitle>
          <DialogDescription>
            {targetDepartmentName
              ? `Создайте связанную задачу для отдела ${targetDepartmentName}.`
              : "Создайте связанную задачу без перехода из карточки идеи."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-2">
            <Label htmlFor="idea-task-title">
              Название <span className="text-destructive">*</span>
            </Label>
            <Input
              id="idea-task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Что нужно сделать?"
              className="h-9 border-border/70 bg-muted/20"
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idea-task-description">Описание</Label>
            <Textarea
              id="idea-task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Контекст, ожидаемый результат, ссылки"
              rows={3}
              className="min-h-[88px] resize-none border-border/70 bg-muted/20"
              disabled={saving}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="idea-task-assignee">Исполнитель</Label>
              <select
                id="idea-task-assignee"
                value={assigneeId || "none"}
                onChange={(event) =>
                  setAssigneeId(event.target.value === "none" ? "" : event.target.value)
                }
                className={SELECT_CLASS}
                disabled={saving}
              >
                <option value="none">Не назначен</option>
                {members
                  .filter((member) => member.is_active)
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="idea-task-deadline">Дедлайн</Label>
              <Input
                id="idea-task-deadline"
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className="h-9 border-border/70 bg-muted/20"
                disabled={saving}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Создать задачу
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
