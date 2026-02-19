"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Video,
  ExternalLink,
  Copy,
  Check,
  PlayCircle,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock3,
  CircleCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Meeting, ZoomStatusResponse } from "@/lib/types";

interface ZoomBlockProps {
  meeting: Meeting;
  isModerator: boolean;
  onCreateZoom?: () => Promise<void>;
}

export function ZoomBlock({ meeting }: ZoomBlockProps) {
  const [copied, setCopied] = useState(false);
  const [zoomStatus, setZoomStatus] = useState<ZoomStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const refreshZoomStatus = useCallback(
    async (silent = true) => {
      if (!meeting.zoom_meeting_id) return;
      if (!silent) setStatusLoading(true);
      try {
        const status = await api.getZoomStatus(meeting.id);
        setZoomStatus(status);
      } catch {
        // Keep silent; status can be unavailable temporarily.
      } finally {
        if (!silent) setStatusLoading(false);
      }
    },
    [meeting.id, meeting.zoom_meeting_id]
  );

  useEffect(() => {
    if (!meeting.zoom_meeting_id) return;

    void refreshZoomStatus(true);
    const intervalId = window.setInterval(() => {
      void refreshZoomStatus(true);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [meeting.zoom_meeting_id, refreshZoomStatus]);

  const handleCopyId = async () => {
    if (!meeting.zoom_meeting_id) return;
    await navigator.clipboard.writeText(meeting.zoom_meeting_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const recordingUrl = meeting.zoom_recording_url || zoomStatus?.recording_url || null;

  const renderZoomStatus = () => {
    if (!meeting.zoom_meeting_id) return null;

    if (statusLoading && !zoomStatus) {
      return (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Проверяем статус Zoom...
        </div>
      );
    }

    if (!zoomStatus) {
      return (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Статус Zoom пока недоступен
        </div>
      );
    }

    if (!zoomStatus.zoom_configured) {
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Zoom не настроен на сервере
        </div>
      );
    }

    if (zoomStatus.has_transcript) {
      return (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 shrink-0" />
          Транскрипт уже доступен в Zoom
        </div>
      );
    }

    if (zoomStatus.has_recording) {
      return (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          Запись есть, транскрипт обрабатывается
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-800 dark:text-blue-400 flex items-center gap-1.5">
        <Clock3 className="h-3.5 w-3.5 shrink-0" />
        Запись ещё не появилась в Zoom
      </div>
    );
  };

  if (
    !meeting.zoom_join_url &&
    !meeting.zoom_meeting_id &&
    !meeting.zoom_recording_url
  ) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center">
          <Video className="h-4.5 w-4.5 text-muted-foreground/40" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Zoom не подключён</p>
          <p className="text-xs text-muted-foreground/60">
            Встреча создана без Zoom-конференции
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Video className="h-4 w-4 text-blue-600" />
          </div>
          <span className="text-sm font-heading font-semibold">Zoom</span>
        </div>
        {meeting.zoom_meeting_id && (
          <button
            onClick={() => void refreshZoomStatus(false)}
            disabled={statusLoading}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Проверить статус Zoom"
          >
            {statusLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {renderZoomStatus()}

      <div className="flex items-center gap-2 flex-wrap">
        {/* Join link */}
        {meeting.zoom_join_url && meeting.status !== "completed" && (
          <a
            href={meeting.zoom_join_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-500/10 rounded-xl px-3 py-2 hover:bg-blue-500/15 transition-colors"
          >
            <Video className="h-3.5 w-3.5" />
            Подключиться
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {/* Recording link */}
        {recordingUrl && (
          <a
            href={recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-500/10 rounded-xl px-3 py-2 hover:bg-emerald-500/15 transition-colors"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Запись
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {/* Meeting ID */}
        {meeting.zoom_meeting_id && (
          <button
            onClick={handleCopyId}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5 hover:bg-muted/60 transition-colors"
          >
            <span className="font-mono">ID: {meeting.zoom_meeting_id}</span>
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
