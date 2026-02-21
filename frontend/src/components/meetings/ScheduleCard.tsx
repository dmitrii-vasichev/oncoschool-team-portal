"use client";

import {
  Bell,
  Video,
  Settings,
  Trash2,
  Clock,
  Repeat,
  Users,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { MeetingSchedule, TeamMember } from "@/lib/types";
import {
  DAY_OF_WEEK_SHORT,
  RECURRENCE_LABELS,
} from "@/lib/types";
import { formatUtcClockAsMoscowWithLocal, formatUtcClockForSchedule } from "@/lib/meetingDateTime";

// Day-of-week badge colors (soft, distinct hues)
const DAY_COLORS: Record<number, string> = {
  1: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  2: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  3: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  4: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  5: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  6: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  7: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

interface ScheduleCardProps {
  schedule: MeetingSchedule;
  members: TeamMember[];
  isModerator: boolean;
  onEdit: (schedule: MeetingSchedule) => void;
  onDelete: (schedule: MeetingSchedule) => void;
}

function formatReminderOffset(minutes: number): string {
  if (minutes === 0) return "в момент начала";
  if (minutes === 60) return "за 1 час";
  if (minutes === 120) return "за 2 часа";
  return `за ${minutes} мин`;
}

export function ScheduleCard({
  schedule,
  members,
  isModerator,
  onEdit,
  onDelete,
}: ScheduleCardProps) {
  const displayTime = formatUtcClockForSchedule(schedule.time_utc);
  const dayColor = DAY_COLORS[schedule.day_of_week] || DAY_COLORS[1];

  // Resolve participant names from IDs
  const participants = schedule.participant_ids
    .map((pid) => members.find((m) => m.id === pid))
    .filter(Boolean) as TeamMember[];
  const reminderOffsets = (
    schedule.reminder_offsets_minutes?.length
      ? schedule.reminder_offsets_minutes
      : [schedule.reminder_minutes_before]
  ).slice().sort((a, b) => b - a);
  const reminderSummary = reminderOffsets.map(formatReminderOffset).join(", ");

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card hover:shadow-md hover:border-border/80 transition-all duration-200">
      {/* Subtle decorative accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/3 to-transparent rounded-bl-3xl pointer-events-none" />

      <div className="relative p-3 sm:p-5">
        {/* Actions (moderator only, do not take layout width) */}
        {isModerator && (
          <div className="absolute top-2 right-2 sm:top-3.5 sm:right-3.5 z-10 flex items-center gap-1 opacity-100 pointer-events-auto sm:opacity-0 sm:pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto sm:group-focus-within:opacity-100 sm:group-focus-within:pointer-events-auto transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-foreground bg-card/70 backdrop-blur-[1px]"
              onClick={() => onEdit(schedule)}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg text-muted-foreground hover:text-destructive bg-card/70 backdrop-blur-[1px]"
              onClick={() => onDelete(schedule)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Top row: day badge + title + actions */}
        <div className="flex items-start gap-2.5 sm:gap-3">
          {/* Day badge */}
          <div
            className={`shrink-0 flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-xl border font-heading font-bold text-sm ${dayColor}`}
          >
            {DAY_OF_WEEK_SHORT[schedule.day_of_week]}
          </div>

          {/* Content */}
          <div className={`flex-1 min-w-0 ${isModerator ? "pr-14 sm:pr-[4.5rem]" : ""}`}>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3
                    className="font-heading font-semibold text-sm leading-5 text-foreground line-clamp-1 min-h-5 sm:line-clamp-2 sm:min-h-10"
                    title={schedule.title}
                  >
                    {schedule.title}
                  </h3>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] break-words">
                  {schedule.title}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Time and recurrence block */}
            <div className="mt-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{displayTime.moscow}</span>
                <span className="text-border mx-0.5">·</span>
                <span>{schedule.duration_minutes} мин</span>
              </div>
              {displayTime.local && (
                <div className="text-2xs text-muted-foreground pl-4">
                  {displayTime.local}
                </div>
              )}
              <Badge
                variant="secondary"
                className="rounded-md text-2xs font-medium px-1.5 py-0 h-5"
              >
                <Repeat className="h-2.5 w-2.5 mr-0.5" />
                {RECURRENCE_LABELS[schedule.recurrence]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Bottom row: indicators + participants */}
        <div className="mt-3 border-t border-border/40 pt-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            {/* Indicators */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              {schedule.zoom_enabled && (
                <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                  <Video className="h-3 w-3 text-blue-500" />
                  <span>Zoom</span>
                </div>
              )}
              {schedule.reminder_enabled && (
                <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                  <Bell className="h-3 w-3 text-amber-500" />
                  <span>{reminderSummary}</span>
                </div>
              )}
              {schedule.next_occurrence_skip && (
                <div className="flex items-center gap-1 text-2xs text-amber-600 font-medium">
                  <SkipForward className="h-3 w-3" />
                  <span>Следующая отменена</span>
                </div>
              )}
              {!schedule.next_occurrence_skip && schedule.next_occurrence_time_override && (
                <div className="flex items-center gap-1 text-2xs text-blue-600 font-medium">
                  <Clock className="h-3 w-3" />
                  <span>
                    Перенос на {formatUtcClockAsMoscowWithLocal(schedule.next_occurrence_time_override)}
                  </span>
                </div>
              )}
            </div>

            {/* Participants */}
            {participants.length > 0 ? (
              <div className="flex items-center gap-1 sm:ml-auto">
                <div className="flex -space-x-1.5">
                  {participants.slice(0, 4).map((p) => (
                    <UserAvatar key={p.id} name={p.full_name} avatarUrl={p.avatar_url} size="sm" />
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
  );
}
