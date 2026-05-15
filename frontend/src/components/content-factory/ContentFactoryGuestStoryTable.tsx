"use client";

import Link from "next/link";
import {
  CalendarClock,
  Edit3,
  FileText,
  FolderKanban,
  Gift,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CF_GUEST_ANONYMITY_LABELS,
  CF_GUEST_CONSENT_STATUS_LABELS,
  CF_GUEST_GIFT_STATUS_LABELS,
  CF_GUEST_ROLE_LABELS,
  CF_GUEST_SOURCE_LABELS,
  CF_GUEST_STATUS_LABELS,
  getContentFactoryDisplayName,
  isContentFactoryGuestFollowUpDue,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFGuestStory,
  CFPublication,
  TeamMember,
} from "@/lib/types";

type ContentFactoryGuestStoryTableProps = {
  stories: CFGuestStory[];
  members: TeamMember[];
  bundles: CFBundle[];
  publications: CFPublication[];
  onEdit: (story: CFGuestStory) => void;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Нет срока";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Нет срока";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function publicationTitle(publication: CFPublication): string {
  return publication.title?.trim() || `Публикация ${publication.id.slice(0, 8)}`;
}

export function ContentFactoryGuestStoryTable({
  stories,
  members,
  bundles,
  publications,
  onEdit,
}: ContentFactoryGuestStoryTableProps) {
  const bundlesById = new Map(bundles.map((bundle) => [bundle.id, bundle]));
  const publicationsById = new Map(
    publications.map((publication) => [publication.id, publication]),
  );

  if (stories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
        <UserRound className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-3 text-sm font-semibold text-foreground">
          Истории не найдены
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Измените фильтры или добавьте первого гостя для эфира, записи или истории.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {stories.map((story) => {
        const bundle = story.bundle_id ? bundlesById.get(story.bundle_id) : null;
        const publication = story.publication_id
          ? publicationsById.get(story.publication_id)
          : null;
        const followUpDue = isContentFactoryGuestFollowUpDue(story);

        return (
          <div
            key={story.id}
            className="rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/20"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{CF_GUEST_STATUS_LABELS[story.status]}</Badge>
                  <Badge variant="outline">{CF_GUEST_ROLE_LABELS[story.role]}</Badge>
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
                  {followUpDue && (
                    <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-700">
                      Нужен follow-up
                    </Badge>
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-foreground">
                    <Link
                      href={`/content-factory/guests/${story.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {story.display_name}
                    </Link>
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {story.story_brief || "Короткое описание пока не заполнено."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5" />
                    {getContentFactoryDisplayName(story.owner_id, members)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatDateTime(story.stage_due_at)}
                  </span>
                  <span>{CF_GUEST_SOURCE_LABELS[story.source]}</span>
                  <span>{CF_GUEST_ANONYMITY_LABELS[story.anonymity_level]}</span>
                </div>

                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {bundle ? (
                    <Link
                      href={`/content-factory/bundles/${bundle.id}`}
                      className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 hover:text-foreground"
                    >
                      <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{bundle.name}</span>
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1">
                      <FolderKanban className="h-3.5 w-3.5" />
                      Без кампании
                    </span>
                  )}
                  {publication ? (
                    <Link
                      href={`/content-factory/publications/${publication.id}`}
                      className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 hover:text-foreground"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{publicationTitle(publication)}</span>
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1">
                      <FileText className="h-3.5 w-3.5" />
                      Без публикации
                    </span>
                  )}
                </div>
              </div>

              <div className="grid shrink-0 gap-2 sm:grid-cols-3 xl:w-[420px]">
                <div className="rounded-md bg-muted/30 px-2 py-1.5">
                  <span className="inline-flex items-center gap-1 text-2xs uppercase text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" />
                    Каналы
                  </span>
                  <span className="mt-1 block truncate text-sm font-medium text-foreground">
                    {story.allowed_channels.length > 0
                      ? story.allowed_channels.join(", ")
                      : "Не указаны"}
                  </span>
                </div>
                <div className="rounded-md bg-muted/30 px-2 py-1.5">
                  <span className="inline-flex items-center gap-1 text-2xs uppercase text-muted-foreground">
                    <Gift className="h-3 w-3" />
                    Подарок
                  </span>
                  <span className="mt-1 block text-sm font-medium text-foreground">
                    {CF_GUEST_GIFT_STATUS_LABELS[story.gift_status]}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-full min-h-12 gap-1.5"
                  onClick={() => onEdit(story)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Изменить
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
