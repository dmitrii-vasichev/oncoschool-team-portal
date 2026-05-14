"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  Edit3,
  History,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { ContentFactoryRetroDialog } from "@/components/content-factory/ContentFactoryRetroDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { api } from "@/lib/api";
import {
  CF_RETRO_TYPE_LABELS,
  formatContentFactoryRetroPeriod,
  getContentFactoryDisplayName,
  getContentFactoryRetroTitle,
  summarizeContentFactoryRetroSections,
} from "@/lib/contentFactoryUtils";
import type { CFBundle, CFRetroNote, TeamMember } from "@/lib/types";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Без даты";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Без даты";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function jsonText(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function RetroDetailLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-36 rounded-md" />
      <Skeleton className="h-36 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}

export default function ContentFactoryRetroDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toastError } = useToast();
  const { setPageTitle } = usePageTitle();
  const [retro, setRetro] = useState<CFRetroNote | null>(null);
  const [bundles, setBundles] = useState<CFBundle[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [retroRes, bundleRes, memberRes] = await Promise.all([
        api.getCFRetro(id),
        api.getCFBundles({ limit: 500 }).catch(() => [] as CFBundle[]),
        api.getTeam().catch(() => [] as TeamMember[]),
      ]);
      if (!isLatestRequest()) return;
      setRetro(retroRes);
      setBundles(bundleRes);
      setMembers(memberRes);
    } catch (err) {
      if (isLatestRequest()) {
        toastError(err instanceof Error ? err.message : "Не удалось загрузить ретро");
      }
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (retro) setPageTitle(getContentFactoryRetroTitle(retro));
    return () => setPageTitle(null);
  }, [retro, setPageTitle]);

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
    return <RetroDetailLoadingSkeleton />;
  }

  if (!retro) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2 text-xs">
          <Link href="/content-factory/retros">
            <ArrowLeft className="h-3.5 w-3.5" />
            К retros
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            Ретроспектива не найдена
          </h2>
        </div>
      </div>
    );
  }

  const summary = summarizeContentFactoryRetroSections(retro);
  const title = getContentFactoryRetroTitle(retro);
  const bundleName = bundleNames.get(retro.bundle_id ?? "") ?? "Без bundle";
  const facilitatorName =
    memberNames.get(retro.facilitator_id) ??
    getContentFactoryDisplayName(retro.facilitator_id, []);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2 text-xs">
          <Link href="/content-factory/retros">
            <ArrowLeft className="h-3.5 w-3.5" />
            К retros
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          onClick={() => void fetchData()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Обновить
        </Button>
      </div>

      <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-6 items-center rounded-md border border-primary/20 bg-primary/10 px-2 text-xs font-medium text-primary">
                {CF_RETRO_TYPE_LABELS[retro.retro_type]}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarRange className="h-3.5 w-3.5" />
                {formatContentFactoryRetroPeriod(retro)}
              </span>
            </div>
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              {title}
            </h1>
            <p className="max-w-4xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {retro.notes?.trim() || "Notes не заполнены"}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 rounded-md px-3 text-xs"
            onClick={() => setEditOpen(true)}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit retro
          </Button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <JsonSection
            title="Best by objective"
            count={summary.bestByObjective}
            value={retro.best_by_objective}
          />
          <JsonSection title="Broken" count={summary.broken} value={retro.broken} />
          <JsonSection
            title="Learnings"
            count={summary.learnings}
            value={retro.learnings}
          />
          <JsonSection
            title="Decisions"
            count={summary.decisions}
            value={retro.decisions}
          />
          <JsonSection title="Actions" count={summary.actions} value={retro.actions} />
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Retro details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Type</dt>
                <dd className="mt-1 text-foreground">
                  {CF_RETRO_TYPE_LABELS[retro.retro_type]}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Bundle</dt>
                <dd className="mt-1 text-foreground">{bundleName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">
                  Facilitator
                </dt>
                <dd className="mt-1 text-foreground">{facilitatorName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Created</dt>
                <dd className="mt-1 text-foreground">
                  {formatDateTime(retro.created_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Retro ID</dt>
                <dd className="mt-1 font-mono text-xs text-muted-foreground">
                  {getContentFactoryDisplayName(retro.id, [])}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Summary</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <RetroStat label="Best" value={summary.bestByObjective} />
              <RetroStat label="Broken" value={summary.broken} />
              <RetroStat label="Learnings" value={summary.learnings} />
              <RetroStat label="Decisions" value={summary.decisions} />
              <RetroStat label="Actions" value={summary.actions} />
            </div>
          </section>
        </aside>
      </div>

      <ContentFactoryRetroDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        retro={retro}
        bundles={bundles}
        members={members}
        onSaved={handleSaved}
      />
    </div>
  );
}

function JsonSection({
  title,
  count,
  value,
}: {
  title: string;
  count: number;
  value: unknown;
}) {
  return (
    <section className="rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words px-4 py-4 text-xs leading-6 text-muted-foreground">
        {jsonText(value)}
      </pre>
    </section>
  );
}

function RetroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/30 px-2 py-1.5">
      <span className="block text-2xs uppercase">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
