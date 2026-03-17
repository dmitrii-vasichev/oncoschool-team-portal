"use client";

import { useState, useEffect } from "react";
import {
  Play,
  Search,
  Loader2,
  Info,
  FileText,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";
import { AnalysisProgress } from "./AnalysisProgress";
import { AnalysisResult } from "./AnalysisResult";
import type {
  TelegramChannel,
  AnalysisPrompt,
  AnalysisPrepareResponse,
  AnalysisContentType,
  AnalysisRun,
} from "@/lib/types";

export function AnalysisTab() {
  const { toastError } = useToast();

  // Data
  const [channels, setChannels] = useState<TelegramChannel[]>([]);
  const [prompts, setPrompts] = useState<AnalysisPrompt[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [contentType, setContentType] = useState<AnalysisContentType>("all");
  const [promptMode, setPromptMode] = useState<"library" | "custom">("library");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [customPromptText, setCustomPromptText] = useState("");

  // States
  const [prepareSummary, setPrepareSummary] = useState<AnalysisPrepareResponse | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [running, setRunning] = useState(false);
  const [completedRun, setCompletedRun] = useState<AnalysisRun | null>(null);

  // SSE stream
  const stream = useAnalysisStream();

  // Fetch channels and prompts
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ch, pr] = await Promise.all([
          api.getChannels(),
          api.getPrompts(),
        ]);
        setChannels(ch);
        setPrompts(pr);
      } catch {
        toastError("Не удалось загрузить данные");
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [toastError]);

  // Set default dates (last 30 days)
  useEffect(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setDateTo(now.toISOString().split("T")[0]);
    setDateFrom(thirtyDaysAgo.toISOString().split("T")[0]);
  }, []);

  // When stream completes, fetch the result
  useEffect(() => {
    if (stream.phase === "completed" && stream.runId) {
      setRunning(false);
      api
        .getAnalysisResult(stream.runId)
        .then(setCompletedRun)
        .catch(() => {});
    }
    if (stream.phase === "error") {
      setRunning(false);
    }
  }, [stream.phase, stream.runId]);

  const handleChannelToggle = (channelId: string) => {
    setSelectedChannelIds((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
    // Reset prepare summary on change
    setPrepareSummary(null);
  };

  const handlePrepare = async () => {
    if (selectedChannelIds.length === 0) {
      toastError("Выберите хотя бы один канал");
      return;
    }
    setPreparing(true);
    setPrepareSummary(null);
    try {
      const result = await api.prepareAnalysis({
        channel_ids: selectedChannelIds,
        date_from: dateFrom,
        date_to: dateTo,
        content_type: contentType,
      });
      setPrepareSummary(result);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка подготовки");
    } finally {
      setPreparing(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setCompletedRun(null);
    try {
      const result = await api.runAnalysis({
        channel_ids: selectedChannelIds,
        date_from: dateFrom,
        date_to: dateTo,
        content_type: contentType,
        prompt_id: promptMode === "library" && selectedPromptId ? selectedPromptId : null,
        prompt_text: promptMode === "custom" ? customPromptText.trim() : null,
      });
      // Start SSE streaming
      stream.start(result.id);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка запуска");
      setRunning(false);
    }
  };

  const canPrepare = selectedChannelIds.length > 0 && dateFrom && dateTo;
  const canRun =
    prepareSummary &&
    (promptMode === "library" ? selectedPromptId : customPromptText.trim());

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show result if completed
  if (completedRun?.result_markdown) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => {
            setCompletedRun(null);
            setPrepareSummary(null);
          }}
        >
          Новый анализ
        </Button>
        <AnalysisResult
          markdown={completedRun.result_markdown}
          runId={completedRun.id}
        />
      </div>
    );
  }

  // Show progress if running
  if (running || stream.isRunning) {
    return (
      <div className="space-y-4">
        <AnalysisProgress
          phase={stream.phase}
          progress={stream.progress}
          channel={stream.channel}
          chunk={stream.chunk}
          totalChunks={stream.totalChunks}
          error={stream.error}
        />
        {stream.phase === "error" && (
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setRunning(false);
              stream.stop();
            }}
          >
            Попробовать снова
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration form */}
      <div className="space-y-5">
        {/* Channels multi-select */}
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Каналы
          </Label>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Каналы не добавлены. Перейдите на вкладку &quot;Каналы&quot;.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {channels.map((ch) => {
                const selected = selectedChannelIds.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleChannelToggle(ch.id)}
                    className={`
                      px-3 py-1.5 rounded-lg text-sm border transition-all
                      ${
                        selected
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border/60 bg-card text-muted-foreground hover:border-border"
                      }
                    `}
                  >
                    {ch.display_name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              От
            </Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPrepareSummary(null);
              }}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              До
            </Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPrepareSummary(null);
              }}
              className="rounded-xl"
            />
          </div>
        </div>

        {/* Content type */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Тип контента
          </Label>
          <div className="flex gap-2">
            {(["all", "posts", "comments"] as AnalysisContentType[]).map(
              (type) => (
                <button
                  key={type}
                  onClick={() => {
                    setContentType(type);
                    setPrepareSummary(null);
                  }}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm border transition-all
                    ${
                      contentType === type
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border/60 bg-card text-muted-foreground hover:border-border"
                    }
                  `}
                >
                  {{ all: "Всё", posts: "Посты", comments: "Комментарии" }[type]}
                </button>
              )
            )}
          </div>
        </div>

        {/* Prompt selection */}
        <div className="space-y-3">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Промпт
          </Label>
          <div className="flex gap-2">
            <Button
              variant={promptMode === "library" ? "default" : "outline"}
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => setPromptMode("library")}
            >
              <FileText className="h-3.5 w-3.5" />
              Из библиотеки
            </Button>
            <Button
              variant={promptMode === "custom" ? "default" : "outline"}
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={() => setPromptMode("custom")}
            >
              Свой промпт
            </Button>
          </div>

          {promptMode === "library" ? (
            prompts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Промптов нет. Создайте на вкладке &quot;Промпты&quot;.
              </p>
            ) : (
              <Select
                value={selectedPromptId}
                onValueChange={setSelectedPromptId}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Выберите промпт" />
                </SelectTrigger>
                <SelectContent>
                  {prompts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {p.title}
                        {p.description && (
                          <span className="text-muted-foreground text-xs truncate max-w-[200px]">
                            — {p.description}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          ) : (
            <Textarea
              placeholder="Инструкция для AI-анализа..."
              value={customPromptText}
              onChange={(e) => setCustomPromptText(e.target.value)}
              className="rounded-xl min-h-[120px] font-mono text-sm"
            />
          )}
        </div>

        {/* Prepare button */}
        <Button
          className="w-full rounded-xl gap-2"
          variant="outline"
          onClick={handlePrepare}
          disabled={preparing || !canPrepare}
        >
          {preparing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Подготовка...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Подготовить анализ
            </>
          )}
        </Button>
      </div>

      {/* Prepare summary */}
      {prepareSummary && (
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Сводка
          </h3>

          {/* Per-channel breakdown */}
          <div className="space-y-2">
            {prepareSummary.channels.map((ch) => (
              <div
                key={ch.channel_id}
                className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2"
              >
                <span className="font-medium">{ch.channel_name}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>В базе: {ch.existing_count}</span>
                  {ch.estimated_missing !== null && ch.estimated_missing > 0 && (
                    <Badge variant="outline" className="text-xs">
                      загрузить ~{ch.estimated_missing}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Всего в базе: {prepareSummary.total_existing}</span>
            {prepareSummary.total_estimated_missing !== null &&
              prepareSummary.total_estimated_missing > 0 && (
                <span>К загрузке: ~{prepareSummary.total_estimated_missing}</span>
              )}
            {!prepareSummary.telegram_connected &&
              prepareSummary.total_estimated_missing !== null &&
              prepareSummary.total_estimated_missing > 0 && (
                <Badge variant="destructive" className="text-xs">
                  Telegram не подключён
                </Badge>
              )}
          </div>

          {/* Run button */}
          <Button
            className="w-full rounded-xl gap-2"
            onClick={handleRun}
            disabled={!canRun}
          >
            <Play className="h-4 w-4" />
            Запустить анализ
          </Button>
        </div>
      )}
    </div>
  );
}
