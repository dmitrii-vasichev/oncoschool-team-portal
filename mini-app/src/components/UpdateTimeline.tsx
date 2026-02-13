"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TaskUpdate, UpdateType } from "@/lib/types";

const TYPE_ICONS: Record<UpdateType, string> = {
  progress: "📊",
  status_change: "🔄",
  comment: "📝",
  blocker: "🚫",
  completion: "✅",
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month} ${hours}:${minutes}`;
}

interface UpdateTimelineProps {
  shortId: number;
}

export function UpdateTimeline({ shortId }: UpdateTimelineProps) {
  const { data: updates } = useQuery<TaskUpdate[]>({
    queryKey: ["task-updates", shortId],
    queryFn: () => api.getTaskUpdates(shortId),
    enabled: !!shortId,
  });

  const sorted = updates
    ? [...updates].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    : [];

  return (
    <div>
      <div className="px-4 mt-4 mb-2">
        <span className="text-sm font-semibold text-tg-section-header uppercase tracking-wide">
          Обновления
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-tg-hint text-sm py-6 text-center">
          Пока нет обновлений
        </p>
      ) : (
        <div>
          {sorted.map((update) => (
            <UpdateItem key={update.id} update={update} />
          ))}
        </div>
      )}
    </div>
  );
}

function UpdateItem({ update }: { update: TaskUpdate }) {
  const icon = TYPE_ICONS[update.update_type] || "📝";

  return (
    <div className="px-4 py-3 border-b border-tg-separator last:border-0">
      <div className="flex items-center">
        <span className="font-medium text-sm text-tg-text">
          {update.author?.full_name || "—"}
        </span>
        <span className="text-xs text-tg-hint ml-auto">
          {formatDateTime(update.created_at)}
        </span>
      </div>

      <div className="text-sm text-tg-text mt-1 flex items-start gap-1.5">
        <span className="flex-shrink-0">{icon}</span>
        <span>{update.content}</span>
      </div>

      {update.update_type === "status_change" &&
        update.old_status &&
        update.new_status && (
          <div className="text-xs text-tg-hint mt-0.5 ml-6">
            {update.old_status} → {update.new_status}
          </div>
        )}

      {update.progress_percent != null && (
        <div className="ml-6 mt-1">
          <div className="w-full h-1.5 bg-tg-secondary-bg rounded-full">
            <div
              className="h-full bg-tg-button rounded-full"
              style={{ width: `${update.progress_percent}%` }}
            />
          </div>
          <span className="text-xs text-tg-hint mt-0.5">
            {update.progress_percent}%
          </span>
        </div>
      )}
    </div>
  );
}
