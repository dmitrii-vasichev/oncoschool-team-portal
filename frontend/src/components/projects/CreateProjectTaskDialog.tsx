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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { Project, ProjectLinkedTaskCreateRequest, TeamMember } from "@/lib/types";

export function CreateProjectTaskDialog({
  open,
  onOpenChange,
  project,
  projectDepartmentId,
  members,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  projectDepartmentId?: string | null;
  members: TeamMember[];
  onCreated: (project: Project) => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const targetDepartmentName = projectDepartmentId
    ? project.departments.find((department) => department.id === projectDepartmentId)
        ?.department?.name || null
    : null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeMembers = members.filter((member) => member.is_active);

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
    const payload: ProjectLinkedTaskCreateRequest = {
      title: trimmedTitle,
      description: trimmedDescription || null,
      assignee_id: assigneeId || null,
      deadline: deadline || null,
      priority: "normal",
    };

    setSaving(true);
    setError(null);
    try {
      const updated = projectDepartmentId
        ? await api.createProjectDepartmentTask(project.id, projectDepartmentId, payload)
        : await api.createProjectTask(project.id, payload);
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
          <DialogTitle className="text-lg">Новая задача по проекту</DialogTitle>
          <DialogDescription>
            {targetDepartmentName
              ? `Создайте связанную задачу для отдела ${targetDepartmentName}.`
              : "Создайте связанную задачу без перехода из карточки проекта."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-2">
            <Label htmlFor="project-task-title">
              Название <span className="text-destructive">*</span>
            </Label>
            <Input
              id="project-task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Что нужно сделать?"
              className="h-9 border-border/70 bg-muted/20"
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-task-description">Описание</Label>
            <Textarea
              id="project-task-description"
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
              <Label htmlFor="project-task-assignee">Исполнитель</Label>
              <Select
                value={assigneeId || "none"}
                onValueChange={(value) =>
                  setAssigneeId(value === "none" ? "" : value)
                }
                disabled={saving}
              >
                <SelectTrigger
                  id="project-task-assignee"
                  className="h-9 border-border/70 bg-muted/20 text-sm shadow-sm transition-colors hover:border-primary/30 focus:border-primary/40 focus:ring-primary/20"
                >
                  <SelectValue placeholder="Не назначен" />
                </SelectTrigger>
                <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
                  <SelectItem value="none">Не назначен</SelectItem>
                  {activeMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-task-deadline">Дедлайн</Label>
              <DatePicker
                value={deadline}
                onChange={setDeadline}
                placeholder="Не указан"
                clearable
                className="h-9 w-full border-border/70 bg-muted/20 text-sm shadow-sm transition-colors hover:border-primary/30 focus:border-primary/40 focus:ring-primary/20"
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

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
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Создать задачу
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
