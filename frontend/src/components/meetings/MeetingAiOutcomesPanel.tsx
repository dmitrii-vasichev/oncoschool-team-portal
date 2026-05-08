"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  FileAudio,
  FileText,
  Loader2,
  Send,
  ListChecks,
  Square,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import { TASK_PRIORITY_LABELS } from "@/lib/types";
import type { MeetingAIProcessing, MeetingAITaskDraft } from "@/lib/types";
import { useTeam } from "@/hooks/useTeam";
import {
  buildMeetingOutcomePublishPayload,
  canPublishMeetingOutcomes,
  formatMeetingProcessingBadge,
  formatMeetingTranscriptionStatus,
  getSelectedTaskDraftsMissingAssignee,
  isMeetingTranscriptionActive,
  prepareMeetingOutcomeTaskDraftsForPublish,
  resolveTaskDraftAssignee,
  setAllTaskDraftsSelected,
  setTaskDraftAssignee,
  shouldShowMeetingTranscriptionStatus,
  toggleTaskDraftSelected,
} from "./MeetingAiOutcomesPanelUtils";

type BusyAction = "transcribe" | "draft" | "publish" | null;

interface MeetingAiOutcomesPanelProps {
  meetingId: string;
  isModerator: boolean;
  onPublished: () => void | Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatTaskPublishCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} задачу`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} задачи`;
  }
  return `${count} задач`;
}

