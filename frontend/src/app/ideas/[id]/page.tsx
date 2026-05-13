"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lightbulb, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IdeaStatusBadge } from "@/components/ideas/IdeaStatusBadge";
import { IdeaDecisionPanel } from "@/components/ideas/IdeaDecisionPanel";
import { IdeaDepartmentPanel } from "@/components/ideas/IdeaDepartmentPanel";
import { IdeaLinkedTasks } from "@/components/ideas/IdeaLinkedTasks";
import { CreateIdeaTaskDialog } from "@/components/ideas/CreateIdeaTaskDialog";
import { IdeaComments } from "@/components/ideas/IdeaComments";
import { IdeaEventHistory } from "@/components/ideas/IdeaEventHistory";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useToast } from "@/components/shared/Toast";
import { parseUTCDate } from "@/lib/dateUtils";
import { api } from "@/lib/api";
import type { Department, Idea, IdeaTaskLink, TeamMember } from "@/lib/types";

function formatDateTime(value: string): string {
  const parsed = parseUTCDate(value);
  if (Number.isNaN(parsed.getTime())) return "Дата не указана";

  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PersonLine({
  label,
  name,
  avatarUrl,
}: {
  label: string;
  name: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <UserAvatar name={name} avatarUrl={avatarUrl || null} size="sm" />
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-xs text-foreground">{name}</p>
      </div>
    </div>
  );
}

function IdeaDetailSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-28 rounded-md" />
      <div className="rounded-lg border border-border/60 bg-card px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-7 w-72 rounded-md" />
            <Skeleton className="h-4 w-96 max-w-full rounded-md" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Skeleton className="h-52 rounded-lg" />
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
        </div>
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </div>
  );
}

export default function IdeaDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toastError } = useToast();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogDepartmentId, setTaskDialogDepartmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchIdea = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [loadedIdea, loadedMembers, loadedDepartments] = await Promise.all([
        api.getIdea(id),
        api.getTeam().catch(() => [] as TeamMember[]),
        api.getDepartments().catch(() => [] as Department[]),
      ]);
      if (!isLatestRequest()) return;
      setIdea(loadedIdea);
      setMembers(loadedMembers);
      setDepartments(loadedDepartments);
    } catch (error) {
      if (isLatestRequest()) {
        toastError(error instanceof Error ? error.message : "Не удалось загрузить идею");
      }
    } finally {
      if (isLatestRequest()) {
        setLoading(false);
      }
    }
  }, [id, toastError]);

  useEffect(() => {
    fetchIdea();

    return () => {
      latestRequestSeqRef.current += 1;
    };
  }, [fetchIdea]);

  if (loading) {
    return <IdeaDetailSkeleton />;
  }

  if (!idea) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2 text-xs">
          <Link href="/ideas">
            <ArrowLeft className="h-3.5 w-3.5" />
            К идеям
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <Lightbulb className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-3 text-sm font-semibold text-foreground">
            Идея не найдена
          </h1>
        </div>
      </div>
    );
  }

  const authorName = idea.author?.full_name || "Автор не указан";
  const reviewOwnerName = idea.review_owner?.full_name || "Ответственный не указан";
  const canCreateTask = idea.status === "accepted" || idea.status === "in_tasks";
  const linkedTaskLinks: IdeaTaskLink[] = [
    ...idea.task_links,
    ...idea.departments.flatMap((department) => department.task_links),
  ];

  function openDirectTaskDialog() {
    setTaskDialogDepartmentId(null);
    setTaskDialogOpen(true);
  }

  function openDepartmentTaskDialog(ideaDepartmentId: string) {
    setTaskDialogDepartmentId(ideaDepartmentId);
    setTaskDialogOpen(true);
  }

  function handleTaskDialogOpenChange(nextOpen: boolean) {
    setTaskDialogOpen(nextOpen);
    if (!nextOpen) {
      setTaskDialogDepartmentId(null);
    }
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2 text-xs">
        <Link href="/ideas">
          <ArrowLeft className="h-3.5 w-3.5" />
          К идеям
        </Link>
      </Button>

      <header className="rounded-lg border border-border/60 bg-card px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <IdeaStatusBadge status={idea.status} />
              <span className="text-xs text-muted-foreground">
                Обновлено {formatDateTime(idea.updated_at)}
              </span>
            </div>

            <div className="min-w-0">
              <h1 className="break-words text-xl font-semibold leading-7 text-foreground">
                {idea.title}
              </h1>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                {idea.description}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <PersonLine
                label="Автор"
                name={authorName}
                avatarUrl={idea.author?.avatar_url}
              />
              <PersonLine
                label="Ревью"
                name={reviewOwnerName}
                avatarUrl={idea.review_owner?.avatar_url}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={openDirectTaskDialog}
              disabled={!canCreateTask}
              title={
                canCreateTask
                  ? undefined
                  : "Создание задач доступно для принятых идей и идей в задачах"
              }
              className="h-9 rounded-md px-3 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Создать задачу
            </Button>
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
              <UserRound className="h-5 w-5" />
            </div>
          </div>
        </div>
      </header>

      <CreateIdeaTaskDialog
        open={taskDialogOpen}
        onOpenChange={handleTaskDialogOpenChange}
        idea={idea}
        ideaDepartmentId={taskDialogDepartmentId}
        members={members}
        onCreated={setIdea}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <main className="space-y-4">
          <IdeaDecisionPanel idea={idea} onUpdated={setIdea} />
          <IdeaDepartmentPanel
            idea={idea}
            departments={departments}
            members={members}
            onUpdated={setIdea}
            onCreateTask={openDepartmentTaskDialog}
          />
          <IdeaLinkedTasks links={linkedTaskLinks} />
          <IdeaComments idea={idea} onUpdated={setIdea} />
        </main>

        <aside className="space-y-4">
          <IdeaEventHistory events={idea.events} />
        </aside>
      </div>
    </div>
  );
}
