"use client";

import { useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Circle,
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { TaskChecklistItem } from "@/lib/types";

function createChecklistId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function TaskChecklist({
  items,
  canEdit,
  isSaving,
  onChange,
}: {
  items: TaskChecklistItem[];
  canEdit: boolean;
  isSaving: boolean;
  onChange: (next: TaskChecklistItem[]) => Promise<void>;
}) {
  const [newItemTitle, setNewItemTitle] = useState("");
  const totalCount = items.length;
  const completedCount = items.filter((item) => item.is_completed).length;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  async function handleToggle(itemId: string) {
    if (!canEdit || isSaving) return;
    const next = items.map((item) =>
      item.id === itemId ? { ...item, is_completed: !item.is_completed } : item
    );
    await onChange(next);
  }

  async function handleRemove(itemId: string) {
    if (!canEdit || isSaving) return;
    const next = items.filter((item) => item.id !== itemId);
    await onChange(next);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || isSaving) return;

    const title = newItemTitle.trim();
    if (!title) return;

    const next = [
      ...items,
      {
        id: createChecklistId(),
        title,
        is_completed: false,
      },
    ];

    await onChange(next);
    setNewItemTitle("");
  }

  return (
    <div className="mt-8 mb-2">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-2xs uppercase tracking-wider text-muted-foreground font-medium inline-flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" />
          Чек-лист
        </h3>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{totalCount}
        </span>
      </div>

      {totalCount > 0 && (
        <div className="mb-3 space-y-2">
          <Progress value={progress} className="h-1.5 bg-muted" />
          <p className="text-2xs text-muted-foreground">
            Выполнено: {progress}%
          </p>
        </div>
      )}

      <div className="space-y-2">
        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
            Подзадач пока нет.
          </div>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "group flex items-start gap-2 rounded-lg border px-3 py-2",
              item.is_completed
                ? "border-status-done-ring/40 bg-status-done-bg/30"
                : "border-border/70 bg-card"
            )}
          >
            <button
              type="button"
              onClick={() => {
                void handleToggle(item.id);
              }}
              disabled={!canEdit || isSaving}
              className="mt-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label={item.is_completed ? "Снять выполнение" : "Отметить выполненной"}
            >
              {item.is_completed ? (
                <CheckCircle2 className="h-4 w-4 text-status-done-fg" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </button>

            <span
              className={cn(
                "flex-1 text-sm leading-relaxed",
                item.is_completed
                  ? "line-through text-muted-foreground"
                  : "text-foreground/90"
              )}
            >
              {item.title}
            </span>

            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  void handleRemove(item.id);
                }}
                disabled={isSaving}
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={(e) => { void handleAdd(e); }} className="mt-3 flex items-center gap-2">
          <Input
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="Добавить подзадачу"
            className="h-9"
            disabled={isSaving}
          />
          <Button type="submit" size="sm" disabled={isSaving || !newItemTitle.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Добавить
          </Button>
        </form>
      )}
    </div>
  );
}
