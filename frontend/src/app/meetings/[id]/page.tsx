"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  ListChecks,
  StickyNote,
  MessageSquareText,
  CalendarClock,
  Repeat,
  Pencil,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useTeam } from "@/hooks/useTeam";
import { useDepartments } from "@/hooks/useDepartments";
import { PermissionService } from "@/lib/permissions";
import { api } from "@/lib/api";
import type {
  Meeting,
  Task,
  MeetingStatus,
  TeamMember,
  MeetingSchedule,
  MeetingScheduleCreateRequest,
  TelegramNotificationTarget,
} from "@/lib/types";
import { RECURRENCE_LABELS } from "@/lib/types";

import { MeetingHeader } from "@/components/meetings/MeetingHeader";
import { ZoomBlock } from "@/components/meetings/ZoomBlock";
import { ParticipantsBlock } from "@/components/meetings/ParticipantsBlock";
import { ParticipantsPickerDialog } from "@/components/meetings/ParticipantsPickerDialog";
import { ScheduleForm } from "@/components/meetings/ScheduleForm";
import { TranscriptTab } from "@/components/meetings/TranscriptTab";
import { SummaryTab } from "@/components/meetings/SummaryTab";
import { MeetingTasksTab } from "@/components/meetings/MeetingTasksTab";
import { NotesTab } from "@/components/meetings/NotesTab";

