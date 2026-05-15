"use client";

import { History } from "lucide-react";
import type { CFApprovalEvent, CFPublicationVersion, TeamMember } from "@/lib/types";

const APPROVAL_EVENT_LABELS: Record<CFApprovalEvent, string> = {
  drafted: "Черновик",
  reviewed: "Проверено",
  factchecked: "Фактчек пройден",
  doctor_approved: "Одобрено врачом",
  scheduled: "Запланировано",
  published: "Опубликовано",
  rolled_back: "Откат версии",
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата неизвестна";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function bodyPreview(value: string | null): string {
  const text = value?.trim();
  if (!text) return "Без текста";
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

export function ContentFactoryPublicationVersionList({
  versions,
  members,
}: {
  versions: CFPublicationVersion[];
  members: TeamMember[];
}) {
  const memberNames = new Map(members.map((member) => [member.id, member.full_name]));

  return (
    <section className="rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="flex items-start gap-2 border-b border-border/60 px-4 py-3">
        <History className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            История публикации
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Версии текста и переходы по workflow.
          </p>
        </div>
      </div>

      {versions.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Истории публикации пока нет
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {versions.map((version) => (
            <article key={version.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Версия {version.version_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {memberNames.get(version.edited_by_id) ?? "Редактор"} ·{" "}
                    {formatDateTime(version.edited_at)}
                  </p>
                </div>
                <span className="rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                  {APPROVAL_EVENT_LABELS[version.approval_event]}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {bodyPreview(version.body_text)}
              </p>
              {version.notes && (
                <p className="rounded-md bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
                  {version.notes}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
