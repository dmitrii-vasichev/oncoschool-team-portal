"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useToast } from "@/components/shared/Toast";
import { parseUTCDate } from "@/lib/dateUtils";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

function formatCommentDate(value: string): string {
  const parsed = parseUTCDate(value);
  if (Number.isNaN(parsed.getTime())) return "Дата не указана";

  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProjectComments({
  project,
  onUpdated,
}: {
  project: Project;
  onUpdated: (project: Project) => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      toastError("Введите комментарий");
      return;
    }

    setSaving(true);
    try {
      const updated = await api.addProjectComment(project.id, {
        body: trimmedBody,
      });
      onUpdated(updated);
      setBody("");
      toastSuccess("Комментарий добавлен");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось добавить комментарий");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Комментарии</h2>
            <p className="text-xs text-muted-foreground">
              {project.comments.length} записей
            </p>
          </div>
          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="space-y-2">
          {project.comments.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
              Комментариев пока нет
            </div>
          ) : (
            project.comments.map((comment) => {
              const authorName = comment.author?.full_name || "Автор не указан";

              return (
                <article
                  key={comment.id}
                  className="rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <UserAvatar
                        name={authorName}
                        avatarUrl={comment.author?.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {authorName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCommentDate(comment.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-5 text-foreground/90">
                    {comment.body}
                  </p>
                </article>
              );
            })
          )}
        </div>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Добавить комментарий"
            className="min-h-20 resize-y text-sm"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={saving}
              className="h-8 rounded-md px-3 text-xs"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Добавить
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
