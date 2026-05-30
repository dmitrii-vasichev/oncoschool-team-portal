"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/components/shared/Toast";
import { useActivity } from "@/hooks/useActivity";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ActivityEvent, PulseEmoji } from "@/lib/types";

const EMOJI: Record<PulseEmoji, string> = {
  clap: "👏",
  fire: "🔥",
  party: "🎉",
};

const EMOJI_LABEL: Record<PulseEmoji, string> = {
  clap: "Похлопать",
  fire: "Огонь",
  party: "Поздравить",
};

const EMOJI_ORDER: PulseEmoji[] = ["clap", "fire", "party"];

function eventLine(e: ActivityEvent): string {
  const who = e.actor_name ?? "Кто-то";
  const dept = e.department_name ? ` (${e.department_name})` : "";

  if (e.event_type === "task_completed") {
    return e.can_open && e.task_title
      ? `${who} закрыл «${e.task_title}» (#${e.task_short_id})`
      : `${who}${dept} закрыл задачу 🎉`;
  }
  if (e.event_type === "blocker_raised") {
    return e.can_open && e.task_title
      ? `${who} поднял блокер на «${e.task_title}»`
      : `${who}${dept} поднял блокер`;
  }
  return e.can_open && e.task_title
    ? `${who} обновил прогресс → ${e.progress_percent ?? "?"}% на «${e.task_title}»`
    : `${who}${dept} обновил прогресс`;
}

function PulseLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function PulsePage() {
  const { items, loading, refetch } = useActivity();
  const { toastError } = useToast();
  const [reactingId, setReactingId] = useState<string | null>(null);

  async function react(e: ActivityEvent, emoji: PulseEmoji) {
    setReactingId(e.id);
    try {
      await api.reactToEvent(e.id, emoji);
      await refetch();
    } catch {
      toastError("Не удалось поставить реакцию");
    } finally {
      setReactingId(null);
    }
  }

  if (loading) {
    return <PulseLoadingSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Activity className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-7 text-foreground">
            Team Pulse
          </h1>
          <p className="text-sm text-muted-foreground">
            Закрытые задачи, блокеры и прогресс команды
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          variant="updates"
          title="Пока тихо"
          description="Закрытые задачи и блокеры появятся здесь."
        />
      ) : (
        <div className="max-w-2xl space-y-3">
          {items.map((e) => (
            <div
              key={e.id}
              className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4"
            >
              <p className="text-sm text-foreground">{eventLine(e)}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString("ru-RU")}
              </p>
              <div className="flex gap-2 pt-0.5">
                {EMOJI_ORDER.map((em) => {
                  const count = e.reactions.counts[em] ?? 0;
                  const mine = e.reactions.mine.includes(em);
                  return (
                    <button
                      key={em}
                      type="button"
                      onClick={() => react(e, em)}
                      disabled={reactingId === e.id}
                      aria-label={EMOJI_LABEL[em]}
                      title={EMOJI_LABEL[em]}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-sm transition-colors disabled:opacity-50",
                        mine
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/70 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {EMOJI[em]}
                      {count > 0 ? ` ${count}` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
