"use client";

import { useMemo, useRef, useState } from "react";
import {
  Loader2,
  Bell,
  Users,
  Link as LinkIcon,
  CalendarClock,
  SkipForward,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
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
import { UserAvatar } from "@/components/shared/UserAvatar";
import { DatePicker } from "@/components/shared/DatePicker";
import { TimePicker } from "@/components/shared/TimePicker";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ParticipantsPickerDialog } from "@/components/meetings/ParticipantsPickerDialog";
import type {
  MeetingSchedule,
  MeetingScheduleCreateRequest,
  TeamMember,
  TelegramNotificationTarget,
  MeetingRecurrence,
  Department,
} from "@/lib/types";
import { DAY_OF_WEEK_LABELS, RECURRENCE_LABELS } from "@/lib/types";
import { utcTimeToMsk } from "@/lib/meetingDateTime";

const DURATION_OPTIONS = [
  { value: "15", label: "15 мин" },
  { value: "30", label: "30 мин" },
  { value: "45", label: "45 мин" },
  { value: "60", label: "1 час" },
  { value: "90", label: "1.5 часа" },
  { value: "120", label: "2 часа" },
  { value: "150", label: "2.5 часа" },
  { value: "180", label: "3 часа" },
];

const REMINDER_OPTIONS = [120, 60, 30, 15, 0];
const DEFAULT_REMINDER_OFFSETS = [60, 0];

function formatReminderOffsetLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "в момент начала";
  if (offsetMinutes === 60) return "за 1 час";
  if (offsetMinutes === 120) return "за 2 часа";
  return `за ${offsetMinutes} мин`;
}

function normalizeReminderOffsets(
  offsets: number[] | null | undefined,
  fallback?: number | null
): number[] {
  const source = offsets?.length ? offsets : fallback != null ? [fallback] : DEFAULT_REMINDER_OFFSETS;
  const normalized: number[] = [];
  for (const value of source) {
    const offset = Number(value);
    if (!REMINDER_OPTIONS.includes(offset)) continue;
    if (!normalized.includes(offset)) normalized.push(offset);
  }
  if (!normalized.length) return [...DEFAULT_REMINDER_OFFSETS];
  return normalized.sort((a, b) => b - a);
}

function toMoscowDate(utcIso: string): string {
  const normalized = utcIso.endsWith("Z") ? utcIso : `${utcIso}Z`;
  return new Date(normalized).toLocaleDateString("en-CA", {
    timeZone: "Europe/Moscow",
  });
}

