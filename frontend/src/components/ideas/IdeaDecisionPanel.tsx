"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/Toast";
import { IDEA_STATUS_LABELS } from "@/lib/ideaUtils";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Idea, IdeaStatus } from "@/lib/types";

const DECISION_STATUSES: IdeaStatus[] = [
  "in_review",
  "accepted",
  "rejected",
  "deferred",
  "completed",
];

function isCommentRequired(status: IdeaStatus): boolean {
  return status === "rejected" || status === "deferred";
}

export function IdeaDecisionPanel({
  idea,
  onUpdated,
}: {
  idea: Idea;
  onUpdated: (idea: Idea) => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [comment, setComment] = useState("");
  const [savingStatus, setSavingStatus] = useState<IdeaStatus | null>(null);

  async function handleStatusChange(status: IdeaStatus) {
    const trimmedComment = comment.trim();
    if (isCommentRequired(status) && !trimmedComment) {
      toastError("Добавьте комментарий для этого решения");
      return;
    }

    setSavingStatus(status);
    try {
      const updated = await api.updateIdeaStatus(idea.id, {
        status,
        comment: trimmedComment || null,
      });
      onUpdated(updated);
      setComment("");
      toastSuccess("Статус идеи обновлён");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось обновить статус");
    } finally {
      setSavingStatus(null);
    }
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Решение</h2>
            <p className="text-xs text-muted-foreground">
              Текущий статус: {IDEA_STATUS_LABELS[idea.status]}
            </p>
          </div>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        {idea.decision_comment && (
          <div className="rounded-md border border-border/60 bg-muted/25 px-3 py-2">
            <p className="text-2xs font-medium uppercase text-muted-foreground">
              Комментарий решения
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-foreground">
              {idea.decision_comment}
            </p>
          </div>
        )}

        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Комментарий к решению"
          className="min-h-20 resize-y text-sm"
        />

        <div className="flex flex-wrap gap-2">
          {DECISION_STATUSES.map((status) => {
            const isCompletedBlocked = status === "completed" && !idea.can_complete;
            const isDisabled =
              savingStatus !== null || idea.status === status || isCompletedBlocked;

            return (
              <Button
                key={status}
                type="button"
                size="sm"
                variant="outline"
                disabled={isDisabled}
                onClick={() => handleStatusChange(status)}
                className={cn(
                  "h-8 rounded-md px-3 text-xs",
                  status === "rejected" &&
                    "border-destructive/35 text-destructive hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive",
                )}
                title={
                  isCompletedBlocked
                    ? "Нельзя завершить: не все условия выполнены"
                    : undefined
                }
              >
                {savingStatus === status && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {IDEA_STATUS_LABELS[status]}
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
