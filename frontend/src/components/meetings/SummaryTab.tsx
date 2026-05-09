"use client";

import { CheckCircle2, Clock3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Meeting } from "@/lib/types";
import { getMeetingSummaryDisplayState } from "./meetingOutcomeFlowUtils";

interface SummaryTabProps {
  meeting: Meeting;
  onSwitchToTranscript: () => void;
}

export function SummaryTab({
  meeting,
  onSwitchToTranscript,
}: SummaryTabProps) {
  const displayState = getMeetingSummaryDisplayState(meeting);

  if (displayState === "published") {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h3 className="mb-3 text-sm font-heading font-semibold uppercase tracking-wider text-muted-foreground">
            Краткое резюме
          </h3>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
            {meeting.parsed_summary}
          </p>
        </div>

        {meeting.decisions && meeting.decisions.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-heading font-semibold uppercase tracking-wider text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-status-done-fg" />
              Решения
            </h3>
            <ul className="space-y-3">
              {meeting.decisions.map((decision, index) => (
                <li
                  key={`${decision}-${index}`}
                  className="flex items-start gap-3 animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-status-done-bg text-xs font-semibold text-status-done-fg">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-sm leading-relaxed text-foreground">
                    {decision}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (displayState === "awaiting_outcomes") {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
          <Clock3 className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <h3 className="text-sm font-heading font-semibold">
          Итоги ещё не опубликованы
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          После публикации итогов встречи здесь появятся резюме и решения.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
        <FileText className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground">
        Для создания резюме сначала добавьте транскрипцию
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={onSwitchToTranscript}
        className="mt-2 gap-1 text-xs text-primary"
      >
        <FileText className="h-3.5 w-3.5" />
        Перейти к транскрипции
      </Button>
    </div>
  );
}
