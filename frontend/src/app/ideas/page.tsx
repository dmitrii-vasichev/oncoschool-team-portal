"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lightbulb, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { CreateIdeaDialog } from "@/components/ideas/CreateIdeaDialog";
import {
  EMPTY_IDEA_FILTERS,
  IdeaFilters,
  type IdeaFilterValues,
} from "@/components/ideas/IdeaFilters";
import { IdeaRegisterRow } from "@/components/ideas/IdeaRegisterRow";
import { api } from "@/lib/api";
import type { Department, Idea, TeamMember } from "@/lib/types";

function buildIdeaParams(filters: IdeaFilterValues): Record<string, string> {
  const params: Record<string, string> = { per_page: "100" };

  if (filters.status !== "all") params.status = filters.status;
  if (filters.author_id) params.author_id = filters.author_id;
  if (filters.review_owner_id) params.review_owner_id = filters.review_owner_id;
  if (filters.department_id) params.department_id = filters.department_id;

  return params;
}

function IdeasLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="h-3 w-44 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <Skeleton className="h-24 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  );
}

export default function IdeasPage() {
  const { toastError } = useToast();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState<IdeaFilterValues>(EMPTY_IDEA_FILTERS);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [ideasRes, membersRes, departmentsRes] = await Promise.all([
        api.getIdeas(buildIdeaParams(filters)),
        api.getTeam().catch(() => [] as TeamMember[]),
        api.getDepartments().catch(() => [] as Department[]),
      ]);
      if (!isLatestRequest()) return;
      setIdeas(ideasRes.items);
      setMembers(membersRes);
      setDepartments(departmentsRes);
    } catch {
      if (isLatestRequest()) {
        toastError("Не удалось загрузить идеи");
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

  async function handleIdeaCreated() {
    await fetchData();
  }

  if (loading) {
    return <IdeasLoadingSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lightbulb className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              Идеи
            </h1>
            <p className="text-sm text-muted-foreground">
              Реестр предложений, review и связанной реализации
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="h-8 w-full gap-1.5 rounded-md px-3 text-xs sm:w-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Новая идея
        </Button>
      </div>

      <IdeaFilters
        filters={filters}
        members={members}
        departments={departments}
        onChange={setFilters}
      />

      <div className="flex items-center justify-between gap-3 border-y border-border/60 py-2">
        <p className="text-sm text-muted-foreground">
          {ideas.length} {ideas.length === 1 ? "идея" : "идей"}
        </p>
      </div>

      {ideas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <Lightbulb className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            Идей по выбранным фильтрам нет
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Создайте новую идею или измените фильтры.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <IdeaRegisterRow key={idea.id} idea={idea} />
          ))}
        </div>
      )}

      <CreateIdeaDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        onCreated={handleIdeaCreated}
      />
    </div>
  );
}
