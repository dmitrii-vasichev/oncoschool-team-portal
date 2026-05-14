"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarRange, History, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/shared/Toast";
import { ContentFactoryRetroDialog } from "@/components/content-factory/ContentFactoryRetroDialog";
import { api } from "@/lib/api";
import {
  CF_RETRO_TYPE_LABELS,
  formatContentFactoryRetroPeriod,
  getContentFactoryDisplayName,
  getContentFactoryRetroTitle,
  summarizeContentFactoryRetroSections,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFRetroListParams,
  CFRetroNote,
  CFRetroType,
  TeamMember,
} from "@/lib/types";

type RetroTypeFilter = "all" | CFRetroType;

const RETRO_TYPES: CFRetroType[] = ["weekly", "monthly", "bundle", "adhoc"];

function RetrosLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-3 w-64 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <Skeleton className="h-16 rounded-lg" />
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-32 rounded-lg" />
    </div>
  );
}

export default function ContentFactoryRetrosPage() {
  const { toastError } = useToast();
  const [retros, setRetros] = useState<CFRetroNote[]>([]);
  const [bundles, setBundles] = useState<CFBundle[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [typeFilter, setTypeFilter] = useState<RetroTypeFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;
    const params: CFRetroListParams = { limit: 100 };
    if (typeFilter !== "all") params.retro_type = typeFilter;

    setLoading(true);
    try {
      const [retroRes, bundleRes, memberRes] = await Promise.all([
        api.getCFRetros(params),
        api.getCFBundles({ limit: 500 }).catch(() => [] as CFBundle[]),
        api.getTeam().catch(() => [] as TeamMember[]),
      ]);
      if (!isLatestRequest()) return;
      setRetros(retroRes);
      setBundles(bundleRes);
      setMembers(memberRes);
    } catch {
      if (isLatestRequest()) toastError("Не удалось загрузить ретроспективы");
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [toastError, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const bundleNames = useMemo(
    () => new Map(bundles.map((bundle) => [bundle.id, bundle.name])),
    [bundles],
  );
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.full_name])),
    [members],
  );

  async function handleSaved() {
    await fetchData();
  }

  if (loading) {
    return <RetrosLoadingSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <History className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              Retrospectives
            </h1>
            <p className="text-sm text-muted-foreground">
              Evidence log для результатов, решений и следующих действий
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full gap-1.5 px-2.5 text-xs sm:w-auto"
            onClick={() => void fetchData()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Обновить
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 w-full gap-1.5 rounded-md px-3 text-xs sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New retro
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {retros.length} {retros.length === 1 ? "retro" : "retros"}
        </p>
        <div className="w-full sm:w-56">
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as RetroTypeFilter)}
          >
            <SelectTrigger className="h-9 border-border/70 bg-muted/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70] border-border/70 shadow-xl">
              <SelectItem value="all">All types</SelectItem>
              {RETRO_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {CF_RETRO_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {retros.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            Ретроспектив пока нет
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Создайте первую ретроспективу после завершения кампании или недели.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {retros.map((retro) => {
            const summary = summarizeContentFactoryRetroSections(retro);
            return (
              <Link
                key={retro.id}
                href={`/content-factory/retros/${retro.id}`}
                className="block rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/20"
              >
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-6 items-center rounded-md border border-primary/20 bg-primary/10 px-2 text-xs font-medium text-primary">
                        {CF_RETRO_TYPE_LABELS[retro.retro_type]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatContentFactoryRetroPeriod(retro)}
                      </span>
                    </div>
                    <h2 className="truncate text-sm font-semibold text-foreground">
                      {getContentFactoryRetroTitle(retro)}
                    </h2>
                    <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {retro.notes?.trim() || "Notes не заполнены"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {bundleNames.get(retro.bundle_id ?? "") ?? "Без bundle"} ·{" "}
                      {memberNames.get(retro.facilitator_id) ??
                        getContentFactoryDisplayName(retro.facilitator_id, [])}
                    </p>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-5 lg:w-[420px]">
                    <RetroStat label="Best" value={summary.bestByObjective} />
                    <RetroStat label="Broken" value={summary.broken} />
                    <RetroStat label="Learnings" value={summary.learnings} />
                    <RetroStat label="Decisions" value={summary.decisions} />
                    <RetroStat label="Actions" value={summary.actions} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <ContentFactoryRetroDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        bundles={bundles}
        members={members}
        onSaved={handleSaved}
      />
    </div>
  );
}

function RetroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/30 px-2 py-1.5">
      <span className="block text-2xs uppercase">{label}</span>
      <span className="inline-flex items-center gap-1 font-medium text-foreground">
        <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
        {value}
      </span>
    </div>
  );
}