function toMoscowTime(utcIso: string): string {
  const normalized = utcIso.endsWith("Z") ? utcIso : `${utcIso}Z`;
  return new Date(normalized).toLocaleTimeString("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getInitialDateFromSchedule(schedule: MeetingSchedule | null): string {
  if (!schedule) return "";
  if (schedule.next_occurrence_at) {
    return toMoscowDate(schedule.next_occurrence_at);
  }
  if (schedule.one_time_date) {
    const oneTimeUtc = `${schedule.one_time_date}T${schedule.time_utc}Z`;
    return toMoscowDate(oneTimeUtc);
  }
  return "";
}

interface ScheduleFormProps {
  schedule: MeetingSchedule | null; // null = create mode
  members: TeamMember[];
  departments: Department[];
  telegramTargets: TelegramNotificationTarget[];
  onSave: (data: MeetingScheduleCreateRequest) => Promise<void>;
  onClose: () => void;
}

export function ScheduleForm({
  schedule,
  members,
  departments,
  telegramTargets,
  onSave,
  onClose,
}: ScheduleFormProps) {
  const isEdit = !!schedule;
  const initialReminderOffsets = normalizeReminderOffsets(
    schedule?.reminder_offsets_minutes,
    schedule ? (schedule.reminder_minutes_before ?? 60) : null
  );

  const [title, setTitle] = useState(schedule?.title ?? "");
  const [dayOfWeek, setDayOfWeek] = useState(String(schedule?.day_of_week ?? 1));
  const [timeMsk, setTimeMsk] = useState(() => {
    if (schedule?.next_occurrence_at) {
      return toMoscowTime(schedule.next_occurrence_at);
    }
    return schedule ? utcTimeToMsk(schedule.time_utc) : "15:00";
  });
  const [duration, setDuration] = useState(String(schedule?.duration_minutes ?? 60));
  const [recurrence, setRecurrence] = useState<MeetingRecurrence>(
    schedule?.recurrence ?? "weekly"
  );
  const [meetingDate, setMeetingDate] = useState<string>(() =>
    getInitialDateFromSchedule(schedule)
  );
  const [participantIds, setParticipantIds] = useState<string[]>(
    schedule?.participant_ids ?? []
  );
  const [reminderEnabled, setReminderEnabled] = useState(
    schedule?.reminder_enabled ?? true
  );
  const [reminderOffsets, setReminderOffsets] = useState<number[]>(() => [
    ...initialReminderOffsets,
  ]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>(() => {
    // Pre-select telegram targets that match the schedule's targets
    if (!schedule?.telegram_targets?.length) return telegramTargets.map((t) => t.id);
    return telegramTargets
      .filter((t) =>
        schedule.telegram_targets.some(
          (st) => String(st.chat_id) === String(t.chat_id) && st.thread_id === t.thread_id
        )
      )
      .map((t) => t.id);
  });

  const [nextOccurrenceSkip, setNextOccurrenceSkip] = useState(
    schedule?.next_occurrence_skip ?? false
  );
  const [nextOccurrenceTimeMsk, setNextOccurrenceTimeMsk] = useState<string>(() => {
    if (schedule?.next_occurrence_time_override) {
      return utcTimeToMsk(schedule.next_occurrence_time_override);
    }
    return "";
  });
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);
  const [notifyParticipantsDialogOpen, setNotifyParticipantsDialogOpen] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<MeetingScheduleCreateRequest | null>(
    null
  );

  const [saving, setSaving] = useState(false);
  const submitInFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  const selectedMembers = useMemo(
    () =>
      participantIds
        .map((participantId) => membersById.get(participantId))
        .filter((member): member is TeamMember => !!member),
    [participantIds, membersById]
  );

  const selectedTargets = useMemo(
    () =>
      telegramTargets
        .filter((target) => selectedTargetIds.includes(target.id))
        .map((target) => ({
          id: target.id,
          chat_id: String(target.chat_id),
          thread_id: target.thread_id,
          displayName:
            `${target.label?.trim() || `Chat ${target.chat_id}`}` +
            (target.thread_id ? ` (тема #${target.thread_id})` : ""),
        })),
    [telegramTargets, selectedTargetIds]
  );

  const hiddenSelectedCount = participantIds.length - selectedMembers.length;

  const updateReminderOffset = (index: number, value: number) => {
    const previousOffsets = [...reminderOffsets];
    const currentValue = previousOffsets[index];
    if (currentValue === value) return;
    const nextOffsetsRaw = [...previousOffsets];
    nextOffsetsRaw[index] = value;
    const nextOffsets = normalizeReminderOffsets(nextOffsetsRaw);
    setReminderOffsets(nextOffsets);
  };

  const addReminderOffset = () => {
    const next = normalizeReminderOffsets(reminderOffsets);
    const candidate = REMINDER_OPTIONS.find((value) => !next.includes(value));
    if (candidate == null) return;
    const nextOffsets = normalizeReminderOffsets([...next, candidate]);
    setReminderOffsets(nextOffsets);
  };

  const removeReminderOffset = (index: number) => {
    if (reminderOffsets.length <= 1) return;
    const nextOffsets = normalizeReminderOffsets(
      reminderOffsets.filter((_, idx) => idx !== index)
    );
    setReminderOffsets(nextOffsets);
  };

  const toggleTarget = (id: string) => {
    setSelectedTargetIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const isRecurringMode =
    recurrence === "weekly" ||
    recurrence === "biweekly" ||
    recurrence === "monthly_last_workday";
  const isOneTimeMode = recurrence === "one_time";
  const isOnDemandMode = recurrence === "on_demand";

  const submitSchedule = async (data: MeetingScheduleCreateRequest) => {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    try {
      setSaving(true);
      setError(null);
      await onSave(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
      submitInFlightRef.current = false;
    }
  };

  const handleNotifyParticipantsChoice = (shouldNotifyParticipants: boolean) => {
    if (!pendingSaveData || saving || submitInFlightRef.current) return;
    const dataWithNotificationPreference: MeetingScheduleCreateRequest = {
      ...pendingSaveData,
      notify_participants: shouldNotifyParticipants,
    };
    setPendingSaveData(null);
    setNotifyParticipantsDialogOpen(false);
    void submitSchedule(dataWithNotificationPreference);
  };

  const handleNotifyParticipantsDialogOpenChange = (open: boolean) => {
    setNotifyParticipantsDialogOpen(open);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Введите название");
      return;
    }
    if (isRecurringMode && !dayOfWeek) {
      setError("Выберите день недели");
      return;
    }
    if (isOneTimeMode && !meetingDate) {
      setError("Выберите дату встречи");
      return;
    }
    if (!timeMsk) {
      setError("Выберите время встречи");
      return;
    }
    if (reminderEnabled && reminderOffsets.length === 0) {
      setError("Добавьте хотя бы один тайминг напоминания");
      return;
    }

    try {
      const tgTargets = selectedTargets.map((target) => ({
        chat_id: target.chat_id,
        thread_id: target.thread_id,
      }));

      const data: MeetingScheduleCreateRequest = {
        title: title.trim(),
        timezone: "Europe/Moscow",
        duration_minutes: Number(duration),
        recurrence,
        reminder_enabled: reminderEnabled,
        reminder_minutes_before: reminderOffsets[0] ?? 60,
        reminder_offsets_minutes: reminderOffsets,
        reminder_include_zoom_link: true,
        reminder_zoom_missing_behavior: "hide",
        reminder_zoom_missing_text: null,
        telegram_targets: tgTargets,
        participant_ids: participantIds,
        zoom_enabled: true,
      };

      if (isRecurringMode) {
        data.day_of_week = Number(dayOfWeek);
        data.time_local = timeMsk;
        if (isEdit) {
          data.next_occurrence_skip = nextOccurrenceSkip;
          data.next_occurrence_time_local = nextOccurrenceTimeMsk || null;
        }
      } else {
        data.time_local = timeMsk;
        if (meetingDate) {
          data.meeting_date_local = `${meetingDate}T${timeMsk}`;
          if (isEdit && isOnDemandMode) {
            data.next_occurrence_datetime_local = `${meetingDate}T${timeMsk}`;
          }
        } else if (isEdit && isOnDemandMode) {
          data.next_occurrence_datetime_local = null;
        }
      }

      setPendingSaveData(data);
      setNotifyParticipantsDialogOpen(true);
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEdit ? "Редактировать встречу" : "Новая встреча"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Title */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Название
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Планерка по контенту"
              className="mt-1.5 rounded-xl"
            />
          </div>

          {/* Day/Date + Time row */}
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {isRecurringMode
                  ? "День недели"
                  : isOnDemandMode
                    ? "Ближайшая дата (МСК)"
                    : "Дата встречи (МСК)"}
              </Label>
              {isRecurringMode ? (
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger className="mt-1.5 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {DAY_OF_WEEK_LABELS[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <DatePicker
                  value={meetingDate}
                  onChange={setMeetingDate}
                  placeholder={isOnDemandMode ? "Опционально" : "Выбрать дату"}
                  className="w-full mt-1.5 rounded-xl"
                />
              )}
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Время (МСК)
              </Label>
              <TimePicker
                value={timeMsk}
                onChange={setTimeMsk}
                className="mt-1.5 w-full rounded-xl"
              />
            </div>
          </div>

          {/* Duration + Recurrence */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Длительность
              </Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="mt-1.5 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Периодичность
              </Label>
              <Select
                value={recurrence}
                onValueChange={(v) => setRecurrence(v as MeetingRecurrence)}
              >
                <SelectTrigger className="mt-1.5 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(RECURRENCE_LABELS) as [MeetingRecurrence, string][]).map(
                    ([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border/60" />

          {/* Participants */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              Участники
            </Label>
            <div className="mt-2 rounded-xl border border-border/60 bg-card p-3 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {participantIds.length > 0
                      ? `Выбрано: ${participantIds.length}`
                      : "Участники не выбраны"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Поиск и группировка доступны в отдельном окне выбора
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-lg shrink-0"
                  onClick={() => setParticipantPickerOpen(true)}
                >
                  Изменить
                </Button>
              </div>

              {selectedMembers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.slice(0, 8).map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2 py-1"
                    >
                      <UserAvatar name={member.full_name} avatarUrl={member.avatar_url} size="sm" />
                      <span className="text-xs font-medium text-foreground truncate max-w-[120px] sm:max-w-[140px]">
                        {member.full_name}
                      </span>
                    </div>
                  ))}
                  {selectedMembers.length > 8 && (
                    <span className="inline-flex items-center rounded-lg border border-border/60 px-2 py-1 text-xs text-muted-foreground">
                      +{selectedMembers.length - 8}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/70">
                  Выберите участников, чтобы они автоматически попадали во встречи по расписанию.
                </p>
              )}

              {hiddenSelectedCount > 0 && (
                <p className="text-xs text-amber-600">
                  {hiddenSelectedCount} участник(ов) скрыт: они неактивны или отсутствуют в текущем списке команды.
                </p>
              )}
            </div>

            <ParticipantsPickerDialog
              open={participantPickerOpen}
              onOpenChange={setParticipantPickerOpen}
              members={members}
              departments={departments}
              selectedIds={participantIds}
              onApply={setParticipantIds}
            />
          </div>

          {/* Divider */}
          <div className="h-px bg-border/60" />

          {/* Reminder toggle + settings */}
          <div className="rounded-xl bg-muted/40 border border-border/40 overflow-hidden">
            <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Напоминание в Telegram</span>
              </div>
              <Switch
                checked={reminderEnabled}
                onCheckedChange={setReminderEnabled}
              />
            </div>

            {reminderEnabled && (
              <div className="px-3 pb-3 space-y-3 border-t border-border/40 pt-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-2xs text-muted-foreground">
                      Тайминги напоминаний
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-lg text-2xs px-2"
                      onClick={addReminderOffset}
                      disabled={reminderOffsets.length >= REMINDER_OPTIONS.length}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Добавить напоминание
                    </Button>
                  </div>

                  <div className="mt-1.5 space-y-2">
                    {reminderOffsets.map((offset, index) => (
                      <div key={`${offset}-${index}`} className="flex items-center gap-2">
                        <Select
                          value={String(offset)}
                          onValueChange={(value) => updateReminderOffset(index, Number(value))}
                        >
                          <SelectTrigger className="rounded-lg h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REMINDER_OPTIONS.map((option) => {
                              const usedByAnother = reminderOffsets.some(
                                (existingOffset, existingIdx) =>
                                  existingOffset === option && existingIdx !== index
                              );
                              return (
                                <SelectItem
                                  key={option}
                                  value={String(option)}
                                  disabled={usedByAnother}
                                >
                                  {formatReminderOffsetLabel(option)}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-muted-foreground"
                          onClick={() => removeReminderOffset(index)}
                          disabled={reminderOffsets.length <= 1}
                          title="Удалить тайминг"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-card px-2.5 py-2 space-y-2">
                  <div>
                    <Label className="text-xs font-medium">Тексты напоминаний</Label>
                    <p className="text-2xs text-muted-foreground/70 mt-0.5">
                      Формат текста настраивается в отдельном окне
                      {" "}
                      <span className="font-medium">&laquo;Тексты напоминаний&raquo;</span>
                      {" "}
                      на странице встреч и применяется ко всем встречам.
                    </p>
                  </div>
                </div>

                {/* Telegram targets */}
                <div>
                  <Label className="text-2xs text-muted-foreground flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" />
                    Telegram-группы
                  </Label>
                  {telegramTargets.length === 0 ? (
                    <p className="text-2xs text-muted-foreground/60 mt-1">
                      Нет настроенных групп. Добавьте в Настройки &rarr; Telegram-группы.
                    </p>
                  ) : (
                    <div className="space-y-1.5 mt-1.5">
                      {telegramTargets.map((target) => {
                        const selected = selectedTargetIds.includes(target.id);
                        return (
                          <button
                            key={target.id}
                            onClick={() => toggleTarget(target.id)}
                            className={`
                              w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs
                              transition-all duration-150
                              ${
                                selected
                                  ? "border-primary bg-primary/5"
                                  : "border-border/60 bg-card hover:border-border"
                              }
                            `}
                          >
                            <div
                              className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${
                                selected
                                  ? "bg-primary border-primary"
                                  : "border-border"
                              }`}
                            >
                              {selected && (
                                <svg
                                  viewBox="0 0 12 12"
                                  className="h-2.5 w-2.5 text-primary-foreground"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M2 6L5 9L10 3" />
                                </svg>
                              )}
                            </div>
                            <span className="flex-1 truncate font-medium">
                              {target.label || `Chat ${target.chat_id}`}
                            </span>
                            {target.thread_id && (
                              <span className="text-2xs text-muted-foreground">
                                тема #{target.thread_id}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Next meeting override (edit mode only) */}
          {isEdit && isRecurringMode && schedule?.next_occurrence_date && (
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 overflow-hidden">
              <div className="p-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarClock className="h-3 w-3" />
                  Ближайшая встреча
                </Label>
                <p className="text-sm font-medium mt-1.5">
                  {(() => {
                    try {
                      const timeUtc = schedule.time_utc;
                      const [th, tm] = timeUtc.split(":").map(Number);
                      const [year, month, day] = schedule.next_occurrence_date!.split("-").map(Number);
                      const utcDate = new Date(Date.UTC(year, month - 1, day, th, tm));
                      const formatted = utcDate.toLocaleDateString("ru-RU", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "Europe/Moscow",
                      });
                      const mskTime = utcDate.toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Moscow",
                      });
                      return `${formatted.charAt(0).toUpperCase() + formatted.slice(1)}, ${mskTime} МСК`;
                    } catch {
                      return schedule.next_occurrence_date;
                    }
                  })()}
                </p>
              </div>

              <div className="px-3 pb-3 space-y-3 border-t border-amber-500/10 pt-3">
                {/* Skip toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SkipForward className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">Отменить ближайшую встречу</span>
                  </div>
                  <Switch
                    checked={nextOccurrenceSkip}
                    onCheckedChange={(checked) => {
                      setNextOccurrenceSkip(checked);
                      if (checked) setNextOccurrenceTimeMsk("");
                    }}
                  />
                </div>
                {nextOccurrenceSkip && (
                  <p className="text-2xs text-amber-700">
                    После сохранения ближайший слот будет пропущен, встреча перейдёт на
                    следующий слот расписания.
                  </p>
                )}

                {/* Time override (hidden if skip is on) */}
                {!nextOccurrenceSkip && (
                  <div>
                    <Label className="text-2xs text-muted-foreground">
                      Перенести на другое время, МСК (только эта встреча)
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <TimePicker
                        value={nextOccurrenceTimeMsk}
                        onChange={setNextOccurrenceTimeMsk}
                        className="rounded-lg h-8 text-sm flex-1"
                      />
                      {nextOccurrenceTimeMsk && (
                        <button
                          type="button"
                          onClick={() => setNextOccurrenceTimeMsk("")}
                          className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : isEdit ? (
                "Сохранить"
              ) : (
                "Создать"
              )}
            </Button>
          </div>
        </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={notifyParticipantsDialogOpen}
        onOpenChange={handleNotifyParticipantsDialogOpenChange}
        title="Оповестить участников?"
        description={
          <div className="space-y-2">
            <p>
              {isEdit
                ? "Отправить сообщение об изменениях встречи в выбранные Telegram-группы."
                : "Отправить сообщение о создании встречи в выбранные Telegram-группы."}
            </p>
            {selectedTargets.length > 0 ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium text-foreground">Выбранные группы:</p>
                <ul className="mt-1 space-y-1 text-xs text-foreground/90">
                  {selectedTargets.map((target) => (
                    <li key={target.id} className="truncate">
                      • {target.displayName}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Сейчас группы не выбраны, уведомление не будет отправлено.
              </p>
            )}
          </div>
        }
        confirmLabel="Оповестить"
        cancelLabel="Без оповещения"
        confirmDisabled={saving}
        cancelDisabled={saving}
        variant="default"
        onConfirm={() => handleNotifyParticipantsChoice(true)}
        onCancel={() => handleNotifyParticipantsChoice(false)}
      />
    </>
  );
}
