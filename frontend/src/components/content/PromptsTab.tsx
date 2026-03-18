"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/shared/Toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { api } from "@/lib/api";
import type { AnalysisPrompt } from "@/lib/types";

interface PromptsTabProps {
  isEditor: boolean;
}

export function PromptsTab({ isEditor }: PromptsTabProps) {
  const { toastSuccess, toastError } = useToast();
  const [prompts, setPrompts] = useState<AnalysisPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPrompt, setEditPrompt] = useState<AnalysisPrompt | null>(null);
  const [viewPrompt, setViewPrompt] = useState<AnalysisPrompt | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<AnalysisPrompt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPrompts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPrompts();
      setPrompts(data);
    } catch {
      toastError("Не удалось загрузить промпты");
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const handleDelete = async () => {
    if (!deletePrompt) return;
    setDeleting(true);
    try {
      await api.deletePrompt(deletePrompt.id);
      setPrompts((prev) => prev.filter((p) => p.id !== deletePrompt.id));
      toastSuccess("Промпт удалён");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
      setDeletePrompt(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {prompts.length} {prompts.length === 1 ? "промпт" : "промптов"}
        </p>
        {isEditor && (
          <Button
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Создать промпт
          </Button>
        )}
      </div>

      {/* Prompts grid */}
      {prompts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Промптов ещё нет</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="rounded-xl border border-border/60 bg-card p-4 hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => setViewPrompt(prompt)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm truncate">
                    {prompt.title}
                  </h3>
                  {prompt.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {prompt.description}
                    </p>
                  )}
                </div>
                {isEditor && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditPrompt(prompt);
                        setShowForm(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletePrompt(prompt);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                {prompt.created_by_name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {prompt.created_by_name}
                  </span>
                )}
                <span>
                  {new Date(prompt.created_at).toLocaleDateString("ru-RU")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View dialog */}
      <Dialog open={!!viewPrompt} onOpenChange={(open) => !open && setViewPrompt(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewPrompt?.title}</DialogTitle>
          </DialogHeader>
          {viewPrompt?.description && (
            <p className="text-sm text-muted-foreground">{viewPrompt.description}</p>
          )}
          <pre className="text-sm whitespace-pre-wrap bg-muted/50 rounded-xl p-4 border border-border/40 max-h-96 overflow-y-auto">
            {viewPrompt?.text}
          </pre>
        </DialogContent>
      </Dialog>

      {/* Create/Edit form */}
      <PromptFormDialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditPrompt(null);
          }
        }}
        prompt={editPrompt}
        onSaved={() => {
          setShowForm(false);
          setEditPrompt(null);
          fetchPrompts();
        }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deletePrompt}
        onOpenChange={(open) => !open && setDeletePrompt(null)}
        title="Удалить промпт?"
        description={`"${deletePrompt?.title}" будет удалён.`}
        confirmLabel="Удалить"
        variant="destructive"
        onConfirm={handleDelete}
        confirmDisabled={deleting}
      />
    </div>
  );
}

/* ── Prompt Form Dialog ── */

function PromptFormDialog({
  open,
  onOpenChange,
  prompt,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: AnalysisPrompt | null;
  onSaved: () => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = !!prompt;

  useEffect(() => {
    if (open && prompt) {
      setTitle(prompt.title);
      setDescription(prompt.description || "");
      setText(prompt.text);
    } else if (open) {
      setTitle("");
      setDescription("");
      setText("");
    }
  }, [open, prompt]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEdit && prompt) {
        await api.updatePrompt(prompt.id, {
          title: title.trim(),
          description: description.trim() || null,
          text: text.trim(),
        });
        toastSuccess("Промпт обновлён");
      } else {
        await api.createPrompt({
          title: title.trim(),
          description: description.trim() || null,
          text: text.trim(),
        });
        toastSuccess("Промпт создан");
      }
      onSaved();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Редактировать промпт" : "Создать промпт"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Название</Label>
            <Input
              placeholder="Название промпта"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Описание (опционально)</Label>
            <Input
              placeholder="Краткое описание"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Текст промпта</Label>
            <Textarea
              placeholder="Инструкция для AI..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded-xl min-h-[200px] font-mono text-sm"
            />
          </div>
          <Button
            className="w-full rounded-xl"
            onClick={handleSave}
            disabled={saving || !title.trim() || !text.trim()}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit ? (
              "Сохранить"
            ) : (
              "Создать"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
