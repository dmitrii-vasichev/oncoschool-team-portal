"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Edit3, RefreshCw, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { ContentFactoryGuestActivityPanel } from "@/components/content-factory/ContentFactoryGuestActivityPanel";
import { ContentFactoryGuestAttentionPanel } from "@/components/content-factory/ContentFactoryGuestAttentionPanel";
import { ContentFactoryGuestStageTimelinePanel } from "@/components/content-factory/ContentFactoryGuestStageTimelinePanel";
import { ContentFactoryGuestStoryDetailPanels } from "@/components/content-factory/ContentFactoryGuestStoryDetailPanels";
import { ContentFactoryGuestStoryDialog } from "@/components/content-factory/ContentFactoryGuestStoryDialog";
import { usePageTitle } from "@/hooks/usePageTitle";
import { api } from "@/lib/api";
import {
  CF_GUEST_CONSENT_STATUS_LABELS,
  CF_GUEST_ROLE_LABELS,
  CF_GUEST_SOURCE_LABELS,
  CF_GUEST_STATUS_LABELS,
  getContentFactoryDisplayName,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFGuestStory,
  CFGuestStoryEvent,
  CFNosology,
  CFPublication,
  TeamMember,
} from "@/lib/types";

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

function GuestDetailLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-36 rounded-md" />
      <Skeleton className="h-36 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </div>
  );
}

export default function ContentFactoryGuestDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toastError } = useToast();
  const { setPageTitle } = usePageTitle();
  const [story, setStory] = useState<CFGuestStory | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [bundles, setBundles] = useState<CFBundle[]>([]);
  const [publications, setPublications] = useState<CFPublication[]>([]);
  const [nosologies, setNosologies] = useState<CFNosology[]>([]);
  const [events, setEvents] = useState<CFGuestStoryEvent[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [
        storyRes,
        eventRes,
        memberRes,
        bundleRes,
        publicationRes,
        nosologyRes,
      ] =
        await Promise.all([
          api.getCFGuestStory(id),
          api.getCFGuestStoryEvents(id).catch((err) => {
            toastError(
              err instanceof Error
                ? err.message
                : "Не удалось загрузить журнал истории",
            );
            return [] as CFGuestStoryEvent[];
          }),
          api.getTeam().catch(() => [] as TeamMember[]),
          api.getCFBundles({ limit: 500 }).catch(() => [] as CFBundle[]),
          api.getCFPublications({ limit: 500 }).catch(
            () => [] as CFPublication[],
          ),
          api.getCFNosologies({ only_active: false }).catch(
            () => [] as CFNosology[],
          ),
        ]);
      if (!isLatestRequest()) return;
      setStory(storyRes);
      setEvents(eventRes);
      setMembers(memberRes);
      setBundles(bundleRes);
      setPublications(publicationRes);
      setNosologies(nosologyRes);
    } catch (err) {
      if (!isLatestRequest()) return;
      toastError(
        err instanceof Error ? err.message : "Не удалось загрузить историю гостя",
      );
      setStory(null);
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (story) setPageTitle(story.display_name);
    return () => setPageTitle(null);
  }, [setPageTitle, story]);

  async function handleSaved() {
    setEditOpen(false);
    await fetchData();
  }

  if (loading) {
    return <GuestDetailLoadingSkeleton />;
  }

  if (!story) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2 text-xs">
          <Link href="/content-factory/guests">
            <ArrowLeft className="h-3.5 w-3.5" />
            К гостям и историям
          </Link>
        </Button>
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <UserRound className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-3 text-sm font-semibold text-foreground">
            История не найдена
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Возможно, запись удалена или у вас нет доступа к этому разделу.
          </p>
        </div>
      </div>
    );
  }

  const ownerName = getContentFactoryDisplayName(story.owner_id, members);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-md px-2 text-xs">
          <Link href="/content-factory/guests">
            <ArrowLeft className="h-3.5 w-3.5" />
            К гостям и историям
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
              <Badge variant="outline">{CF_GUEST_STATUS_LABELS[story.status]}</Badge>
              <Badge variant="outline">{CF_GUEST_ROLE_LABELS[story.role]}</Badge>
              <Badge variant="outline">{CF_GUEST_SOURCE_LABELS[story.source]}</Badge>
              <Badge
                variant="outline"
                className={
                  story.consent_status === "signed"
                    ? "border-status-done-fg/30 bg-status-done-bg text-status-done-fg"
                    : "border-muted-foreground/20 bg-muted text-muted-foreground"
                }
              >
                {CF_GUEST_CONSENT_STATUS_LABELS[story.consent_status]}
              </Badge>
            </div>
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              {story.display_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ownerName} · следующий шаг: {formatDateTime(story.stage_due_at)}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 rounded-md px-3 text-xs"
            onClick={() => setEditOpen(true)}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Редактировать
          </Button>
        </div>
      </section>

      <ContentFactoryGuestAttentionPanel story={story} />

      <ContentFactoryGuestStageTimelinePanel story={story} events={events} />

      <ContentFactoryGuestStoryDetailPanels
        story={story}
        members={members}
        bundles={bundles}
        publications={publications}
        nosologies={nosologies}
      />

      <ContentFactoryGuestActivityPanel
        guestStoryId={story.id}
        events={events}
        members={members}
        onEventCreated={fetchData}
      />

      <ContentFactoryGuestStoryDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        story={story}
        members={members}
        bundles={bundles}
        publications={publications}
        nosologies={nosologies}
        onSaved={handleSaved}
      />
    </div>
  );
}
