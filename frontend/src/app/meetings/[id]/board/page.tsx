"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { MeetingBoardHeader } from "@/components/meetings/MeetingBoardHeader";
import { MeetingBoardMaterials } from "@/components/meetings/MeetingBoardMaterials";
import { MeetingBoardScopePanel } from "@/components/meetings/MeetingBoardScopePanel";
import { MeetingBoardSection } from "@/components/meetings/MeetingBoardSection";
import { MEETING_BOARD_SECTIONS } from "@/components/meetings/meetingBoardUtils";
import { useToast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDepartments } from "@/hooks/useDepartments";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import { PermissionService } from "@/lib/permissions";
import type { MeetingBoardResponse, MeetingBoardSettings, TaskLabel } from "@/lib/types";

export default function MeetingBoardPage() {
  const params = useParams();
  const meetingId = params.id as string;
  const { toastError } = useToast();
  const { user } = useCurrentUser();
  const { members } = useTeam();
  const { departments } = useDepartments();
  const { setPageTitle } = usePageTitle();

  const [board, setBoard] = useState<MeetingBoardResponse | null>(null);
  const [taskLabels, setTaskLabels] = useState<TaskLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isModerator = user ? PermissionService.isModerator(user) : false;

  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMeetingBoard(meetingId);
      setBoard(data);
      try {
        const labels = await api.getTaskLabels({ limit: 100 });
        setTaskLabels(labels);
      } catch {
        setTaskLabels([]);
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось загрузить доску встречи";
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  }, [meetingId, toastError]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const updateBoardSettings = useCallback(
    async (
      data: Partial<
        Pick<
          MeetingBoardSettings,
          | "added_member_ids"
          | "added_department_ids"
          | "pinned_task_ids"
          | "focus_label_ids"
          | "materials"
          | "board_notes"
        >
      >,
    ) => {
      await api.updateMeetingBoardSettings(meetingId, data);
      const nextBoard = await api.getMeetingBoard(meetingId);
      setBoard(nextBoard);
      try {
        const labels = await api.getTaskLabels({ limit: 100 });
        setTaskLabels(labels);
      } catch {
        setTaskLabels([]);
      }
    },
    [meetingId],
  );

  useEffect(() => {
    if (board?.meeting.title) {
      setPageTitle(board.meeting.title);
    }
    return () => setPageTitle(null);
  }, [board?.meeting.title, setPageTitle]);

  if (loading) {
    return (
      <div className="max-w-7xl space-y-5 animate-in fade-in duration-300">
        <div className="space-y-3">
          <Skeleton className="h-5 w-24 rounded-lg" />
          <Skeleton className="h-9 w-80 max-w-full rounded-lg" />
          <Skeleton className="h-5 w-52 rounded-lg" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Skeleton className="h-36 rounded-xl" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {MEETING_BOARD_SECTIONS.map((sectionKey) => (
              <Skeleton key={sectionKey} className="h-80 rounded-xl" />
            ))}
          </div>
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex min-h-[420px] max-w-3xl flex-col items-center justify-center px-4 text-center">
        <p className="text-sm font-medium text-destructive">
          {error || "Доска встречи недоступна"}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" onClick={loadBoard}>
            <RefreshCw className="h-3.5 w-3.5" />
            Повторить
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/meetings/${meetingId}`}>
              <ArrowLeft className="h-3.5 w-3.5" />
              К встрече
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-5 animate-in fade-in duration-300">
      <MeetingBoardHeader
        meeting={board.meeting}
        participantCount={board.meeting.participant_ids.length}
      />

      <MeetingBoardScopePanel
        settings={board.settings}
        members={members}
        departments={departments}
        focusLabels={taskLabels}
        isModerator={isModerator}
        onUpdateSettings={updateBoardSettings}
      />

      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-5">
        {MEETING_BOARD_SECTIONS.map((sectionKey) => (
          <MeetingBoardSection
            key={sectionKey}
            sectionKey={sectionKey}
            tasks={board[sectionKey]}
          />
        ))}
      </div>

      <MeetingBoardMaterials settings={board.settings} />
    </div>
  );
}
