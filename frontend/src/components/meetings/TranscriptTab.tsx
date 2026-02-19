"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Copy,
  Check,
  Loader2,
  Download,
  Bot,
  Upload,
  RefreshCw,
  CircleCheck,
  AlertCircle,
  Clock3,
  Video,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { Meeting, ZoomStatusResponse } from "@/lib/types";

interface TranscriptTabProps {
  meeting: Meeting;
  isModerator: boolean;
  onMeetingUpdate: (meeting: Meeting) => void;
  onSwitchToSummary: () => void;
}

export function TranscriptTab({
  meeting,
  isModerator,
  onMeetingUpdate,
  onSwitchToSummary,
}: TranscriptTabProps) {
  const { toastSuccess, toastError } = useToast();
  const [manualText, setManualText] = useState("");
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
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
      } catch (e) {
        if (!silent) {
          toastError(e instanceof Error ? e.message : "Ошибка проверки Zoom");
        }
      } finally {
        if (!silent) setStatusLoading(false);
      }
    },
    [meeting.id, meeting.zoom_meeting_id, toastError]
  );

  useEffect(() => {
    if (!meeting.zoom_meeting_id || meeting.transcript) return;

    void refreshZoomStatus(true);
    const intervalId = window.setInterval(() => {
      void refreshZoomStatus(true);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [meeting.zoom_meeting_id, meeting.transcript, refreshZoomStatus]);

  useEffect(() => {
    if (!isModerator || !meeting.zoom_meeting_id || meeting.transcript) return;
    if (meeting.effective_status !== "completed" && meeting.status !== "completed") {
      return;
    }

    let cancelled = false;

    const tryAutoFetch = async () => {
      try {
        const result = await api.fetchZoomTranscript(meeting.id);
        if (!result.transcript || cancelled) return;

        const updated = await api.getMeeting(meeting.id);
        if (cancelled) return;
        onMeetingUpdate(updated);
        toastSuccess("Транскрипция получена из Zoom автоматически");
        void refreshZoomStatus(true);
      } catch {
        // Keep silent; manual button remains available.
      }
    };

    void tryAutoFetch();
    const intervalId = window.setInterval(() => {
      void tryAutoFetch();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    isModerator,
    meeting.id,
    meeting.zoom_meeting_id,
    meeting.transcript,
    meeting.status,
    meeting.effective_status,
    onMeetingUpdate,
    refreshZoomStatus,
    toastSuccess,
  ]);

  // ── Copy transcript ──
  const handleCopy = async () => {
    if (!meeting.transcript) return;
    await navigator.clipboard.writeText(meeting.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Save manual transcript ──
  const handleSaveManual = async () => {
    if (!manualText.trim()) return;
    setSaving(true);
    try {
      const updated = await api.addTranscript(meeting.id, manualText.trim());
      onMeetingUpdate(updated);
      setManualText("");
      toastSuccess("Транскрипция сохранена");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  // ── Fetch from Zoom API ──
  const handleFetchZoom = async () => {
    setFetching(true);
    try {
      const result = await api.fetchZoomTranscript(meeting.id);
      if (result.transcript) {
        // Refetch the meeting to get updated data
        const updated = await api.getMeeting(meeting.id);
        onMeetingUpdate(updated);
        toastSuccess("Транскрипция получена из Zoom");
      } else {
        toastError(result.message || "Транскрипция недоступна в Zoom");
      }
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка получения");
    } finally {
      setFetching(false);
      void refreshZoomStatus(true);
    }
  };

  const renderZoomStatus = () => {
    if (!meeting.zoom_meeting_id || meeting.transcript) return null;

    if (statusLoading && !zoomStatus) {
      return (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Проверяем состояние Zoom...
        </div>
      );
    }

    if (!zoomStatus) {
      return (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Статус Zoom пока недоступен
        </div>
      );
    }

    if (!zoomStatus.zoom_configured) {
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Интеграция Zoom не настроена на сервере
        </div>
      );
    }

    if (zoomStatus.has_transcript) {
      return (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 space-y-2">
          <div className="flex items-center gap-2">
            <CircleCheck className="h-4 w-4 shrink-0" />
            Транскрипт уже доступен в Zoom
          </div>
          {zoomStatus.recording_url && (
            <a
              href={zoomStatus.recording_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-2"
            >
              <Video className="h-3.5 w-3.5" />
              Открыть запись Zoom
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      );
    }

    if (zoomStatus.has_recording) {
      return (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-400 space-y-2">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 shrink-0" />
            Запись готова, Zoom ещё формирует транскрипт
          </div>
          {zoomStatus.recording_url && (
            <a
              href={zoomStatus.recording_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-2"
            >
              <Video className="h-3.5 w-3.5" />
              Открыть запись Zoom
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-800 dark:text-blue-400 flex items-center gap-2">
        <Clock3 className="h-4 w-4 shrink-0" />
        Запись встречи ещё не появилась в Zoom
      </div>
    );
  };

  // ── State A: Transcript exists ──
  if (meeting.transcript) {
    return (
      <div className="space-y-4">
        {/* Header with source + actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="rounded-lg text-2xs gap-1 font-medium"
            >
              {meeting.transcript_source === "zoom_api" ? (
                <>
                  <Download className="h-3 w-3" />
                  Zoom API
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3" />
                  Вставлено вручную
                </>
              )}
            </Badge>
            <span className="text-2xs text-muted-foreground/50 tabular-nums">
              {meeting.transcript.length.toLocaleString("ru-RU")} символов
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-xs gap-1.5 rounded-lg"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Скопировано
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Копировать
                </>
              )}
            </Button>
            {isModerator && (
              <Button
                variant="default"
                size="sm"
                onClick={onSwitchToSummary}
                className="h-7 text-xs gap-1.5 rounded-lg bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Bot className="h-3.5 w-3.5" />
                Распознать AI
              </Button>
            )}
          </div>
        </div>

        {/* Scrollable transcript with line numbers */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto p-5">
            <div className="font-mono text-sm leading-relaxed">
              {meeting.transcript.split("\n").map((line, i) => (
                <div
                  key={i}
                  className="flex gap-4 hover:bg-muted/30 -mx-2 px-2 rounded"
                >
                  <span className="select-none text-muted-foreground/40 text-right min-w-[2.5rem] text-xs leading-relaxed tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground whitespace-pre-wrap break-all">
                    {line || "\u00A0"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── State B: No transcript but has Zoom ID ──
  if (meeting.zoom_meeting_id) {
    return (
      <div className="space-y-5">
        {renderZoomStatus()}

        {/* Zoom fetch section */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
            <Download className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-heading font-semibold">
              Получить транскрипцию из Zoom
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              После завершения встречи и обработки облачной записи в Zoom
              транскрипция подтянется автоматически
            </p>
          </div>
          {isModerator && (
            <div className="flex items-center justify-center gap-2">
              <Button
                onClick={handleFetchZoom}
                disabled={fetching}
                className="rounded-xl gap-2"
              >
                {fetching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Попробовать получить
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => void refreshZoomStatus(false)}
                disabled={statusLoading}
                className="rounded-xl gap-2"
              >
                {statusLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Проверить статус Zoom
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Manual fallback */}
        {isModerator && (
          <ManualTranscriptInput
            value={manualText}
            onChange={setManualText}
            onSave={handleSaveManual}
            saving={saving}
          />
        )}
      </div>
    );
  }

  // ── State C: No transcript, no Zoom ──
  if (!isModerator) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
          <FileText className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground">
          Транскрипция пока не добавлена
        </p>
      </div>
    );
  }

  return (
    <ManualTranscriptInput
      value={manualText}
      onChange={setManualText}
      onSave={handleSaveManual}
      saving={saving}
    />
  );
}

// ── Manual transcript textarea ──
function ManualTranscriptInput({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-heading font-semibold">
          Вставить вручную
        </span>
      </div>
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            "Вставьте текст Zoom AI Summary или транскрипцию...\n\nПоддерживаются форматы:\n— Summary Overview\n— Action Items\n— Decisions & Notes"
          }
          rows={10}
          className="font-mono text-sm rounded-xl border-border/60 bg-background/50 resize-none focus:bg-background placeholder:text-muted-foreground/40"
        />
        {value && (
          <div className="absolute bottom-3 right-3 text-2xs text-muted-foreground/50 tabular-nums">
            {value.length.toLocaleString("ru-RU")} символов
          </div>
        )}
      </div>
      <Button
        onClick={onSave}
        disabled={!value.trim() || saving}
        className="w-full h-11 rounded-xl gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Сохранение...
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            Сохранить транскрипцию
          </>
        )}
      </Button>
    </div>
  );
}
