"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { ProjectStatusPanel } from "@/components/projects/ProjectStatusPanel";
import { ProjectDepartmentPanel } from "@/components/projects/ProjectDepartmentPanel";
import { ProjectMilestones } from "@/components/projects/ProjectMilestones";
import { ProjectLinkedTasks } from "@/components/projects/ProjectLinkedTasks";
import { CreateProjectTaskDialog } from "@/components/projects/CreateProjectTaskDialog";
import { ProjectComments } from "@/components/projects/ProjectComments";
import { ProjectEventHistory } from "@/components/projects/ProjectEventHistory";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { Department, Project, TeamMember } from "@/lib/types";

function ProjectDetailSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-28 rounded-md" />
      <div className="rounded-lg border border-border/60 bg-card px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-7 w-72 rounded-md" />
            <Skeleton className="h-4 w-96 max-w-full rounded-md" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-52 rounded-lg" />
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
        </div>
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { toastError, toastSuccess } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogDepartmentId, setTaskDialogDepartmentId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchProject = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [loadedProject, loadedMembers, loadedDepartments] = await Promise.all([
        api.getProject(id),
        api.getTeam().catch(() => [] as TeamMember[]),
        api.getDepartments().catch(() => [] as Department[]),
      ]);
      if (!isLatestRequest()) return;
      setProject(loadedProject);
      setMembers(loadedMembers);
      setDepartments(loadedDepartments);
    } catch (error) {
      if (isLatestRequest()) {
        toastError(error instanceof Error ? error.message : "Не удалось загрузить проект");
      }
    } finally {
      if (isLatestRequest()) {
        setLoading(false);
      }
    }
  }, [id, toastError]);

  useEffect(() => {
    fetchProject();

    return () => {
      latestRequestSeqRef.current += 1;
    };
  }, [fetchProject]);

  if (loading) {
    return <ProjectDetailSkeleton />;
  }

  if (!project) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2 text-xs">
          <Link href="/projects">
            <ArrowLeft className="h-3.5 w-3.5" />
            К проектам
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-3 text-sm font-semibold text-foreground">
            Проект не найден
          </h1>
        </div>
      </div>
    );
  }

  function openDirectTaskDialog() {
    setTaskDialogDepartmentId(null);
    setTaskDialogOpen(true);
  }

  function openDepartmentTaskDialog(projectDepartmentId: string) {
    setTaskDialogDepartmentId(projectDepartmentId);
    setTaskDialogOpen(true);
  }

  function handleTaskDialogOpenChange(nextOpen: boolean) {
    setTaskDialogOpen(nextOpen);
    if (!nextOpen) {
      setTaskDialogDepartmentId(null);
    }
  }

  async function handleDeleteProject() {
    if (!project || deleting) return;

    setDeleting(true);
    try {
      await api.deleteProject(project.id);
      toastSuccess("Проект удалён");
      router.push("/projects");
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось удалить проект");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2 text-xs">
        <Link href="/projects">
          <ArrowLeft className="h-3.5 w-3.5" />
          К проектам
        </Link>
      </Button>

      <ProjectHeader
        project={project}
        deleting={deleting}
        onCreateTask={openDirectTaskDialog}
        onDelete={() => setDeleteDialogOpen(true)}
      />

      <CreateProjectTaskDialog
        open={taskDialogOpen}
        onOpenChange={handleTaskDialogOpenChange}
        project={project}
        projectDepartmentId={taskDialogDepartmentId}
        members={members}
        onCreated={setProject}
      />

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!deleting) setDeleteDialogOpen(nextOpen);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg">Удалить проект?</DialogTitle>
            <DialogDescription>
              Проект исчезнет из реестра и карточки. Это действие нельзя отменить через интерфейс.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Оставить
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDeleteProject}
              disabled={deleting}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {deleting ? "Удаляем..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <main className="space-y-4">
          <ProjectStatusPanel project={project} onUpdated={setProject} />
          <ProjectDepartmentPanel
            project={project}
            departments={departments}
            members={members}
            onUpdated={setProject}
            onCreateTask={openDepartmentTaskDialog}
          />
          <ProjectMilestones project={project} onUpdated={setProject} />
          <ProjectLinkedTasks project={project} />
          <ProjectComments project={project} onUpdated={setProject} />
        </main>

        <aside className="space-y-4">
          <ProjectEventHistory events={project.events} />
        </aside>
      </div>
    </div>
  );
}
