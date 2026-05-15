"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, RefreshCw, Search, UserRound } from "lucide-react";
import { ContentFactoryGuestStoryDialog } from "@/components/content-factory/ContentFactoryGuestStoryDialog";
import { ContentFactoryGuestStoryTable } from "@/components/content-factory/ContentFactoryGuestStoryTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import {
  CF_GUEST_CONSENT_STATUS_LABELS,
  CF_GUEST_STATUS_LABELS,
  filterContentFactoryGuestStories,
  sortContentFactoryGuestStoriesByAttention,
  summarizeContentFactoryGuestStories,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFGuestConsentStatus,
  CFGuestStory,
  CFGuestStoryStatus,
  CFNosology,
  CFPublication,
  TeamMember,
} from "@/lib/types";

type GuestStatusFilter = "all" | CFGuestStoryStatus;
type ConsentFilter = "all" | CFGuestConsentStatus;
type AttentionFilter = "all" | "needs_attention";

function GuestsLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-3 w-80 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-36 rounded-lg" />
      <Skeleton className="h-36 rounded-lg" />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-3 py-3 shadow-sm">
      <span className="block text-2xs uppercase text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block text-xl font-semibold text-foreground">
        {value}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{helper}</span>
    </div>
  );
}

export default function ContentFactoryGuestsPage() {
  const { toastError } = useToast();
  const [stories, setStories] = useState<CFGuestStory[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [bundles, setBundles] = useState<CFBundle[]>([]);
  const [publications, setPublications] = useState<CFPublication[]>([]);
  const [nosologies, setNosologies] = useState<CFNosology[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<GuestStatusFilter>("all");
  const [consentFilter, setConsentFilter] = useState<ConsentFilter>("all");
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [bundleFilter, setBundleFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<CFGuestStory | null>(null);
  const [loading, setLoading] = useState(true);
  const latestRequestSeqRef = useRef(0);

  const fetchData = useCallback(async () => {
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    const isLatestRequest = () => latestRequestSeqRef.current === requestSeq;

    setLoading(true);
    try {
      const [storyRes, memberRes, bundleRes, publicationRes, nosologyRes] =
        await Promise.all([
          api.getCFGuestStories({ limit: 500 }),
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
      setStories(storyRes);
      setMembers(memberRes);
      setBundles(bundleRes);
      setPublications(publicationRes);
      setNosologies(nosologyRes);
    } catch (err) {
      if (!isLatestRequest()) return;
      toastError(
        err instanceof Error ? err.message : "Не удалось загрузить истории гостей",
      );
      setStories([]);
    } finally {
      if (isLatestRequest()) setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = useMemo(
    () => summarizeContentFactoryGuestStories(stories),
    [stories],
  );
  const filteredStories = useMemo(
    () =>
      sortContentFactoryGuestStoriesByAttention(
        filterContentFactoryGuestStories(stories, {
          search,
          status: statusFilter,
          consentStatus: consentFilter,
          attention: attentionFilter,
          ownerId: ownerFilter,
          bundleId: bundleFilter,
        }),
      ),
    [
      attentionFilter,
      bundleFilter,
      consentFilter,
      ownerFilter,
      search,
      statusFilter,
      stories,
    ],
  );
  const ownersWithStories = useMemo(
    () =>
      members.filter((member) =>
        stories.some((story) => story.owner_id === member.id),
      ),
    [members, stories],
  );
  const bundlesWithStories = useMemo(
    () =>
      bundles.filter((bundle) =>
        stories.some((story) => story.bundle_id === bundle.id),
      ),
    [bundles, stories],
  );

  async function handleSaved() {
    await fetchData();
  }

  if (loading) {
    return <GuestsLoadingSkeleton />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              Гости и истории
            </h1>
            <p className="text-sm text-muted-foreground">
              Отбор, согласия, границы публичности, публикации, подарки и follow-up
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
            Новая история
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          label="Всего"
          value={summary.total}
          helper="Истории и кандидаты"
        />
        <SummaryCard
          label="В работе"
          value={summary.active}
          helper="Не закрыты и не отложены"
        />
        <SummaryCard
          label="Согласие"
          value={summary.consentSigned}
          helper="Подписано"
        />
        <SummaryCard
          label="Follow-up"
          value={summary.followUpsDue}
          helper="Пора вернуться"
        />
        <SummaryCard
          label="Подарки"
          value={summary.giftPending}
          helper="Нужно отправить"
        />
        <SummaryCard
          label="Требуют внимания"
          value={summary.attentionNeeded}
          helper="Нужно действие"
        />
      </div>

      <div className="space-y-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(220px,1.6fr)_repeat(5,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по имени, контакту, заметкам или границам"
              className="h-9 border-border/70 bg-muted/20 pl-8 text-sm"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as GuestStatusFilter)}
          >
            <SelectTrigger className="h-9 min-w-0 border-border/70 bg-muted/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
              <SelectItem value="all">Все этапы</SelectItem>
              {Object.entries(CF_GUEST_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={consentFilter}
            onValueChange={(value) => setConsentFilter(value as ConsentFilter)}
          >
            <SelectTrigger className="h-9 min-w-0 border-border/70 bg-muted/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70] border-border/70 shadow-xl">
              <SelectItem value="all">Все согласия</SelectItem>
              {Object.entries(CF_GUEST_CONSENT_STATUS_LABELS).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <Select
            value={attentionFilter}
            onValueChange={(value) =>
              setAttentionFilter(value as AttentionFilter)
            }
          >
            <SelectTrigger className="h-9 min-w-0 border-border/70 bg-muted/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70] border-border/70 shadow-xl">
              <SelectItem value="all">Все истории</SelectItem>
              <SelectItem value="needs_attention">Требуют внимания</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="h-9 min-w-0 border-border/70 bg-muted/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
              <SelectItem value="all">Все ответственные</SelectItem>
              {ownersWithStories.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bundleFilter} onValueChange={setBundleFilter}>
            <SelectTrigger className="h-9 min-w-0 border-border/70 bg-muted/20 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[70] max-h-72 border-border/70 shadow-xl">
              <SelectItem value="all">Все кампании</SelectItem>
              {bundlesWithStories.map((bundle) => (
                <SelectItem key={bundle.id} value={bundle.id}>
                  {bundle.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="border-t border-border/60 pt-2 text-sm text-muted-foreground sm:text-right">
          Показано {filteredStories.length} из {stories.length}
        </p>
      </div>

      <ContentFactoryGuestStoryTable
        stories={filteredStories}
        members={members}
        bundles={bundles}
        publications={publications}
        onEdit={setEditingStory}
      />

      <ContentFactoryGuestStoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        bundles={bundles}
        publications={publications}
        nosologies={nosologies}
        onSaved={handleSaved}
      />

      <ContentFactoryGuestStoryDialog
        open={Boolean(editingStory)}
        onOpenChange={(open) => {
          if (!open) setEditingStory(null);
        }}
        story={editingStory}
        members={members}
        bundles={bundles}
        publications={publications}
        nosologies={nosologies}
        onSaved={async () => {
          setEditingStory(null);
          await handleSaved();
        }}
      />
    </div>
  );
}
