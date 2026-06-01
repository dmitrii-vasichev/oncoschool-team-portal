"use client";

import { useState } from "react";
import { Activity, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useToast } from "@/components/shared/Toast";
import { useActivity } from "@/hooks/useActivity";
import { useTeam } from "@/hooks/useTeam";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { KudosDialog } from "@/components/pulse/KudosDialog";
import { isRecognitionEvent, kudosText, milestoneText } from "./pulseRecognition";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ActivityEvent, PulseEmoji } from "@/lib/types";

const EMOJI: Record<PulseEmoji, string> = {
  clap: "👏",
  fire: "🔥",
  party: "🎉",
  ok: "👍",
  broom: "🧹",
  shrug: "🤷",
};

const EMOJI_LABEL: Record<PulseEmoji, string> = {
  clap: "Похлопать",
  fire: "Огонь",
  party: "Поздравить",
  ok: "Ок",
  broom: "Разгребли",
  shrug: "Ну что ж",
};

const CELEBRATORY: PulseEmoji[] = ["clap", "fire", "party"];
const CANCELLATION: PulseEmoji[] = ["ok", "broom", "shrug"];

function reactionSet(e: ActivityEvent): PulseEmoji[] {
  return e.event_type === "task_cancelled" ? CANCELLATION : CELEBRATORY;
}

// Verb used when we CAN open the task (the title is shown on the next line).
function actionVerb(e: ActivityEvent): string {
  switch (e.event_type) {
    case "task_completed":
      return "закрыл";
    case "task_cancelled":
      return "отменил";
    case "blocker_raised":
      return "поднял блокер на";
    default:
      return "обновил прогресс на";
  }
}

// Redacted phrase when we CANNOT open the task (no title available).
function actionPhraseRedacted(e: ActivityEvent): string {
  switch (e.event_type) {
    case "task_completed":
      return "закрыл задачу";
    case "task_cancelled":
      return "отменил задачу";
    case "blocker_raised":
      return "поднял блокер";
    default:
      return "обновил прогресс";
  }
}

// Second line: the task title in « », plus reason (cancelled) / percent (progress).
function eventTitleLine(e: ActivityEvent): string | null {
  if (!e.can_open || !e.task_title) return null;
  let line = `«${e.task_title}»`;
  if (e.event_type === "task_cancelled" && e.reason) line += ` — ${e.reason}`;
  if (e.event_type === "progress_update" && e.progress_percent != null)
    line += ` → ${e.progress_percent}%`;
  return line;
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayLabel(d: Date): string {
  const today = startOfLocalDay(new Date());
  const day = startOfLocalDay(d);
  const oneDay = 24 * 60 * 60 * 1000;
  if (day === today) return "Сегодня";
  if (day === today - oneDay) return "Вчера";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DayGroup = { key: number; label: string; events: ActivityEvent[] };

function groupByDay(items: ActivityEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const e of items) {
    const d = new Date(e.created_at);
    const key = startOfLocalDay(d);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: dayLabel(d), events: [] };
      groups.push(g);
    }
    g.events.push(e);
  }
  // items already arrive newest-first; preserve that order.
  return groups;
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
  const { members } = useTeam();
  const { user } = useCurrentUser();
  const { toastError } = useToast();
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [kudosOpen, setKudosOpen] = useState(false);
  const currentUserId = user?.id ?? "";

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

  // Shared reactions row, reused by every card type so reactions work
  // identically on completed/cancelled/blocker/progress and kudos/milestones.
  function reactionsRow(e: ActivityEvent) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {formatTime(e.created_at)}
        </span>
        <div className="flex gap-2">
          {reactionSet(e).map((em) => {
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
    );
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
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold leading-7 text-foreground">
            Пульс команды
          </h1>
          <p className="text-sm text-muted-foreground">
            Закрытые задачи, блокеры, благодарности и вехи команды
          </p>
        </div>
        {currentUserId && (
          <Button
            size="sm"
            onClick={() => setKudosOpen(true)}
            className="h-8 shrink-0 gap-1.5 rounded-xl px-3 text-xs"
          >
            <Heart className="h-3.5 w-3.5" />
            Поблагодарить
          </Button>
        )}
      </div>

      {currentUserId && (
        <KudosDialog
          open={kudosOpen}
          onOpenChange={setKudosOpen}
          currentUserId={currentUserId}
          members={members}
          onSent={refetch}
        />
      )}

      {items.length === 0 ? (
        <EmptyState
          variant="updates"
          title="Пока тихо"
          description="Закрытые задачи, блокеры и благодарности появятся здесь."
        />
      ) : (
        <div className="max-w-2xl space-y-6">
          {groupByDay(items).map((group) => (
            <div key={group.key} className="space-y-3">
              {/* Day header */}
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <div className="h-px flex-1 bg-border/70" />
              </div>

              {group.events.map((e) => {
                // ── Recognition cards: kudos + milestones ──
                if (isRecognitionEvent(e.event_type)) {
                  if (e.event_type === "kudos") {
                    const { who, recipient, message } = kudosText(e);
                    return (
                      <div
                        key={e.id}
                        className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4"
                      >
                        <UserAvatar
                          name={e.actor_name}
                          avatarUrl={e.actor_avatar_url}
                          size="default"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            <b className="font-semibold">{who}</b> поблагодарил{" "}
                            <b className="font-semibold">{recipient}</b>
                          </p>
                          {message && (
                            <p className="text-sm text-muted-foreground">
                              «{message}»
                            </p>
                          )}
                          {reactionsRow(e)}
                        </div>
                      </div>
                    );
                  }
                  // milestone_team / milestone_personal
                  const badge = e.event_type === "milestone_team" ? "🏆" : "🛡️";
                  return (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg">
                        {badge}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">{milestoneText(e)}</p>
                        {reactionsRow(e)}
                      </div>
                    </div>
                  );
                }

                const isCancelled = e.event_type === "task_cancelled";
                const titleLine = eventTitleLine(e);
                const who = e.actor_name ?? "Кто-то";
                const dept = e.department_name ? ` (${e.department_name})` : "";
                return (
                  <div
                    key={e.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-4",
                      isCancelled
                        ? "border-border/50 bg-muted/40"
                        : "border-border/70 bg-card"
                    )}
                  >
                    <UserAvatar
                      name={e.actor_name}
                      avatarUrl={e.actor_avatar_url}
                      size="default"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm",
                          isCancelled ? "text-muted-foreground" : "text-foreground"
                        )}
                      >
                        <span className="font-semibold text-foreground">{who}</span>{" "}
                        {titleLine
                          ? actionVerb(e)
                          : `${actionPhraseRedacted(e)}${dept}`}
                      </p>
                      {titleLine && (
                        <p className="text-sm text-muted-foreground">{titleLine}</p>
                      )}
                      {reactionsRow(e)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