export function MeetingAiOutcomesPanel({
  meetingId,
  isModerator,
  onPublished,
}: MeetingAiOutcomesPanelProps) {
  const { toastSuccess, toastError } = useToast();
  const { members, loading: membersLoading } = useTeam();
  const [busy, setBusy] = useState<BusyAction>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState<MeetingAIProcessing | null>(null);
  const [summary, setSummary] = useState("");
  const [decisionsText, setDecisionsText] = useState("");
  const [taskDrafts, setTaskDrafts] = useState<MeetingAITaskDraft[]>([]);

  const applyProcessing = (result: MeetingAIProcessing) => {
    setProcessing(result);
    setSummary(result.draft_summary ?? "");
    setDecisionsText((result.draft_decisions ?? []).join("\n"));
    setTaskDrafts(result.draft_tasks ?? []);
  };

  useEffect(() => {
    if (!isModerator) return;

    let cancelled = false;
    const loadProcessing = async () => {
      try {
        const result = await api.getMeetingAIProcessing(meetingId);
        if (!cancelled) applyProcessing(result);
      } catch {
        // Processing state is auxiliary; the panel remains usable if it is unavailable.
      }
    };

    void loadProcessing();
    return () => {
      cancelled = true;
    };
  }, [isModerator, meetingId]);

  const transcriptionActive = isMeetingTranscriptionActive(processing?.status);

  useEffect(() => {
    if (!isModerator || !transcriptionActive) return;

    let cancelled = false;
    const refreshProcessing = async () => {
      try {
        const result = await api.getMeetingAIProcessing(meetingId);
        if (cancelled) return;
        applyProcessing(result);
        if (result.status === "transcript_ready") {
          toastSuccess("Транскрипция готова");
          await onPublished();
        }
      } catch {
        // Keep polling quietly; transient API errors should not reset the visible state.
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshProcessing();
    }, 5000);
    void refreshProcessing();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isModerator, meetingId, onPublished, toastSuccess, transcriptionActive]);

  const activeMembers = useMemo(
    () => members.filter((member) => member.is_active),
    [members]
  );

  if (!isModerator) return null;

  const isBusy = busy !== null || transcriptionActive;

  const runAction = async (
    action: Exclude<BusyAction, null>,
    request: () => Promise<MeetingAIProcessing>,
    successMessage: string
  ) => {
    if (busy) return;
    setBusy(action);
    try {
      const result = await request();
      applyProcessing(result);
      toastSuccess(successMessage);
    } catch (error) {
      toastError(getErrorMessage(error, "Ошибка обработки AI-итогов"));
    } finally {
      setBusy(null);
    }
  };

  const openPublishConfirmation = () => {
    if (!canPublishMeetingOutcomes(processing?.status, isBusy)) return;
    setTaskDrafts((current) =>
      prepareMeetingOutcomeTaskDraftsForPublish(current, activeMembers)
    );
    setConfirmOpen(true);
  };

  const handlePublish = async () => {
    if (!canPublishMeetingOutcomes(processing?.status, isBusy)) return;
    const publishTaskDrafts = prepareMeetingOutcomeTaskDraftsForPublish(
      taskDrafts,
      activeMembers
    );
    const missingAssignees = getSelectedTaskDraftsMissingAssignee(
      publishTaskDrafts,
      activeMembers
    );
    if (missingAssignees.length > 0) {
      toastError("У выбранных задач должен быть исполнитель");
      return;
    }
    setBusy("publish");
    try {
      await api.publishMeetingOutcomes(
        meetingId,
        buildMeetingOutcomePublishPayload({
          summary,
          decisionsText,
          taskDrafts: publishTaskDrafts,
        })
      );
      setConfirmOpen(false);
      setTaskDrafts(publishTaskDrafts);
      toastSuccess("Итоги встречи опубликованы");
      await onPublished();
    } catch (error) {
      toastError(getErrorMessage(error, "Ошибка публикации итогов"));
    } finally {
      setBusy(null);
    }
  };

  const selectedTaskCount = taskDrafts.filter((task) => task.selected).length;
  const hasSelectedTasks = selectedTaskCount > 0;
  const canPublish = canPublishMeetingOutcomes(processing?.status, isBusy);
  const processingBadge = formatMeetingProcessingBadge(processing?.status);
  const missingAssigneeTasks = getSelectedTaskDraftsMissingAssignee(
    taskDrafts,
    activeMembers
  );
  const decisions = decisionsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <>
    <section className="rounded-2xl border border-border/60 bg-card p-4 animate-fade-in-up stagger-2 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-sm font-heading font-semibold">
            <Bot className="h-4 w-4 text-primary" />
            AI-итоги после встречи
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Запуск выполняется вручную модератором. Аудио используется только для
            транскрибации и не хранится в портале.
          </p>
        </div>
        {processingBadge && (
          <span className="inline-flex w-fit items-center rounded-lg bg-muted/60 px-2.5 py-1 text-2xs font-medium text-muted-foreground">
            {processingBadge}
          </span>
        )}
      </div>

      {processing?.error_message && (
        <div className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {processing.error_message}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            runAction(
              "transcribe",
              () => api.transcribeMeetingAudio(meetingId),
              "Транскрибация запущена. Можно закрыть страницу — мы пришлём уведомление."
            )
          }
          disabled={isBusy}
          className="rounded-lg gap-1.5"
        >
          {busy === "transcribe" || transcriptionActive ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileAudio className="h-3.5 w-3.5" />
          )}
          Транскрибировать аудио
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            runAction(
              "draft",
              () => api.generateMeetingOutcomeDraft(meetingId),
              "Черновик итогов создан"
            )
          }
          disabled={isBusy}
          className="rounded-lg gap-1.5"
        >
          {busy === "draft" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bot className="h-3.5 w-3.5" />
          )}
          Создать черновик итогов
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={openPublishConfirmation}
          disabled={!canPublish}
          className="rounded-lg gap-1.5"
        >
          {busy === "publish" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Опубликовать итоги
        </Button>
      </div>

      {processing && shouldShowMeetingTranscriptionStatus(processing) && (
        <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-foreground">
              {formatMeetingTranscriptionStatus(processing)}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {Math.max(0, Math.min(100, processing.transcription_progress_percent ?? 0))}%
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.max(0, Math.min(100, processing.transcription_progress_percent ?? 0))}%`,
              }}
            />
          </div>
          {transcriptionActive && (
            <p className="mt-2 text-muted-foreground">
              Можно уйти со страницы — после завершения придёт уведомление в портале и Telegram.
            </p>
          )}
        </div>
      )}

      {processing && (
        <div className="space-y-4 border-t border-border/60 pt-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Краткое резюме
            </Label>
            <Textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={3}
              className="rounded-xl border-border/60 text-sm"
              placeholder="Черновик резюме появится после генерации"
              disabled={isBusy}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Решения
            </Label>
            <Textarea
              value={decisionsText}
              onChange={(event) => setDecisionsText(event.target.value)}
              rows={3}
              className="rounded-xl border-border/60 text-sm"
              placeholder="Одно решение на строку"
              disabled={isBusy}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <ListChecks className="h-3.5 w-3.5" />
                Кандидаты задач
              </Label>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-2xs text-muted-foreground">
                  Выбрано {selectedTaskCount} из {taskDrafts.length}
                </span>
                {taskDrafts.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setTaskDrafts((current) =>
                        setAllTaskDraftsSelected(
                          current,
                          !current.some((task) => task.selected)
                        )
                      )
                    }
                    disabled={isBusy}
                    className="h-7 rounded-lg px-2 text-2xs"
                  >
                    {hasSelectedTasks ? (
                      <Square className="h-3.5 w-3.5" />
                    ) : (
                      <CheckSquare className="h-3.5 w-3.5" />
                    )}
                    {hasSelectedTasks ? "Снять все" : "Выбрать все"}
                  </Button>
                )}
              </div>
            </div>

            {taskDrafts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
                AI не предложил задачи для публикации.
              </div>
            ) : (
              <div className="space-y-2">
                {taskDrafts.map((task, index) => (
                  <label
                    key={`${task.title}-${index}`}
                    className="flex gap-3 rounded-xl border border-border/50 bg-background/50 p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={task.selected}
                      disabled={isBusy}
                      onChange={(event) =>
                        setTaskDrafts((current) =>
                          toggleTaskDraftSelected(current, index, event.target.checked)
                        )
                      }
                      className="mt-1 h-4 w-4 rounded border-border text-primary"
                    />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block font-medium text-foreground">
                        {task.title || "Без названия"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {[
                          task.assignee_name ? `Исполнитель: ${task.assignee_name}` : null,
                          task.deadline ? `Дедлайн: ${task.deadline}` : null,
                          task.priority === "urgent" ? "Срочная" : "Обычная",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {task.description && (
                        <span className="block text-xs leading-relaxed text-muted-foreground">
                          {task.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Публикация итогов встречи
          </DialogTitle>
          <DialogDescription>
            Проверьте, что будет сохранено во встречу и какие задачи будут созданы.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Резюме
            </div>
            <p className="mt-2 max-h-24 overflow-y-auto text-sm leading-relaxed text-foreground">
              {summary.trim() || "Резюме не заполнено"}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Решения
            </div>
            <p className="mt-2 text-sm text-foreground">
              Будет сохранено: {decisions.length}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5" />
              Задачи
            </div>
            <p className="mt-2 text-sm text-foreground">
              Будет создано: {formatTaskPublishCount(selectedTaskCount)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Задачи к созданию</h3>
            {missingAssigneeTasks.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Назначьте исполнителей: {missingAssigneeTasks.length}
              </span>
            )}
          </div>

          {selectedTaskCount === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
              Задачи создаваться не будут. Резюме и решения сохранятся во встречу.
            </div>
          ) : (
            <div className="space-y-2">
              {taskDrafts.map((task, index) => {
                if (!task.selected) return null;
                const assignee = resolveTaskDraftAssignee(task, activeMembers);
                return (
                  <div
                    key={`${task.title}-${index}-confirm`}
                    className="rounded-xl border border-border/60 bg-background/60 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-foreground">
                          {task.title || "Без названия"}
                        </p>
                        {task.description && (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {task.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 text-2xs text-muted-foreground">
                          <span>{TASK_PRIORITY_LABELS[task.priority]}</span>
                          {task.deadline && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {task.deadline}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setTaskDrafts((current) =>
                            toggleTaskDraftSelected(current, index, false)
                          )
                        }
                        disabled={isBusy}
                        className="h-8 rounded-lg text-2xs text-muted-foreground"
                      >
                        Не создавать
                      </Button>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                      <Select
                        value={assignee?.id ?? "missing"}
                        onValueChange={(memberId) => {
                          const member =
                            activeMembers.find((item) => item.id === memberId) ?? null;
                          setTaskDrafts((current) =>
                            setTaskDraftAssignee(current, index, member)
                          );
                        }}
                        disabled={membersLoading || isBusy}
                      >
                        <SelectTrigger
                          className={
                            assignee
                              ? "h-10 rounded-xl border-border/60"
                              : "h-10 rounded-xl border-destructive/50 text-destructive"
                          }
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <UserRound className="h-4 w-4 shrink-0 opacity-60" />
                            <SelectValue placeholder="Выберите исполнителя" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {!assignee && (
                            <SelectItem value="missing" disabled>
                              Выберите исполнителя
                            </SelectItem>
                          )}
                          {activeMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              <span className="flex items-center gap-2">
                                <UserAvatar
                                  name={member.full_name}
                                  avatarUrl={member.avatar_url}
                                  size="sm"
                                />
                                <span className="truncate">{member.full_name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {assignee && (
                        <span className="text-2xs text-muted-foreground">
                          Будет назначено при создании
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmOpen(false)}
            disabled={busy === "publish"}
          >
            Вернуться к проверке
          </Button>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={
              busy === "publish" ||
              membersLoading ||
              missingAssigneeTasks.length > 0
            }
          >
            {busy === "publish" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {selectedTaskCount > 0
              ? `Подтвердить и создать ${formatTaskPublishCount(selectedTaskCount)}`
              : "Подтвердить публикацию"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
