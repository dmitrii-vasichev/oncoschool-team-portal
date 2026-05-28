"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  USER_CANCELLATION_REASONS,
  type CancellationReasonCode,
} from "@/lib/cancellation";
import type { Task } from "@/lib/types";

export function CancelTaskDialog({
  open,
  onOpenChange,
  task,
  onCancelled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  onCancelled: (task: Task) => void;
}) {
  const [reason, setReason] = useState<CancellationReasonCode | "">("");
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setReason("");
    setReasonText("");
    setSaving(false);
    setError(null);
  }

  const requiresText = reason === "other";
  const trimmedText = reasonText.trim();
  const canConfirm =
    !!reason && (!requiresText || trimmedText.length > 0) && !saving;

  async function handleConfirm() {
    if (!reason) {
      setError("Выберите причину отмены");
      return;
    }
    if (requiresText && !trimmedText) {
      setError("Опишите причину отмены");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await api.cancelTask(
        task.short_id,
        reason,
        requiresText ? trimmedText : undefined
      );
      resetForm();
      onOpenChange(false);
      onCancelled(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отменить задачу");
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
          <DialogTitle>Отменить задачу #{task.short_id}</DialogTitle>
          <DialogDescription>
            Укажите причину отмены. Задача перейдёт в статус «Отменено».
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              Причина <span className="text-destructive">*</span>
            </Label>
            <Select
              value={reason}
              onValueChange={(v) => {
                setReason(v as CancellationReasonCode);
                setError(null);
              }}
            >
              <SelectTrigger id="cancel-reason">
                <SelectValue placeholder="Выберите причину" />
              </SelectTrigger>
              <SelectContent>
                {USER_CANCELLATION_REASONS.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresText && (
            <div className="space-y-2">
              <Label htmlFor="cancel-reason-text">
                Комментарий <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="cancel-reason-text"
                value={reasonText}
                onChange={(e) => {
                  setReasonText(e.target.value);
                  setError(null);
                }}
                placeholder="Почему задача отменяется?"
                rows={3}
                autoFocus
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
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
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Отмена...
              </>
            ) : (
              "Отменить задачу"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
