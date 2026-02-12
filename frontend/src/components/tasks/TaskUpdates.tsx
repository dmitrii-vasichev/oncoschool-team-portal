"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MessageSquare,
  ArrowRightLeft,
  AlertOctagon,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { api } from "@/lib/api";
import type { TaskUpdate, TaskStatus } from "@/lib/types";

const UPDATE_TYPE_CONFIG: Record<
  string,
  { icon: typeof MessageSquare; label: string; color: string }
> = {
  progress: {
    icon: TrendingUp,
    label: "Прогресс",
    color: "text-blue-600",
  },
  status_change: {
    icon: ArrowRightLeft,
    label: "Смена статуса",
    color: "text-yellow-600",
  },
  comment: {
    icon: MessageSquare,
    label: "Комментарий",
    color: "text-gray-600",
  },
  blocker: {
    icon: AlertOctagon,
    label: "Блокер",
    color: "text-red-600",
  },
  completion: {
    icon: CheckCircle2,
    label: "Завершение",
    color: "text-green-600",
  },
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskUpdates({ shortId }: { shortId: number }) {
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUpdates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTaskUpdates(shortId);
      setUpdates(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [shortId]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Пока нет обновлений
      </p>
    );
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

      {updates.map((update) => {
        const config = UPDATE_TYPE_CONFIG[update.update_type] || UPDATE_TYPE_CONFIG.comment;
        const Icon = config.icon;

        return (
          <div key={update.id} className="relative pl-12 pb-6 last:pb-0">
            <div
              className={`absolute left-3 top-1 rounded-full bg-background border-2 p-1 ${config.color}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                {update.author && (
                  <div className="flex items-center gap-1">
                    <UserAvatar name={update.author.full_name} size="sm" />
                    <span className="text-sm font-medium">
                      {update.author.full_name}
                    </span>
                  </div>
                )}
                <Badge variant="outline" className="text-xs">
                  {config.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(update.created_at)}
                </span>
                {update.source === "web" && (
                  <Badge variant="secondary" className="text-xs">
                    web
                  </Badge>
                )}
              </div>

              {update.update_type === "status_change" &&
                update.old_status &&
                update.new_status && (
                  <div className="flex items-center gap-2 text-sm">
                    <StatusBadge status={update.old_status as TaskStatus} />
                    <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                    <StatusBadge status={update.new_status as TaskStatus} />
                  </div>
                )}

              <p className="text-sm whitespace-pre-wrap">{update.content}</p>

              {update.progress_percent !== null &&
                update.progress_percent !== undefined && (
                  <div className="flex items-center gap-2 mt-1">
                    <Progress
                      value={update.progress_percent}
                      className="h-2 flex-1 max-w-48"
                    />
                    <span className="text-xs text-muted-foreground font-medium">
                      {update.progress_percent}%
                    </span>
                  </div>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
