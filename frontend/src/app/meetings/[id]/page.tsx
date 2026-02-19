"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  ListChecks,
  StickyNote,
  MessageSquareText,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/shared/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PermissionService } from "@/lib/permissions";
import { api } from "@/lib/api";
import type { Meeting, Task, MeetingStatus } from "@/lib/types";

import { MeetingHeader } from "@/components/meetings/MeetingHeader";
import { ZoomBlock } from "@/components/meetings/ZoomBlock";
import { ParticipantsBlock } from "@/components/meetings/ParticipantsBlock";
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

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("summary");

  const fetchData = useCallback(async () => {
    try {
      const [meetingData, tasksData] = await Promise.all([
        api.getMeeting(id),
        api.getMeetingTasks(id),
      ]);
      setMeeting(meetingData);
      setTasks(tasksData);
    } catch {
      toastError("Не удалось загрузить встречу");
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleDelete = async () => {
    try {
      await api.deleteMeeting(id);
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

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-6 w-20 rounded-lg" />
        <Skeleton className="h-10 w-80 rounded-lg" />
        <Skeleton className="h-6 w-48 rounded-lg" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <div className="flex gap-2">
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
        onUpdateTitle={handleUpdateTitle}
        onUpdateStatus={handleUpdateStatus}
        onDelete={handleDelete}
      />

      {/* Zoom + Participants row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up stagger-2">
        <ZoomBlock meeting={meeting} isModerator={isModerator} />
        <ParticipantsBlock participants={[]} />
      </div>

      {/* Custom tabs */}
      <div className="animate-fade-in-up stagger-3">
        <div className="flex gap-1 p-1 bg-muted/50 rounded-2xl w-fit">
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
                  flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
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
    </div>
  );
}
