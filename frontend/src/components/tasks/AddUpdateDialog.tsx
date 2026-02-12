"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import type { UpdateType } from "@/lib/types";

const UPDATE_TYPE_OPTIONS: { value: UpdateType; label: string }[] = [
  { value: "progress", label: "Прогресс" },
  { value: "comment", label: "Комментарий" },
  { value: "blocker", label: "Блокер" },
];

export function AddUpdateDialog({
  open,
  onOpenChange,
  shortId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortId: number;
  onCreated: () => void;
}) {
  const [content, setContent] = useState("");
  const [updateType, setUpdateType] = useState<UpdateType>("progress");
  const [progressPercent, setProgressPercent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setContent("");
    setUpdateType("progress");
    setProgressPercent("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("Введите текст обновления");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const percent = progressPercent ? parseInt(progressPercent, 10) : null;
      await api.createTaskUpdate(shortId, {
        content: content.trim(),
        update_type: updateType,
        progress_percent:
          percent !== null && !isNaN(percent)
            ? Math.min(100, Math.max(0, percent))
            : null,
        source: "web",
      });
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка добавления обновления");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Обновление к #{shortId}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Тип</Label>
            <Select
              value={updateType}
              onValueChange={(v) => setUpdateType(v as UpdateType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UPDATE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Текст *</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Что изменилось?"
              rows={3}
              autoFocus
            />
          </div>

          {updateType === "progress" && (
            <div className="space-y-2">
              <Label htmlFor="progress">Прогресс (%)</Label>
              <Input
                id="progress"
                type="number"
                min={0}
                max={100}
                value={progressPercent}
                onChange={(e) => setProgressPercent(e.target.value)}
                placeholder="0-100"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Сохранение..." : "Добавить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