type TabId = "transcript" | "summary" | "tasks" | "notes";

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { toastError, toastSuccess } = useToast();
  const { user } = useCurrentUser();

  const isModerator = user ? PermissionService.isModerator(user) : false;
  const { setPageTitle } = usePageTitle();
  const { members } = useTeam();
  const { departments } = useDepartments();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedule, setSchedule] = useState<MeetingSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [telegramTargets, setTelegramTargets] = useState<TelegramNotificationTarget[]>(
    []
  );

  const membersById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  const resolvedParticipants = useMemo(() => {
    if (!meeting?.participant_ids?.length) return [];
    return meeting.participant_ids
      .map((id) => membersById.get(id))
      .filter((m): m is TeamMember => !!m);
  }, [meeting?.participant_ids, membersById]);

  const formattedScheduleNextOccurrence = useMemo(() => {
    if (!schedule?.next_occurrence_date) return null;

    try {
      const [year, month, day] = schedule.next_occurrence_date.split("-").map(Number);
      const effectiveTimeUtc = (schedule.next_occurrence_time_override || schedule.time_utc).slice(0, 5);
      const [hours, minutes] = effectiveTimeUtc.split(":").map(Number);

      if ([year, month, day, hours, minutes].some(Number.isNaN)) {
        return null;
      }

      const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
      return utcDate.toLocaleString("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Moscow",
      });
    } catch {
      return null;
    }
  }, [
    schedule?.next_occurrence_date,
    schedule?.next_occurrence_time_override,
    schedule?.time_utc,
  ]);

  const fetchData = useCallback(async () => {
    try {
      const meetingData = await api.getMeeting(id);
      const [tasksData, scheduleData] = await Promise.all([
        api.getMeetingTasks(id),
        meetingData.schedule_id
          ? api.getMeetingSchedule(meetingData.schedule_id).catch(() => null)
          : Promise.resolve(null),
      ]);
      setMeeting(meetingData);
      setTasks(tasksData);
      setSchedule(scheduleData);
    } catch {
      toastError("Не удалось загрузить встречу");
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!isModerator) return;
    api.getTelegramTargets().then(setTelegramTargets).catch(() => {});
  }, [isModerator]);

  // Background refresh while waiting for Zoom transcript
  useEffect(() => {
    if (!meeting?.zoom_meeting_id || meeting.transcript) return;

    const intervalId = window.setInterval(async () => {
      try {
        const updated = await api.getMeeting(id);
        setMeeting((prev) => {
          if (!prev) return updated;
          if (
            prev.transcript === updated.transcript &&
            prev.transcript_source === updated.transcript_source &&
            prev.zoom_recording_url === updated.zoom_recording_url &&
            prev.status === updated.status &&
            prev.effective_status === updated.effective_status
          ) {
            return prev;
          }
          return updated;
        });
      } catch {
        // Ignore polling errors, user still has manual refresh/actions.
      }
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [id, meeting?.zoom_meeting_id, meeting?.transcript]);

  // Set breadcrumb title, clear on unmount
  useEffect(() => {
    if (meeting?.title) setPageTitle(meeting.title);
    return () => setPageTitle(null);
  }, [meeting?.title, setPageTitle]);

  const handleUpdateTitle = async (title: string) => {
    if (!meeting) return;
    try {
      const updated = await api.updateMeeting(meeting.id, { title } as Partial<Meeting>);
      setMeeting(updated);
      toastSuccess("Название обновлено");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка обновления");
    }
  };

  const handleUpdateStatus = async (status: MeetingStatus) => {
    if (!meeting || meeting.effective_status === status) return;
    try {
      const updated = await api.updateMeeting(meeting.id, { status } as Partial<Meeting>);
      setMeeting(updated);
      toastSuccess("Статус обновлён");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка обновления");
    }
  };

  const handleUpdateNotes = async (notes: string) => {
    if (!meeting) return;
    try {
      const updated = await api.updateMeeting(meeting.id, { notes } as Partial<Meeting>);
      setMeeting(updated);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  };

  const handleMeetingUpdate = (updated: Meeting) => {
    setMeeting(updated);
  };

  const handleUpdateParticipants = async (ids: string[]) => {
    if (!meeting) return;
    try {
      const updated = await api.updateMeeting(meeting.id, { participant_ids: ids });
      setMeeting(updated);
      toastSuccess("Участники обновлены");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка обновления");
    }
  };

  const handleDelete = async (options?: { notifyParticipants?: boolean }) => {
    try {
      await api.deleteMeeting(id, {
        notifyParticipants: options?.notifyParticipants,
      });
      toastSuccess("Встреча удалена");
      router.push("/meetings");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка удаления");
    }
  };

  const handleTasksCreated = () => {
    api.getMeetingTasks(id).then(setTasks).catch(() => {});
    setActiveTab("tasks");
  };

  const handleUpdateSchedule = async (data: MeetingScheduleCreateRequest) => {
    if (!schedule) return;
    const previousUpdatedAt = schedule.updated_at;
    try {
      const updated = await api.updateMeetingSchedule(schedule.id, data);
      setSchedule(updated);
      await fetchData();
      toastSuccess("Настройки встречи обновлены");
    } catch (e) {
      const isNetworkError =
        e instanceof Error &&
        (e.message.includes("Сервер недоступен") || e.message.includes("Failed to fetch"));
      if (isNetworkError) {
        try {
          const latest = await api.getMeetingSchedule(schedule.id);
          if (latest.updated_at !== previousUpdatedAt) {
            setSchedule(latest);
            await fetchData();
            toastSuccess("Настройки встречи обновлены");
            return;
          }
        } catch {
          // Keep the original error handling below.
        }
      }
      toastError(e instanceof Error ? e.message : "Ошибка обновления расписания");
      throw e;
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-6 w-20 rounded-lg" />
        <Skeleton className="h-10 w-80 rounded-lg" />
        <Skeleton className="h-6 w-48 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-destructive">Встреча не найдена</p>
        <Link href="/meetings" className="mt-4">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            К списку встреч
          </Button>
        </Link>
      </div>
    );
  }

  const isPastMeeting =
    meeting.effective_status === "completed" || meeting.effective_status === "cancelled";
  const isUpcomingMeeting = !isPastMeeting;
  const canEditMeetingTitle =
    !!user && (isModerator || meeting.created_by_id === user.id);

  const tabs: { id: TabId; label: string; icon: typeof FileText; count?: number }[] = [
    { id: "transcript", label: "Транскрипция", icon: MessageSquareText },
    { id: "summary", label: "Резюме", icon: FileText },
    { id: "tasks", label: "Задачи", icon: ListChecks, count: tasks.length },
    { id: "notes", label: "Заметки", icon: StickyNote },
  ];

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in duration-300">
      {/* Meeting header with title, date, status */}
      <MeetingHeader
        meeting={meeting}
        isModerator={isModerator}
        canEditTitle={canEditMeetingTitle}
        onUpdateTitle={handleUpdateTitle}
        onUpdateStatus={handleUpdateStatus}
        onDelete={handleDelete}
      />

      {/* Zoom + Participants row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up stagger-2">
        <ZoomBlock meeting={meeting} isModerator={isModerator} />
        <ParticipantsBlock
          participants={resolvedParticipants}
          isModerator={isModerator}
          onEdit={() => setParticipantPickerOpen(true)}
        />
      </div>

      {/* Participants picker dialog (moderator only) */}
      {isModerator && (
        <ParticipantsPickerDialog
          open={participantPickerOpen}
          onOpenChange={setParticipantPickerOpen}
          members={members}
          departments={departments}
          selectedIds={meeting.participant_ids ?? []}
          onApply={handleUpdateParticipants}
        />
      )}

      {isUpcomingMeeting && (
        <div className="rounded-2xl border border-border/60 bg-card p-4 animate-fade-in-up stagger-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <CalendarClock className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-heading font-semibold">Расписание встречи</span>
            </div>
            {isModerator && schedule && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setScheduleFormOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Изменить
              </Button>
            )}
          </div>

          {schedule ? (
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p className="inline-flex items-center gap-1.5 text-foreground font-medium">
                <Repeat className="h-3.5 w-3.5 text-primary/80" />
                {RECURRENCE_LABELS[schedule.recurrence]}
              </p>
              {formattedScheduleNextOccurrence ? (
                <p>
                  Ближайшая встреча:{" "}
                  <span className="font-medium text-foreground">
                    {formattedScheduleNextOccurrence}{" "}
                    МСК
                  </span>
                </p>
              ) : meeting.meeting_date ? (
                <p>
                  Ближайшая встреча:{" "}
                  <span className="font-medium text-foreground">
                    {new Date(meeting.meeting_date).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Moscow",
                    })}{" "}
                    МСК
                  </span>
                </p>
              ) : (
                <p>
                  Следующая дата не назначена. Встреча остаётся в списке, чтобы вы могли
                  быстро назначить новый слот.
                </p>
              )}
              {schedule.next_occurrence_skip && (
                <p className="text-xs text-amber-600">
                  Ближайший слот отменён в расписании.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Разовая встреча без связанного расписания.
            </p>
          )}
        </div>
      )}

      {!isUpcomingMeeting && (
        <>
          {/* Custom tabs */}
          <div className="animate-fade-in-up stagger-3">
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-1 rounded-2xl bg-muted/50 p-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const hasIndicator =
                  (tab.id === "transcript" && meeting.transcript) ||
                  (tab.id === "summary" && meeting.parsed_summary);

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all sm:px-4
                      ${
                        isActive
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }
                    `}
                  >
                    <div className="relative">
                      <Icon className="h-4 w-4" />
                      {hasIndicator && !isActive && (
                        <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      )}
                    </div>
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span
                        className={`
                          text-2xs rounded-full px-1.5 min-w-[18px] text-center font-semibold
                          ${isActive ? "bg-primary/10 text-primary" : "bg-foreground/8 text-muted-foreground"}
                        `}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
              </div>
            </div>
          </div>

          {/* Tab content */}
          <div className="animate-fade-in-up stagger-4">
            {activeTab === "transcript" && (
              <TranscriptTab
                meeting={meeting}
                isModerator={isModerator}
                onMeetingUpdate={handleMeetingUpdate}
                onSwitchToSummary={() => setActiveTab("summary")}
              />
            )}

            {activeTab === "summary" && (
              <SummaryTab
                meeting={meeting}
                isModerator={isModerator}
                onMeetingUpdate={handleMeetingUpdate}
                onTasksCreated={handleTasksCreated}
                onSwitchToTranscript={() => setActiveTab("transcript")}
              />
            )}

            {activeTab === "tasks" && (
              <MeetingTasksTab
                tasks={tasks}
                meeting={meeting}
                isModerator={isModerator}
                onSwitchToSummary={() => setActiveTab("summary")}
              />
            )}

            {activeTab === "notes" && (
              <NotesTab
                notes={meeting.notes}
                isModerator={isModerator}
                onSave={handleUpdateNotes}
              />
            )}
          </div>
        </>
      )}

      {isModerator && scheduleFormOpen && schedule && (
        <ScheduleForm
          schedule={schedule}
          members={members}
          departments={departments}
          telegramTargets={telegramTargets}
          onSave={handleUpdateSchedule}
          onClose={() => setScheduleFormOpen(false)}
        />
      )}
    </div>
  );
}
