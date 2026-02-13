"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Bot,
  Loader2,
  CheckCircle2,
  ListChecks,
  Users,
  Trash2,
  Plus,
  Sparkles,
  ArrowLeft,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { DatePicker } from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type {
  Meeting,
  ParseSummaryResponse,
  ParsedTask,
  AISettingsResponse,
  TaskPriority,
} from "@/lib/types";

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent:
    "bg-priority-urgent-bg text-priority-urgent-fg border-priority-urgent-fg/20",
  high: "bg-priority-high-bg text-priority-high-fg border-priority-high-fg/20",
  medium:
    "bg-priority-medium-bg text-priority-medium-fg border-priority-medium-fg/20",
  low: "bg-priority-low-bg text-priority-low-fg border-priority-low-fg/20",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Сроч",
  high: "Выс",
  medium: "Сред",
  low: "Низ",
};

type ViewState = "display" | "parsing" | "preview";

interface SummaryTabProps {
  meeting: Meeting;
  isModerator: boolean;
  onMeetingUpdate: (meeting: Meeting) => void;
  onTasksCreated: () => void;
  onSwitchToTranscript: () => void;
}

export function SummaryTab({
  meeting,
  isModerator,
  onMeetingUpdate,
  onTasksCreated,
  onSwitchToTranscript,
}: SummaryTabProps) {
  const { toastSuccess, toastError } = useToast();
  const [viewState, setViewState] = useState<ViewState>("display");
  const [aiSettings, setAiSettings] = useState<AISettingsResponse | null>(null);

  // Parse result state
  const [parsed, setParsed] = useState<ParseSummaryResponse | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editDecisions, setEditDecisions] = useState<string[]>([]);
  const [editTasks, setEditTasks] = useState<ParsedTask[]>([]);
  const [editParticipants, setEditParticipants] = useState<string[]>([]);

  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAiSettings()
      .then(setAiSettings)
      .catch(() => {});
  }, []);

  // ── Parse via AI ──
  const handleParse = async () => {
    setViewState("parsing");
    setError(null);
    try {
      const result = await api.parseMeetingSummary(meeting.id);
      setParsed(result);
      setEditTitle(result.title);
      setEditSummary(result.summary);
      setEditDecisions([...result.decisions]);
      setEditTasks(result.tasks.map((t) => ({ ...t })));
      setEditParticipants([...result.participants]);
      setViewState("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка парсинга");
      setViewState("display");
    }
  };

  // ── Apply summary ──
  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const result = await api.applySummary(meeting.id, {
        raw_summary: meeting.transcript || "",
        title: editTitle,
        parsed_summary: editSummary,
        decisions: editDecisions,
        participants: editParticipants,
        tasks: editTasks,
      });
      onMeetingUpdate(result.meeting);
      onTasksCreated();
      setViewState("display");
      toastSuccess(
        `Резюме сохранено, создано ${result.tasks_created} задач`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка применения";
      setError(msg);
      toastError(msg);
    } finally {
      setApplying(false);
    }
  };

  // Task helpers
  const updateTask = (
    index: number,
    field: keyof ParsedTask,
    value: string | null
  ) => {
    setEditTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  };

  const removeTask = (index: number) => {
    setEditTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const addTask = () => {
    setEditTasks((prev) => [
      ...prev,
      {
        title: "",
        description: null,
        assignee_name: null,
        priority: "medium" as TaskPriority,
        deadline: null,
      },
    ]);
  };

  const removeDecision = (index: number) => {
    setEditDecisions((prev) => prev.filter((_, i) => i !== index));
  };

  // ── State A: Summary exists (display mode) ──
  if (viewState === "display" && meeting.parsed_summary) {
    return (
      <div className="space-y-5">
        {/* Summary card */}
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Краткое резюме
          </h3>
          <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
            {meeting.parsed_summary}
          </p>
        </div>

        {/* Decisions */}
        {meeting.decisions && meeting.decisions.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-status-done-fg" />
              Решения
            </h3>
            <ul className="space-y-3">
              {meeting.decisions.map((decision, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 animate-fade-in-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <span className="flex-shrink-0 h-6 w-6 rounded-lg bg-status-done-bg text-status-done-fg flex items-center justify-center text-xs font-semibold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-foreground leading-relaxed pt-0.5">
                    {decision}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Re-parse button */}
        {isModerator && meeting.transcript && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleParse}
              className="rounded-xl gap-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Перепарсить
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── State: Parsing in progress ──
  if (viewState === "parsing") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4 animate-pulse">
          <Bot className="h-7 w-7 text-accent" />
        </div>
        <h3 className="text-sm font-heading font-semibold mb-1">
          Обработка через AI
        </h3>
        <p className="text-xs text-muted-foreground">
          {aiSettings
            ? `${aiSettings.current_provider} · ${aiSettings.current_model}`
            : "Подождите..."}
        </p>
        <Loader2 className="h-5 w-5 animate-spin text-primary mt-4" />
      </div>
    );
  }

  // ── State: Preview (editable parsed result) ──
  if (viewState === "preview" && parsed) {
    return (
      <div className="space-y-5">
        {/* Back + badge */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewState("display")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Назад
          </button>
          <Badge variant="secondary" className="gap-1.5 rounded-lg">
            <Sparkles className="h-3 w-3 text-primary" />
            AI результат
          </Badge>
        </div>

        {/* Title + Summary editable */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Название встречи
            </Label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="mt-2 h-11 text-base font-heading font-semibold rounded-xl border-border/60"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Краткое резюме
            </Label>
            <Textarea
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              rows={3}
              className="mt-2 rounded-xl border-border/60 text-sm"
            />
          </div>
        </div>

        {/* Participants */}
        {editParticipants.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Участники
              </span>
              <span className="text-2xs text-muted-foreground/60 ml-auto">
                {editParticipants.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {editParticipants.map((name, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/60 text-sm"
                >
                  <UserAvatar name={name} size="sm" />
                  <span className="text-foreground font-medium">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Decisions */}
        {editDecisions.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-status-done-fg" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Решения
              </span>
              <span className="text-2xs text-muted-foreground/60 ml-auto">
                {editDecisions.length}
              </span>
            </div>
            <div className="space-y-2">
              {editDecisions.map((decision, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <span className="flex-shrink-0 h-6 w-6 rounded-lg bg-status-done-bg text-status-done-fg flex items-center justify-center text-xs font-semibold">
                    {i + 1}
                  </span>
                  <Input
                    value={decision}
                    onChange={(e) => {
                      const updated = [...editDecisions];
                      updated[i] = e.target.value;
                      setEditDecisions(updated);
                    }}
                    className="flex-1 h-9 rounded-lg border-border/40 text-sm"
                  />
                  <button
                    onClick={() => removeDecision(i)}
                    className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Задачи
              </span>
              <span className="text-2xs text-muted-foreground/60">
                {editTasks.length}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addTask}
              className="h-8 text-xs gap-1.5 rounded-lg"
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить
            </Button>
          </div>

          {editTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mb-2">
                <ListChecks className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">
                Задачи не найдены в тексте
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={addTask}
                className="mt-2 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Добавить вручную
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {editTasks.map((task, i) => (
                <div
                  key={i}
                  className="group relative rounded-xl border border-border/50 bg-background/50 p-4 space-y-3 hover:border-border animate-fade-in-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xs font-mono text-muted-foreground/60 bg-muted/40 rounded px-1.5 py-0.5">
                      #{i + 1}
                    </span>
                    <button
                      onClick={() => removeTask(i)}
                      className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <Input
                    value={task.title}
                    onChange={(e) => updateTask(i, "title", e.target.value)}
                    placeholder="Название задачи"
                    className="h-10 font-medium rounded-lg border-border/40"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-2xs text-muted-foreground/70 uppercase tracking-wider">
                        Приоритет
                      </Label>
                      <div className="flex gap-1 mt-1.5">
                        {(
                          ["low", "medium", "high", "urgent"] as TaskPriority[]
                        ).map((p) => (
                          <button
                            key={p}
                            onClick={() => updateTask(i, "priority", p)}
                            className={`
                              flex-1 h-8 rounded-lg text-2xs font-semibold border transition-colors
                              ${
                                task.priority === p
                                  ? PRIORITY_COLORS[p]
                                  : "border-border/40 text-muted-foreground/50 hover:border-border"
                              }
                            `}
                          >
                            {PRIORITY_LABELS[p]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-2xs text-muted-foreground/70 uppercase tracking-wider">
                        Исполнитель
                      </Label>
                      <Input
                        value={task.assignee_name || ""}
                        onChange={(e) =>
                          updateTask(
                            i,
                            "assignee_name",
                            e.target.value || null
                          )
                        }
                        placeholder="Имя"
                        className="mt-1.5 h-8 text-sm rounded-lg border-border/40"
                      />
                    </div>

                    <div>
                      <Label className="text-2xs text-muted-foreground/70 uppercase tracking-wider">
                        Дедлайн
                      </Label>
                      <DatePicker
                        value={task.deadline || ""}
                        onChange={(v) => updateTask(i, "deadline", v || null)}
                        placeholder="Дата"
                        clearable
                        className="w-full mt-1.5 h-8 text-sm rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-sm">
            <X className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 pb-4 sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent">
          <Button
            onClick={handleApply}
            disabled={applying || !editTitle.trim()}
            className="flex-1 h-12 rounded-xl text-base gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20"
          >
            {applying ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Применение...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                Применить и создать {editTasks.length} задач
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setViewState("display")}
            disabled={applying}
            className="h-12 px-6 rounded-xl"
          >
            Отмена
          </Button>
        </div>
      </div>
    );
  }

  // ── State B: No summary, but transcript exists ──
  if (viewState === "display" && !meeting.parsed_summary && meeting.transcript) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-card p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
            <Bot className="h-7 w-7 text-accent" />
          </div>
          <div>
            <h3 className="text-base font-heading font-semibold">
              Обработать транскрипцию через AI
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              AI извлечёт резюме, решения и задачи из текста
            </p>
          </div>
          {aiSettings && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 text-sm mx-auto">
              <Bot className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Провайдер:</span>
              <span className="font-semibold text-foreground">
                {aiSettings.current_provider}
              </span>
              <span className="text-muted-foreground/60">
                ({aiSettings.current_model})
              </span>
            </div>
          )}
          {isModerator && (
            <Button
              onClick={handleParse}
              className="h-12 rounded-xl text-base gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/25"
            >
              <Sparkles className="h-5 w-5" />
              Обработать через AI
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-sm">
            <X className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── State C: No summary, no transcript ──
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
        <FileText className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground">
        Для создания резюме сначала добавьте транскрипцию
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={onSwitchToTranscript}
        className="mt-2 text-xs gap-1 text-primary"
      >
        <FileText className="h-3.5 w-3.5" />
        Перейти к транскрипции
      </Button>
    </div>
  );
}
