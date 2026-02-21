"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Video,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMeetings } from "@/hooks/useMeetings";
import { useTeam } from "@/hooks/useTeam";
import { useDepartments } from "@/hooks/useDepartments";
import { PermissionService } from "@/lib/permissions";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScheduleForm } from "@/components/meetings/ScheduleForm";
import { MeetingReminderTextsDialog } from "@/components/meetings/MeetingReminderTextsDialog";
import { MeetingCard } from "@/components/meetings/MeetingCard";
import type {
  MeetingScheduleCreateRequest,
  TelegramNotificationTarget,
} from "@/lib/types";

const PER_PAGE = 9;

export default function MeetingsPage() {
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();
  const isModerator = user ? PermissionService.isModerator(user) : false;
  const scopeParam = searchParams.get("scope");
  const tabParam = searchParams.get("tab");
  const meetingsMemberId =
    scopeParam === "my" && user?.id ? user.id : undefined;

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
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showReminderTextsDialog, setShowReminderTextsDialog] = useState(false);

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
      toastSuccess("Встреча создана");
      refetchUpcoming();
    },
    [refetchUpcoming, toastSuccess]
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

  const loading = upcomingLoading || pastLoading;

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Meeting skeletons */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-72 rounded-lg" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
      <section>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="w-full overflow-x-auto rounded-xl sm:w-auto">
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
              <div className="flex w-full gap-2 sm:w-auto">
                <Button
                  size="sm"
                  className="w-full rounded-xl gap-1.5 sm:w-auto"
                  onClick={() => setShowScheduleForm(true)}
                >
                  <Video className="h-3.5 w-3.5" />
                  Новая встреча
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full rounded-xl gap-1.5 sm:w-auto"
                  onClick={() => setShowReminderTextsDialog(true)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Тексты напоминаний
                </Button>
              </div>
            )}
          </div>

          {/* Upcoming tab */}
          <TabsContent value="upcoming" className="mt-0">
            {upcomingMeetings.length === 0 ? (
              <EmptyState
                variant="meetings"
                title="Нет предстоящих встреч"
                description="Создайте новую встречу, чтобы она появилась в этом списке"
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcomingMeetings.map((meeting, i) => (
                  <div
                    key={meeting.id}
                    className={`h-full animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}
                  >
                    <MeetingCard
                      meeting={meeting}
                      variant="upcoming"
                      members={members}
                      isModerator={isModerator}
                      onDelete={handleDeleteMeeting}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Past tab */}
          <TabsContent value="past" className="mt-0 space-y-4">
            {/* Search */}
            <div className="relative w-full max-w-sm">
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {paginatedPast.map((meeting, i) => (
                    <div
                    key={meeting.id}
                    className={`h-full animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}
                  >
                    <MeetingCard
                      meeting={meeting}
                      variant="past"
                      members={members}
                      isModerator={isModerator}
                      onDelete={handleDeleteMeeting}
                    />
                  </div>
                ))}
              </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center overflow-x-auto pb-1 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="inline-flex min-w-max items-center gap-1 rounded-xl bg-muted/70 p-1">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setPage(num)}
                            className={`
                              h-8 w-8 rounded-lg text-sm font-medium flex items-center justify-center transition-colors
                              ${
                                num === currentPage
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                              }
                            `}
                          >
                            {num}
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
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
          schedule={null}
          members={members}
          departments={departments}
          telegramTargets={telegramTargets}
          onSave={handleCreateSchedule}
          onClose={() => setShowScheduleForm(false)}
        />
      )}

      {showReminderTextsDialog && (
        <MeetingReminderTextsDialog
          open={showReminderTextsDialog}
          onOpenChange={setShowReminderTextsDialog}
        />
      )}
    </div>
  );
}
