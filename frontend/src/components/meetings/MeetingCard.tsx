"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Video,
  FileText,
  ListChecks,
  Clock,
  ExternalLink,
  Trash2,
  Loader2,
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
import type { Meeting, MeetingStatus } from "@/lib/types";
import { MEETING_STATUS_LABELS } from "@/lib/types";

const STATUS_STYLES: Record<MeetingStatus, string> = {
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  in_progress: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  cancelled: "bg-muted text-muted-foreground border-border/40",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  const dateFormatted = date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined,
  });

  const timeFormatted = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (days === 0) return `Сегодня, ${timeFormatted}`;
  if (days === 1) return `Завтра, ${timeFormatted}`;
  if (days === -1) return `Вчера, ${timeFormatted}`;

  return `${dateFormatted}, ${timeFormatted}`;
}

interface MeetingCardProps {
  meeting: Meeting;
  variant: "upcoming" | "past";
  isModerator?: boolean;
  onDelete?: (meeting: Meeting) => Promise<void>;
}

export function MeetingCard({ meeting, variant, isModerator, onDelete }: MeetingCardProps) {
  const effectiveStatus = meeting.effective_status || meeting.status;
  const statusStyle = STATUS_STYLES[effectiveStatus] || STATUS_STYLES.scheduled;
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <Link
        href={`/meetings/${meeting.id}`}
        className="group block"
      >
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 transition-all duration-200">
          {/* Decorative corner */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-3xl" />

          {/* Header: date + status */}
          <div className="flex items-center justify-between gap-2 mb-3">
            {meeting.meeting_date && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="font-medium">{formatDate(meeting.meeting_date)}</span>
              </div>
            )}
            <Badge
              variant="outline"
              className={`rounded-md text-2xs font-medium border ${statusStyle}`}
            >
              {MEETING_STATUS_LABELS[effectiveStatus]}
            </Badge>
          </div>

          {/* Title */}
          <h3 className="text-base font-heading font-semibold text-foreground mb-2 pr-6 line-clamp-2 group-hover:text-primary transition-colors">
            {meeting.title || "Встреча без названия"}
          </h3>

          {/* Summary preview (past meetings) */}
          {variant === "past" && meeting.parsed_summary && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
              {meeting.parsed_summary}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 mt-auto pt-3 border-t border-border/40">
            {/* Zoom link for upcoming */}
            {variant === "upcoming" && meeting.zoom_join_url && (
              <a
                href={meeting.zoom_join_url}
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

            {/* Indicators for past meetings */}
            {variant === "past" && (
              <>
                {meeting.decisions && meeting.decisions.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="gap-1 rounded-lg text-2xs font-medium bg-status-done-bg text-status-done-fg"
                  >
                    <ListChecks className="h-3 w-3" />
                    {meeting.decisions.length}{" "}
                    {meeting.decisions.length === 1
                      ? "решение"
                      : meeting.decisions.length < 5
                        ? "решения"
                        : "решений"}
                  </Badge>
                )}
                {meeting.transcript && (
                  <Badge
                    variant="secondary"
                    className="gap-1 rounded-lg text-2xs font-medium"
                  >
                    <FileText className="h-3 w-3" />
                    Транскрипция
                  </Badge>
                )}
              </>
            )}

            {/* Upcoming: show time remaining */}
            {variant === "upcoming" && meeting.meeting_date && (
              <div className="flex items-center gap-1 text-2xs text-muted-foreground ml-auto">
                <Clock className="h-3 w-3" />
                {formatTimeRemaining(meeting.meeting_date)}
              </div>
            )}

            {variant === "past" && (
              <div className="flex-1" />
            )}

            {/* Delete button for moderators */}
            {isModerator && onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
                disabled={deleting}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                title="Удалить встречу"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            {/* Hover arrow for past (when no delete) */}
            {variant === "past" && !(isModerator && onDelete) && (
              <div className="h-7 w-7 rounded-lg bg-muted/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Video className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Delete confirmation dialog */}
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

function formatTimeRemaining(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return "Прошла";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `через ${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`;
  if (hours > 0) return `через ${hours} ч`;

  const minutes = Math.floor(diff / (1000 * 60));
  return `через ${minutes} мин`;
}
