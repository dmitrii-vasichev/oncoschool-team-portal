"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { History, Loader2, MessageSquare, Reply, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import { getContentFactoryDisplayName } from "@/lib/contentFactoryUtils";
import type { CFGuestStoryEvent, TeamMember } from "@/lib/types";

type ContentFactoryGuestActivityPanelProps = {
  guestStoryId: string;
  events: CFGuestStoryEvent[];
  members: TeamMember[];
  onEventCreated: () => void | Promise<void>;
};

const EVENT_LABELS: Record<CFGuestStoryEvent["event_type"], string> = {
  created: "История создана",
  comment: "Комментарий",
  status_changed: "Статус изменён",
  consent_changed: "Согласие изменено",
  gift_changed: "Подарок изменён",
  follow_up_changed: "Follow-up изменён",
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Без даты";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function eventActorName(event: CFGuestStoryEvent, members: TeamMember[]): string {
  return event.actor_id
    ? getContentFactoryDisplayName(event.actor_id, members)
    : "Система";
}

function eventSummary(event: CFGuestStoryEvent): string {
  const body = event.body?.trim().replace(/\s+/g, " ");
  if (body) return body.length > 120 ? `${body.slice(0, 117)}...` : body;
  return EVENT_LABELS[event.event_type];
}

export function ContentFactoryGuestActivityPanel({
  guestStoryId,
  events,
  members,
  onEventCreated,
}: ContentFactoryGuestActivityPanelProps) {
  const { toastSuccess, toastError } = useToast();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingToEventId, setReplyingToEventId] = useState<string | null>(
    null,
  );
  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [events],
  );
  const eventById = useMemo(
    () => new Map(sortedEvents.map((event) => [event.id, event])),
    [sortedEvents],
  );
  const replyingToEvent = replyingToEventId
    ? eventById.get(replyingToEventId) || null
    : null;
  const eventThreads = useMemo(() => {
    const eventIds = new Set(sortedEvents.map((event) => event.id));
    const repliesByParentId = new Map<string, CFGuestStoryEvent[]>();
    const rootEvents: CFGuestStoryEvent[] = [];

    sortedEvents.forEach((event) => {
      if (event.parent_event_id && eventIds.has(event.parent_event_id)) {
        const bucket = repliesByParentId.get(event.parent_event_id) || [];
        bucket.push(event);
        repliesByParentId.set(event.parent_event_id, bucket);
      } else {
        rootEvents.push(event);
      }
    });

    repliesByParentId.forEach((bucket) => {
      bucket.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    });

    return { rootEvents, repliesByParentId };
  }, [sortedEvents]);

  function startReply(event: CFGuestStoryEvent) {
    setReplyingToEventId(event.id);
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanBody = body.trim();
    if (!cleanBody) {
      setError("Напишите комментарий");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.createCFGuestStoryEvent(guestStoryId, {
        body: cleanBody,
        parent_event_id: replyingToEvent?.id ?? null,
      });
      setBody("");
      setReplyingToEventId(null);
      toastSuccess(replyingToEvent ? "Ответ добавлен" : "Комментарий добавлен");
      await onEventCreated();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось добавить комментарий";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  }

  function renderEventThread(
    event: CFGuestStoryEvent,
    depth = 0,
    visited = new Set<string>(),
  ): ReactNode {
    if (visited.has(event.id)) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(event.id);
    const replies = eventThreads.repliesByParentId.get(event.id) || [];
    const isReply = depth > 0;

    return (
      <div
        key={event.id}
        className={
          isReply
            ? "ml-3 border-l border-primary/20 pl-3 sm:ml-5 sm:pl-4"
            : undefined
        }
      >
        <article
          className={
            isReply
              ? "rounded-lg border border-border/60 bg-background px-3 py-3"
              : "rounded-lg border border-border/60 bg-muted/20 px-3 py-3"
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
              {EVENT_LABELS[event.event_type]}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(event.created_at)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {eventActorName(event, members)}
          </p>
          {event.body && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {event.body}
            </p>
          )}
          {(event.old_value || event.new_value) && (
            <p className="mt-2 text-sm text-muted-foreground">
              Было: {event.old_value || "не указано"} · Стало:{" "}
              {event.new_value || "не указано"}
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:text-primary"
              onClick={() => startReply(event)}
              disabled={saving}
            >
              <Reply className="h-3.5 w-3.5" />
              Ответить
            </Button>
          </div>
        </article>
        {replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {replies.map((reply) =>
              renderEventThread(reply, depth + 1, nextVisited),
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <History className="h-4 w-4 text-primary" />
            Журнал истории
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Комментарии команды и важные изменения по гостю.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-2">
        {replyingToEvent && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary">
                  Ответ на {EVENT_LABELS[replyingToEvent.event_type]}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {eventSummary(replyingToEvent)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 gap-1.5 rounded-md px-2 text-xs"
                onClick={() => setReplyingToEventId(null)}
                disabled={saving}
              >
                <X className="h-3.5 w-3.5" />
                Отменить ответ
              </Button>
            </div>
          </div>
        )}
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-20 border-border/70 bg-muted/20 text-sm"
          placeholder={
            replyingToEvent
              ? "Напишите ответ по этому событию..."
              : "Добавьте комментарий: договорённость, риск, уточнение по согласию..."
          }
          disabled={saving}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            className="h-8 gap-1.5 rounded-md px-3 text-xs"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {replyingToEvent ? "Ответить" : "Добавить"}
          </Button>
        </div>
      </form>

      <div className="mt-4 space-y-2">
        {eventThreads.rootEvents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
            <MessageSquare className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium text-foreground">
              Событий пока нет
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Первый комментарий появится здесь.
            </p>
          </div>
        ) : (
          eventThreads.rootEvents.map((event) => renderEventThread(event))
        )}
      </div>
    </section>
  );
}
