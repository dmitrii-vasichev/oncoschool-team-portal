"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TaskLabel, TaskLabelColor } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  TASK_LABEL_COLOR_OPTIONS,
  labelSwatchClass,
} from "./taskLabelUtils";

export function TaskLabelEditDialog({
  label,
  open,
  saving,
  onOpenChange,
  onSave,
}: {
  label: TaskLabel | null;
  open: boolean;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; color: TaskLabelColor }) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<TaskLabelColor>("teal");

  useEffect(() => {
    if (!label || !open) return;
    setName(label.name);
    setColor(
      TASK_LABEL_COLOR_OPTIONS.some((option) => option.value === label.color)
        ? (label.color as TaskLabelColor)
        : "slate"
    );
  }, [label, open]);

  const normalizedName = name.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Редактировать метку</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-label-name">Название</Label>
            <Input
              id="task-label-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label>Цвет</Label>
            <div className="grid grid-cols-4 gap-2">
              {TASK_LABEL_COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={color === option.value}
                  disabled={saving}
                  onClick={() => setColor(option.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium",
                    color === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 hover:bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "h-3 w-3 rounded-full",
                      labelSwatchClass(option.value)
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Отмена
          </Button>
          <Button
            type="button"
            disabled={saving || !normalizedName}
            onClick={() => onSave({ name: normalizedName, color })}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
