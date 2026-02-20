"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Video,
  CalendarPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMeetingSchedules } from "@/hooks/useMeetingSchedules";
import { useMeetings } from "@/hooks/useMeetings";
import { useTeam } from "@/hooks/useTeam";
import { useDepartments } from "@/hooks/useDepartments";
import { PermissionService } from "@/lib/permissions";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { DatePicker } from "@/components/shared/DatePicker";
import { TimePicker } from "@/components/shared/TimePicker";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScheduleCard } from "@/components/meetings/ScheduleCard";
import { ScheduleForm } from "@/components/meetings/ScheduleForm";
import { MeetingCard } from "@/components/meetings/MeetingCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ParticipantsPickerDialog } from "@/components/meetings/ParticipantsPickerDialog";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type {
  MeetingSchedule,
  MeetingScheduleCreateRequest,
  TelegramNotificationTarget,
  TeamMember,
  Department,
} from "@/lib/types";
import {
  zonedDateTimeToUtcIso,
} from "@/lib/meetingDateTime";

const PER_PAGE = 6;

export default function MeetingsPage() {
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();
  const isModerator = user ? PermissionService.isModerator(user) : false;
  const scopeParam = searchParams.get("scope");
  const tabParam = searchParams.get("tab");
  const meetingsMemberId =
    scopeParam === "my" && user?.id ? user.id : undefined;

  const { schedules, loading: schedulesLoading, refetch: refetchSchedules } = useMeetingSchedules();
  const { meetings: upcomingMeetings, loading: upcomingLoading, refetch: refetchUpcoming } = useMeetings({
    upcoming: true,
    ...(meetingsMemberId ? { member_id: meetingsMemberId } : {}),
  });
  const { meetings: pastMeetings, loading: pastLoading, refetch: refetchPast } = useMeetings({
    past: true,
    ...(meetingsMemberId ? { member_id: meetingsMemberId } : {}),
  });
  const { members } = useTeam();
  const { departments } = useDepartments();

  // Telegram targets (for schedule form)
  const [telegramTargets, setTelegramTargets] = useState<TelegramNotificationTarget[]>([]);
  useEffect(() => {
    if (isModerator) {
      api.getTelegramTargets().then(setTelegramTargets).catch(() => {});
    }
  }, [isModerator]);

  // Schedule form state
  const [editSchedule, setEditSchedule] = useState<MeetingSchedule | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

  // Create meeting dialog
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MeetingSchedule | null>(null);

  // Search + pagination for past meetings
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">(
    tabParam === "past" ? "past" : "upcoming"
  );

  const { toastSuccess, toastError } = useToast();

  useEffect(() => {
    if (tabParam === "past" || tabParam === "upcoming") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = useCallback((value: string) => {
    if (value === "upcoming" || value === "past") {
      setActiveTab(value);
    }
  }, []);

  // Active schedules sorted by day_of_week
  const activeSchedules = useMemo(
    () => schedules.filter((s) => s.is_active).sort((a, b) => a.day_of_week - b.day_of_week),
    [schedules]
  );

  // Filtered past meetings
  const filteredPast = useMemo(() => {
    if (!search.trim()) return pastMeetings;
    const q = search.toLowerCase();
    return pastMeetings.filter(
      (m) =>
        m.title?.toLowerCase().includes(q) ||
        m.parsed_summary?.toLowerCase().includes(q)
    );
  }, [pastMeetings, search]);

  const totalPages = Math.max(1, Math.ceil(filteredPast.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedPast = filteredPast.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  // Handlers
  const handleCreateSchedule = useCallback(
    async (data: MeetingScheduleCreateRequest) => {
      await api.createMeetingSchedule(data);
      toastSuccess("Расписание создано");
      refetchSchedules();
      refetchUpcoming();
    },
    [refetchSchedules, refetchUpcoming, toastSuccess]
  );

  const handleUpdateSchedule = useCallback(
    async (data: MeetingScheduleCreateRequest) => {
      if (!editSchedule) return;
      await api.updateMeetingSchedule(editSchedule.id, data);
      toastSuccess("Расписание обновлено");
      refetchSchedules();
      refetchUpcoming();
    },
    [editSchedule, refetchSchedules, refetchUpcoming, toastSuccess]
  );

  const handleDeleteSchedule = useCallback(
    async (schedule: MeetingSchedule) => {
      try {
        await api.deleteMeetingSchedule(schedule.id);
        toastSuccess("Расписание удалено");
        refetchSchedules();
      } catch (e) {
        toastError(e instanceof Error ? e.message : "Ошибка удаления");
      } finally {
        setDeleteTarget(null);
      }
    },
    [refetchSchedules, toastSuccess, toastError]
  );

  const handleDeleteMeeting = useCallback(
    async (meeting: { id: string }) => {
      try {
        await api.deleteMeeting(meeting.id);
        toastSuccess("Встреча удалена");
        refetchUpcoming();
        refetchPast();
      } catch (e) {
        toastError(e instanceof Error ? e.message : "Ошибка удаления");
      }
    },
    [refetchUpcoming, refetchPast, toastSuccess, toastError]
  );

  const loading = schedulesLoading || upcomingLoading || pastLoading;

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Schedule skeletons */}
        <div className="space-y-3">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
        {/* Meeting skeletons */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-72 rounded-lg" />
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ============================================
          SECTION 1: Расписание встреч
          ============================================ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="h-4.5 w-4.5 text-primary" />
            </div>
            <h2 className="font-heading font-semibold text-lg">Расписание встреч</h2>
          </div>
          {isModerator && (
            <Button
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => {
                setEditSchedule(null);
                setShowScheduleForm(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Новое расписание
            </Button>
          )}
        </div>

        {activeSchedules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Нет активных расписаний</p>
            {isModerator && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Создайте расписание для автоматических напоминаний
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeSchedules.map((schedule, i) => (
              <div
                key={schedule.id}
                className={`animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}
              >
                <ScheduleCard
                  schedule={schedule}
                  members={members}
                  isModerator={isModerator}
                  onEdit={(s) => {
                    setEditSchedule(s);
                    setShowScheduleForm(true);
                  }}
                  onDelete={setDeleteTarget}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============================================
          SECTION 2: Встречи (Предстоящие / Прошедшие)
          ============================================ */}
      <section>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="flex items-center justify-between mb-4">
            <TabsList className="rounded-xl">
              <TabsTrigger value="upcoming" className="rounded-lg gap-1.5 text-sm">
                <Video className="h-3.5 w-3.5" />
                Предстоящие
                {upcomingMeetings.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-2xs font-semibold">
                    {upcomingMeetings.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="past" className="rounded-lg gap-1.5 text-sm">
                Прошедшие
              </TabsTrigger>
            </TabsList>

            {/* Create meeting button (upcoming tab, moderator) */}
            {activeTab === "upcoming" && isModerator && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={() => setShowCreateMeeting(true)}
              >
                <CalendarPlus className="h-4 w-4" />
                Создать встречу
              </Button>
            )}
          </div>

          {/* Upcoming tab */}
          <TabsContent value="upcoming" className="mt-0">
            {upcomingMeetings.length === 0 ? (
              <EmptyState
                variant="meetings"
                title="Нет предстоящих встреч"
                description="Встречи создаются автоматически по расписанию или вручную"
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingMeetings.map((meeting, i) => (
                  <div
                    key={meeting.id}
                    className={`animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}
                  >
                    <MeetingCard meeting={meeting} variant="upcoming" isModerator={isModerator} onDelete={handleDeleteMeeting} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Past tab */}
          <TabsContent value="past" className="mt-0 space-y-4">
            {/* Search */}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Поиск по встречам..."
                className="pl-9 h-10 rounded-xl bg-card border-border/60"
              />
            </div>

            {filteredPast.length === 0 ? (
              <EmptyState
                variant="meetings"
                title={search ? "Ничего не найдено" : "Нет прошедших встреч"}
                description={
                  search
                    ? "Попробуйте изменить поисковый запрос"
                    : "Завершённые встречи будут отображаться здесь"
                }
              />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {paginatedPast.map((meeting, i) => (
                    <div
                      key={meeting.id}
                      className={`animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}
                    >
                      <MeetingCard meeting={meeting} variant="past" isModerator={isModerator} onDelete={handleDeleteMeeting} />
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 pt-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (num) => (
                        <button
                          key={num}
                          onClick={() => setPage(num)}
                          className={`
                            h-9 w-9 rounded-xl text-sm font-medium flex items-center justify-center
                            ${
                              num === currentPage
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }
                          `}
                        >
                          {num}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <p className="text-center text-xs text-muted-foreground/60">
                  {filteredPast.length}{" "}
                  {filteredPast.length === 1
                    ? "встреча"
                    : filteredPast.length < 5
                      ? "встречи"
                      : "встреч"}
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* ============================================
          DIALOGS
          ============================================ */}

      {/* Schedule create/edit form */}
      {showScheduleForm && (
        <ScheduleForm
          schedule={editSchedule}
          members={members}
          departments={departments}
          telegramTargets={telegramTargets}
          onSave={editSchedule ? handleUpdateSchedule : handleCreateSchedule}
          onClose={() => {
            setShowScheduleForm(false);
            setEditSchedule(null);
          }}
        />
      )}

      {/* Delete schedule confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Удалить расписание «${deleteTarget?.title}»?`}
        description="Расписание будет удалено. Уже созданные встречи останутся."
        onConfirm={() => deleteTarget && handleDeleteSchedule(deleteTarget)}
      />

      {/* Create meeting manually */}
      {showCreateMeeting && (
        <CreateMeetingDialog
          members={members}
          departments={departments}
          onClose={() => setShowCreateMeeting(false)}
          onCreated={() => {
            refetchUpcoming();
            setShowCreateMeeting(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================
// Create Meeting Dialog (manual, no schedule)
// ============================================

function CreateMeetingDialog({
  members,
  departments,
  onClose,
  onCreated,
}: {
  members: TeamMember[];
  departments: Department[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("15:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [zoomEnabled, setZoomEnabled] = useState(true);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const membersById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  const selectedMembers = useMemo(
    () =>
      participantIds
        .map((id) => membersById.get(id))
        .filter((m): m is TeamMember => !!m),
    [participantIds, membersById]
  );

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Введите название");
      return;
    }
    if (!date) {
      setError("Выберите дату");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const meetingDate = zonedDateTimeToUtcIso(date, time, "Europe/Moscow");
      await api.createMeetingManual({
        title: title.trim(),
        meeting_date: meetingDate,
        timezone: "Europe/Moscow",
        zoom_enabled: zoomEnabled,
        duration_minutes: durationMinutes,
        participant_ids: participantIds.length > 0 ? participantIds : undefined,
      });
      toastSuccess("Встреча создана");
      onCreated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка создания";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Создать встречу</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Название
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название встречи"
              className="mt-1.5 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 items-end gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Дата
              </Label>
              <DatePicker
                value={date}
                onChange={setDate}
                placeholder="Выбрать"
                className="w-full mt-1.5 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Время (МСК)
              </Label>
              <TimePicker
                value={time}
                onChange={setTime}
                className="mt-1.5 w-full rounded-xl"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Длительность
            </Label>
            <Select
              value={String(durationMinutes)}
              onValueChange={(value) => setDurationMinutes(Number(value))}
            >
              <SelectTrigger className="mt-1.5 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 минут</SelectItem>
                <SelectItem value="30">30 минут</SelectItem>
                <SelectItem value="45">45 минут</SelectItem>
                <SelectItem value="60">1 час</SelectItem>
                <SelectItem value="90">1.5 часа</SelectItem>
                <SelectItem value="120">2 часа</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Participants */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              Участники
            </Label>
            <div className="mt-1.5 rounded-xl border border-border/60 bg-card p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">
                  {participantIds.length > 0
                    ? `Выбрано: ${participantIds.length}`
                    : "Участники не выбраны"}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-lg shrink-0"
                  onClick={() => setParticipantPickerOpen(true)}
                >
                  {participantIds.length > 0 ? "Изменить" : "Выбрать"}
                </Button>
              </div>

              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.slice(0, 8).map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2 py-1"
                    >
                      <UserAvatar name={member.full_name} avatarUrl={member.avatar_url} size="sm" />
                      <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                        {member.full_name}
                      </span>
                    </div>
                  ))}
                  {selectedMembers.length > 8 && (
                    <span className="inline-flex items-center rounded-lg border border-border/60 px-2 py-1 text-xs text-muted-foreground">
                      +{selectedMembers.length - 8}
                    </span>
                  )}
                </div>
              )}
            </div>

            <ParticipantsPickerDialog
              open={participantPickerOpen}
              onOpenChange={setParticipantPickerOpen}
              members={members}
              departments={departments}
              selectedIds={participantIds}
              onApply={setParticipantIds}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Создать Zoom-конференцию</span>
            </div>
            <Switch checked={zoomEnabled} onCheckedChange={setZoomEnabled} />
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button className="rounded-xl" onClick={handleCreate} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Создание...
                </>
              ) : (
                "Создать"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
