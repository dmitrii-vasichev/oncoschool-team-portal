"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Video,
  FileText,
  ListChecks,
  CalendarDays,
  Clock,
  ExternalLink,
  Trash2,
  Loader2,
  Repeat,
  Users,
  StickyNote,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { Meeting, TeamMember } from "@/lib/types";
import { DAY_OF_WEEK_SHORT, RECURRENCE_LABELS } from "@/lib/types";
import { parseUTCDate } from "@/lib/dateUtils";
import { sanitizeZoomJoinUrl } from "@/lib/zoomLink";

const DAY_COLORS: Record<number, string> = {
  1: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  2: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  3: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  4: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  5: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  6: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  7: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

function getMoscowIsoWeekday(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value || 0);
  const month = Number(parts.find((p) => p.type === "month")?.value || 1);
  const day = Number(parts.find((p) => p.type === "day")?.value || 1);

  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = utcNoon.getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

interface MeetingCardProps {
  meeting: Meeting;
  variant: "upcoming" | "past";
  members?: TeamMember[];
  isModerator?: boolean;
  onDelete?: (meeting: Meeting) => Promise<void>;
}

export function MeetingCard({ meeting, variant, members = [], isModerator, onDelete }: MeetingCardProps) {
  const effectiveStatus = meeting.effective_status || meeting.status;
  const isCancelled = effectiveStatus === "cancelled";
  const isInProgress = effectiveStatus === "in_progress";
  const hasMeetingDate = !!meeting.meeting_date;
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const safeJoinUrl = sanitizeZoomJoinUrl(
    meeting.zoom_join_url,
    meeting.zoom_meeting_id
  );

  const participants = useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    return (meeting.participant_ids || [])
      .map((id) => byId.get(id))
      .filter((member): member is TeamMember => !!member);
  }, [meeting.participant_ids, members]);

  const recurrenceKey = (meeting.schedule_recurrence || "one_time") as keyof typeof RECURRENCE_LABELS;
  const recurrenceLabel = RECURRENCE_LABELS[recurrenceKey] || "Разовая встреча";

  const upcomingMeta = useMemo(() => {
    if (!meeting.meeting_date) {
      return {
        dayShort: "—",
        dayColor: DAY_COLORS[1],
        timeLabel: "Время не назначено",
        dateLabel: "Следующая дата пока не назначена",
      };
    }

    const date = parseUTCDate(meeting.meeting_date);
    const weekdayIso = getMoscowIsoWeekday(date);
    const timeLabel = date.toLocaleTimeString("ru-RU", {
      timeZone: "Europe/Moscow",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const dateLabel = date.toLocaleDateString("ru-RU", {
      timeZone: "Europe/Moscow",
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    return {
      dayShort: DAY_OF_WEEK_SHORT[weekdayIso],
      dayColor: DAY_COLORS[weekdayIso] || DAY_COLORS[1],
      timeLabel: `${timeLabel} МСК`,
      dateLabel: `${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)}`,
    };
  }, [meeting.meeting_date]);

  return (
    <>
      {variant === "upcoming" ? (
        <Link href={`/meetings/${meeting.id}`} className="group block h-full">
          <div className="group relative h-[256px] sm:h-[264px] overflow-hidden rounded-2xl border border-border/60 bg-card hover:shadow-md hover:border-border/80 transition-all duration-200">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/3 to-transparent rounded-bl-3xl pointer-events-none" />

            {isModerator && onDelete && (
              <div className="absolute top-2 right-2 sm:top-3.5 sm:right-3.5 z-10 flex items-center gap-1 opacity-100 pointer-events-auto sm:opacity-0 sm:pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto transition-opacity">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  disabled={deleting}
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-destructive bg-card/70 backdrop-blur-[1px] flex items-center justify-center disabled:opacity-50"
                  title="Удалить встречу"
                >
                  {deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}

            <div className="relative flex h-full flex-col p-3 sm:p-4">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div
                  className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-xl border font-heading font-bold text-sm ${upcomingMeta.dayColor}`}
                >
                  {upcomingMeta.dayShort}
                </div>

                <div className={`flex-1 min-w-0 ${isModerator && onDelete ? "pr-9 sm:pr-11" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 font-heading font-semibold text-[15px] leading-5 text-foreground line-clamp-1 min-h-5 sm:line-clamp-2 sm:min-h-10">
                      {meeting.title || "Встреча без названия"}
                    </h3>

                    {(isCancelled || isInProgress) && (
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium ${
                          isCancelled
                            ? "text-destructive bg-destructive/10"
                            : "text-amber-700 bg-amber-500/10"
                        }`}
                      >
                        {isCancelled ? (
                          <>
                            <XCircle className="h-3 w-3" />
                            Отменена
                          </>
                        ) : (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Идёт
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 space-y-1.5 border-t border-border/40 pt-1.5">
                    <div
                      className={`flex items-center gap-1.5 ${
                        hasMeetingDate
                          ? "text-sm font-medium tracking-tight text-muted-foreground"
                          : "text-xs text-muted-foreground"
                      }`}
                    >
                      <CalendarDays
                        className={`h-3.5 w-3.5 ${hasMeetingDate ? "text-primary/80" : "text-muted-foreground"}`}
                      />
                      <span className="line-clamp-1">{upcomingMeta.dateLabel}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground pl-5">
                      <Clock className="h-3 w-3" />
                      <span>{upcomingMeta.timeLabel}</span>
                      {hasMeetingDate && (
                        <>
                          <span className="text-border mx-0.5">·</span>
                          <span>{meeting.duration_minutes} мин</span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className="rounded-md text-2xs font-medium px-1.5 py-0 h-5"
                      >
                        <Repeat className="h-2.5 w-2.5 mr-0.5" />
                        {recurrenceLabel}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto border-t border-border/40 pt-2.5">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                    {safeJoinUrl && (
                      <a
                        href={safeJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-500/10 rounded-lg px-2.5 py-1.5 hover:bg-blue-500/15 transition-colors"
                      >
                        <Video className="h-3 w-3" />
                        Подключиться
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}

                    {meeting.meeting_date && (
                      <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTimeRemaining(meeting.meeting_date, meeting.duration_minutes)}
                      </div>
                    )}
                  </div>

                  {participants.length > 0 ? (
                    <div className="flex items-center gap-1 sm:ml-auto">
                      <div className="flex -space-x-1.5">
                        {participants.slice(0, 4).map((participant) => (
                          <UserAvatar
                            key={participant.id}
                            name={participant.full_name}
                            avatarUrl={participant.avatar_url}
                            size="sm"
                          />
                        ))}
                      </div>
                      {participants.length > 4 && (
                        <span className="text-2xs text-muted-foreground ml-1">
                          +{participants.length - 4}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-2xs text-muted-foreground/50 sm:ml-auto">
                      <Users className="h-3 w-3" />
                      <span>Нет участников</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <Link href={`/meetings/${meeting.id}`} className="group block h-full">
          <div className="group relative h-[256px] sm:h-[264px] overflow-hidden rounded-2xl border border-border/60 bg-card hover:shadow-md hover:border-border/80 transition-all duration-200">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/3 to-transparent rounded-bl-3xl pointer-events-none" />

            {isModerator && onDelete && (
              <div className="absolute top-2 right-2 sm:top-3.5 sm:right-3.5 z-10 flex items-center gap-1 opacity-100 pointer-events-auto sm:opacity-0 sm:pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto transition-opacity">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  disabled={deleting}
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-destructive bg-card/70 backdrop-blur-[1px] flex items-center justify-center disabled:opacity-50"
                  title="Удалить встречу"
                >
                  {deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}

            <div className="relative flex h-full flex-col p-3 sm:p-4">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div
                  className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-xl border font-heading font-bold text-sm ${upcomingMeta.dayColor}`}
                >
                  {upcomingMeta.dayShort}
                </div>

                <div className={`flex-1 min-w-0 ${isModerator && onDelete ? "pr-9 sm:pr-11" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 font-heading font-semibold text-[15px] leading-5 text-foreground line-clamp-1 min-h-5 sm:line-clamp-2 sm:min-h-10">
                      {meeting.title || "Встреча без названия"}
                    </h3>

                    {(isCancelled || isInProgress) && (
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium ${
                          isCancelled
                            ? "text-destructive bg-destructive/10"
                            : "text-amber-700 bg-amber-500/10"
                        }`}
                      >
                        {isCancelled ? (
                          <>
                            <XCircle className="h-3 w-3" />
                            Отменена
                          </>
                        ) : (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Идёт
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 space-y-1.5 border-t border-border/40 pt-1.5">
                    <div
                      className={`flex items-center gap-1.5 ${
                        hasMeetingDate
                          ? "text-sm font-medium tracking-tight text-muted-foreground"
                          : "text-xs text-muted-foreground"
                      }`}
                    >
                      <CalendarDays
                        className={`h-3.5 w-3.5 ${hasMeetingDate ? "text-primary/80" : "text-muted-foreground"}`}
                      />
                      <span className="line-clamp-1">{upcomingMeta.dateLabel}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground pl-5">
                      <Clock className="h-3 w-3" />
                      <span>{upcomingMeta.timeLabel}</span>
                      {hasMeetingDate && (
                        <>
                          <span className="text-border mx-0.5">·</span>
                          <span>{meeting.duration_minutes} мин</span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className="rounded-md text-2xs font-medium px-1.5 py-0 h-5"
                      >
                        <Repeat className="h-2.5 w-2.5 mr-0.5" />
                        {recurrenceLabel}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto border-t border-border/40 pt-2.5">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                    {meeting.parsed_summary && (
                      <Badge variant="secondary" className="gap-1 rounded-lg text-2xs font-medium">
                        <FileText className="h-3 w-3" />
                        Резюме
                      </Badge>
                    )}
                    {meeting.transcript && (
                      <Badge variant="secondary" className="gap-1 rounded-lg text-2xs font-medium">
                        <FileText className="h-3 w-3" />
                        Транскрипция
                      </Badge>
                    )}
                    {meeting.decisions && meeting.decisions.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="gap-1 rounded-lg text-2xs font-medium bg-status-done-bg text-status-done-fg"
                      >
                        <ListChecks className="h-3 w-3" />
                        Решения: {meeting.decisions.length}
                      </Badge>
                    )}
                    {meeting.notes && (
                      <Badge variant="secondary" className="gap-1 rounded-lg text-2xs font-medium">
                        <StickyNote className="h-3 w-3" />
                        Заметки
                      </Badge>
                    )}
                  </div>

                  {participants.length > 0 ? (
                    <div className="flex items-center gap-1 sm:ml-auto">
                      <div className="flex -space-x-1.5">
                        {participants.slice(0, 4).map((participant) => (
                          <UserAvatar
                            key={participant.id}
                            name={participant.full_name}
                            avatarUrl={participant.avatar_url}
                            size="sm"
                          />
                        ))}
                      </div>
                      {participants.length > 4 && (
                        <span className="text-2xs text-muted-foreground ml-1">
                          +{participants.length - 4}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-2xs text-muted-foreground/50 sm:ml-auto">
                      <Users className="h-3 w-3" />
                      <span>Нет участников</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      {showDeleteDialog && onDelete && (
        <Dialog open onOpenChange={(open) => !open && setShowDeleteDialog(false)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading">Удалить встречу</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground pt-1">
                {meeting.zoom_meeting_id
                  ? <>Встреча <span className="font-medium text-foreground">&laquo;{meeting.title || "Без названия"}&raquo;</span> и связанная Zoom-конференция будут удалены безвозвратно.</>
                  : <>Встреча <span className="font-medium text-foreground">&laquo;{meeting.title || "Без названия"}&raquo;</span> будет удалена безвозвратно.</>
                }
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
              >
                Отмена
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDelete(meeting);
                  } finally {
                    setDeleting(false);
                    setShowDeleteDialog(false);
                  }
                }}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Удалить
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function formatTimeRemaining(dateStr: string, durationMinutes = 60): string {
  const startTime = parseUTCDate(dateStr);
  const now = new Date();
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  if (now >= endTime) return "Прошла";
  if (now >= startTime) return "Идёт";

  const diff = startTime.getTime() - now.getTime();

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `через ${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`;
  if (hours > 0) return `через ${hours} ч`;

  const minutes = Math.ceil(diff / (1000 * 60));
  return `через ${Math.max(1, minutes)} мин`;
}
