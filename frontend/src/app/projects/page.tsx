"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import {
  EMPTY_PROJECT_FILTERS,
  ProjectFilters,
  type ProjectFilterValues,
} from "@/components/projects/ProjectFilters";
import { ProjectRegisterRow } from "@/components/projects/ProjectRegisterRow";
import { api } from "@/lib/api";
import type { Department, Project, TeamMember } from "@/lib/types";

function buildProjectParams(filters: ProjectFilterValues): Record<string, string> {
  const params: Record<string, string> = { per_page: "100" };

  if (filters.status !== "all") params.status = filters.status;
  if (filters.search.trim()) params.search = filters.search.trim();
  if (filters.owner_id) params.owner_id = filters.owner_id;
  if (filters.department_id) params.department_id = filters.department_id;
  if (filters.source_idea_id.trim()) {
    params.source_idea_id = filters.source_idea_id.trim();
  }
  if (filters.created_from.trim()) params.created_from = filters.created_from.trim();
  if (filters.created_to.trim()) params.created_to = filters.created_to.trim();

  return params;
}

function formatProjectCount(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return `${count} проект`;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${count} проекта`;
  }
  return `${count} проектов`;
}

function ProjectsLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-3 w-56 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <Skeleton className="h-28 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { toastError } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState<ProjectFilterValues>(
    EMPTY_PROJECT_FILTERS,
  );
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [projectsRes, membersRes, departmentsRes] = await Promise.all([
        api.getProjects(buildProjectParams(filters)),
        api.getTeam().catch(() => [] as TeamMember[]),
        api.getDepartments().catch(() => [] as Department[]),
      ]);
      if (!isLatestRequest()) return;
      setProjects(projectsRes.items);
      setMembers(membersRes);
      setDepartments(departmentsRes);
    } catch {
      if (isLatestRequest()) {
        toastError("Не удалось загрузить проекты");
      }
    } finally {
      if (isLatestRequest()) {
        setLoading(false);
      }
    }
  }, [filters, toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleProjectCreated() {
    await fetchData();
  }

  if (loading) {
    return <ProjectsLoadingSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderKanban className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              Проекты
            </h1>
            <p className="text-sm text-muted-foreground">
              Реестр проектов, этапов, отделов и связанных задач
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="h-8 w-full gap-1.5 rounded-md px-3 text-xs sm:w-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Новый проект
        </Button>
      </div>

      <ProjectFilters
        filters={filters}
        members={members}
        departments={departments}
        onChange={setFilters}
      />

      <div className="flex items-center justify-between gap-3 border-y border-border/60 py-2">
        <p className="text-sm text-muted-foreground">
          {formatProjectCount(projects.length)}
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            Проектов по выбранным фильтрам нет
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Создайте новый проект или измените фильтры.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <ProjectRegisterRow key={project.id} project={project} />
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        departments={departments}
        onCreated={handleProjectCreated}
      />
    </div>
  );
}
