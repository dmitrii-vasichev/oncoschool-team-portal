"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  CalendarClock,
  FileText,
  FolderKanban,
  Gift,
  Link2,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CF_GUEST_ANONYMITY_LABELS,
  CF_GUEST_CONSENT_STATUS_LABELS,
  CF_GUEST_GIFT_STATUS_LABELS,
  CF_GUEST_ROLE_LABELS,
  CF_GUEST_SOURCE_LABELS,
  CF_GUEST_STATUS_LABELS,
  getContentFactoryDisplayName,
  isContentFactoryGuestFollowUpDue,
  isContentFactoryGuestStoryActive,
} from "@/lib/contentFactoryUtils";
import type {
  CFBundle,
  CFGuestStory,
  CFNosology,
  CFPublication,
  TeamMember,
} from "@/lib/types";

type ContentFactoryGuestStoryDetailPanelsProps = {
  story: CFGuestStory;
  members: TeamMember[];
  bundles: CFBundle[];
  publications: CFPublication[];
  nosologies: CFNosology[];
};

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

function publicationTitle(publication: CFPublication): string {
  return publication.title?.trim() || `Публикация ${publication.id.slice(0, 8)}`;
}

function DetailCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-3 py-3 shadow-sm">
      <span className="block text-2xs uppercase text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block text-sm font-semibold text-foreground">
        {value}
      </span>
      {helper && (
        <span className="mt-1 block text-xs text-muted-foreground">{helper}</span>
      )}
    </div>
  );
}

function TextBlock({ title, value }: { title: string; value?: string | null }) {
  const cleanValue = value?.trim();
  return (
    <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {cleanValue || "Пока не заполнено."}
      </p>
    </section>
  );
}

function ListBlock({ title, values }: { title: string; values: string[] }) {
  return (
    <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {values.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6 text-muted-foreground">
          {values.map((value, index) => (
            <li key={`${value}-${index}`}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Пока не заполнено.
        </p>
      )}
    </section>
  );
}

function SideRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md bg-muted/30 px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-2xs uppercase text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="mt-1 text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

export function ContentFactoryGuestStoryDetailPanels({
  story,
  members,
  bundles,
  publications,
  nosologies,
}: ContentFactoryGuestStoryDetailPanelsProps) {
  const bundle = story.bundle_id
    ? bundles.find((item) => item.id === story.bundle_id)
    : null;
  const publication = story.publication_id
    ? publications.find((item) => item.id === story.publication_id)
    : null;
  const nosology = story.nosology_id
    ? nosologies.find((item) => item.id === story.nosology_id)
    : null;
  const ownerName = getContentFactoryDisplayName(story.owner_id, members);
  const followUpDue = isContentFactoryGuestFollowUpDue(story);
  const active = isContentFactoryGuestStoryActive(story);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <DetailCard
          label="Этап"
          value={CF_GUEST_STATUS_LABELS[story.status]}
          helper={active ? "История в работе" : "Закрытый или отложенный этап"}
        />
        <DetailCard
          label="Следующий шаг"
          value={formatDateTime(story.stage_due_at)}
          helper={story.stage_due_at ? "Дата этапа" : "Срок не указан"}
        />
        <DetailCard
          label="Согласие"
          value={CF_GUEST_CONSENT_STATUS_LABELS[story.consent_status]}
          helper={story.consent_version || "Версия не указана"}
        />
        <DetailCard
          label="Публичность"
          value={CF_GUEST_ANONYMITY_LABELS[story.anonymity_level]}
          helper="Граница раскрытия личности"
        />
        <DetailCard
          label="Подарок и follow-up"
          value={CF_GUEST_GIFT_STATUS_LABELS[story.gift_status]}
          helper={followUpDue ? "Пора вернуться к гостю" : "Без срочного follow-up"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{CF_GUEST_STATUS_LABELS[story.status]}</Badge>
              <Badge variant="outline">{CF_GUEST_ROLE_LABELS[story.role]}</Badge>
              <Badge variant="outline">{CF_GUEST_SOURCE_LABELS[story.source]}</Badge>
              {followUpDue && (
                <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-700">
                  Нужен follow-up
                </Badge>
              )}
            </div>
            <h2 className="mt-3 text-sm font-semibold text-foreground">
              История
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {story.story_brief?.trim() || "Короткое описание пока не заполнено."}
            </p>
          </section>

          <TextBlock title="Откуда пришёл кандидат" value={story.source_notes} />
          <TextBlock title="Заметки отбора" value={story.screening_notes} />
          <TextBlock
            title="Фактчек и медицинские границы"
            value={story.medical_factcheck_notes}
          />
          <TextBlock
            title="Причина отказа или паузы"
            value={story.rejection_reason}
          />
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">
              Кто отвечает
            </h2>
            <div className="mt-3 space-y-2">
              <SideRow
                icon={<UserRound className="h-3.5 w-3.5" />}
                label="Ответственный"
              >
                {ownerName}
              </SideRow>
              <SideRow
                icon={<Link2 className="h-3.5 w-3.5" />}
                label="Контакт"
              >
                {story.contact_ref?.trim() || "Не указан"}
              </SideRow>
              <SideRow
                icon={<CalendarClock className="h-3.5 w-3.5" />}
                label="Создано"
              >
                {formatDateTime(story.created_at)}
              </SideRow>
            </div>
          </section>

          <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">
              Согласие и границы
            </h2>
            <div className="mt-3 space-y-2">
              <SideRow
                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                label="Дата подписи"
              >
                {formatDateTime(story.consent_signed_at)}
              </SideRow>
              <SideRow
                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                label="Версия"
              >
                {story.consent_version?.trim() || "Не указана"}
              </SideRow>
            </div>
          </section>

          <ListBlock title="Разрешённые каналы" values={story.allowed_channels} />
          <ListBlock title="Границы и чувствительные темы" values={story.sensitive_topics} />
          <TextBlock title="Юридические заметки" value={story.legal_notes} />

          <section className="rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Связи</h2>
            <div className="mt-3 space-y-2">
              <SideRow
                icon={<FolderKanban className="h-3.5 w-3.5" />}
                label="Кампания"
              >
                {bundle ? (
                  <Link
                    href={`/content-factory/bundles/${bundle.id}`}
                    className="text-primary hover:underline"
                  >
                    {bundle.name}
                  </Link>
                ) : (
                  "Без кампании"
                )}
              </SideRow>
              <SideRow
                icon={<FileText className="h-3.5 w-3.5" />}
                label="Публикация"
              >
                {publication ? (
                  <Link
                    href={`/content-factory/publications/${publication.id}`}
                    className="text-primary hover:underline"
                  >
                    {publicationTitle(publication)}
                  </Link>
                ) : (
                  "Без публикации"
                )}
              </SideRow>
              <SideRow
                icon={<Stethoscope className="h-3.5 w-3.5" />}
                label="Нозология"
              >
                {nosology?.display_name ?? "Не указана"}
              </SideRow>
              <SideRow icon={<Gift className="h-3.5 w-3.5" />} label="Follow-up">
                {formatDateTime(story.follow_up_due_at)}
              </SideRow>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
