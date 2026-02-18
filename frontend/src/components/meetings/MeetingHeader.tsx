"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ChevronDown,
  Pencil,
  Trash2,
  Loader2,
  Ban,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Meeting, MeetingStatus } from "@/lib/types";
import { MEETING_STATUS_LABELS } from "@/lib/types";

const STATUS_STYLES: Record<MeetingStatus, string> = {
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  in_progress: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  cancelled: "bg-muted text-muted-foreground border-border/40",
};

interface MeetingHeaderProps {
  meeting: Meeting;
  isModerator: boolean;
  onUpdateTitle: (title: string) => Promise<void>;
  onUpdateStatus: (status: MeetingStatus) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function MeetingHeader({
  meeting,
  isModerator,
  onUpdateTitle,
  onUpdateStatus,
  onDelete,
}: MeetingHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(meeting.title || "");
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleTitleSave = async () => {
    if (titleValue.trim() && titleValue !== meeting.title) {
      await onUpdateTitle(titleValue.trim());
    }
    setEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleTitleSave();
    if (e.key === "Escape") {
      setTitleValue(meeting.title || "");
      setEditingTitle(false);
    }
  };

  const formatMeetingDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekday = date.toLocaleDateString("ru-RU", { weekday: "long" });
    const day = date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const time = date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} · ${time} МСК`;
  };

  const effectiveStatus = meeting.effective_status || meeting.status;
  const statusStyle = STATUS_STYLES[effectiveStatus] || STATUS_STYLES.scheduled;

  return (
    <div className="space-y-4 animate-fade-in-up stagger-1">
      {/* Back link */}
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground group"
      >
        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
        Встречи
      </Link>

      {/* Title + Status row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editingTitle && isModerator ? (
            <div className="flex items-center gap-2">
              <Input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                autoFocus
                className="text-2xl font-heading font-bold h-auto py-1 px-2 rounded-xl border-primary/30"
              />
            </div>
          ) : (
            <h1
              className={`text-2xl font-heading font-bold text-foreground tracking-tight ${
                isModerator ? "cursor-pointer group" : ""
              }`}
              onClick={() => isModerator && setEditingTitle(true)}
            >
              {meeting.title || "Встреча без названия"}
              {isModerator && (
                <Pencil className="inline-block h-4 w-4 ml-2 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </h1>
          )}
        </div>

        {/* Status badge */}
        {isModerator ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="shrink-0">
                <Badge
                  variant="outline"
                  className={`rounded-lg text-xs font-medium border gap-1 cursor-pointer hover:opacity-80 ${statusStyle}`}
                >
                  {MEETING_STATUS_LABELS[effectiveStatus]}
                  <ChevronDown className="h-3 w-3" />
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              {effectiveStatus === "cancelled" ? (
                <DropdownMenuItem
                  onClick={() => onUpdateStatus("scheduled")}
                  className="gap-2 rounded-lg"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Возобновить
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => onUpdateStatus("cancelled")}
                  className="gap-2 rounded-lg text-destructive focus:text-destructive"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Отменить встречу
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Badge
            variant="outline"
            className={`rounded-lg text-xs font-medium border shrink-0 ${statusStyle}`}
          >
            {MEETING_STATUS_LABELS[effectiveStatus]}
          </Badge>
        )}
      </div>

      {/* Date + meta + delete */}
      <div className="flex items-center gap-4 flex-wrap">
        {meeting.meeting_date && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            {formatMeetingDate(meeting.meeting_date)}
          </div>
        )}
        {meeting.schedule_id && (
          <Badge
            variant="secondary"
            className="rounded-lg text-2xs bg-primary/5 text-primary border-primary/10"
          >
            <Clock className="h-3 w-3 mr-1" />
            Из расписания
          </Badge>
        )}

        {isModerator && onDelete && (
          <div className="ml-auto">
            {confirmDelete ? (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-1.5">
                <span className="text-xs text-destructive font-medium">
                  {meeting.zoom_meeting_id ? "Удалить встречу и Zoom-конференцию?" : "Удалить встречу?"}
                </span>
                <button
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await onDelete();
                    } finally {
                      setDeleting(false);
                      setConfirmDelete(false);
                    }
                  }}
                  disabled={deleting}
                  className="text-xs font-semibold text-destructive hover:text-destructive/80 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Да"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Нет
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Удалить встречу"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
