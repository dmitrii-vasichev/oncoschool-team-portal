"use client";

import { useMemo, useState } from "react";
import {
  Loader2,
  Video,
  Bell,
  Users,
  Link as LinkIcon,
  CalendarClock,
  SkipForward,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { TimePicker } from "@/components/shared/TimePicker";
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
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  getTimezoneShortLabel,
} from "@/lib/timezones";

const DURATION_OPTIONS = [
  { value: "30", label: "30 мин" },
  { value: "45", label: "45 мин" },
  { value: "60", label: "1 час" },
  { value: "90", label: "1.5 часа" },
  { value: "120", label: "2 часа" },
  { value: "150", label: "2.5 часа" },
  { value: "180", label: "3 часа" },
];

const REMINDER_OPTIONS = [
  { value: "15", label: "за 15 мин" },
  { value: "30", label: "за 30 мин" },
  { value: "60", label: "за 1 час" },
  { value: "120", label: "за 2 часа" },
];

function utcTimeToLocal(timeUtc: string, timezone: string): string {
  try {
    const [h, m] = timeUtc.split(":").map(Number);
    const utcDate = new Date(Date.UTC(2024, 0, 1, h, m));
    return utcDate.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    });
  } catch {
    return timeUtc.slice(0, 5);
  }
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

  const [title, setTitle] = useState(schedule?.title ?? "");
  const [dayOfWeek, setDayOfWeek] = useState(String(schedule?.day_of_week ?? 1));
  const [timezone, setTimezone] = useState(schedule?.timezone ?? DEFAULT_TIMEZONE);
  const [timeLocal, setTimeLocal] = useState(
    schedule ? utcTimeToLocal(schedule.time_utc, schedule.timezone) : "15:00"
  );
  const [duration, setDuration] = useState(String(schedule?.duration_minutes ?? 60));
  const [recurrence, setRecurrence] = useState<MeetingRecurrence>(
    schedule?.recurrence ?? "weekly"
  );
  const [participantIds, setParticipantIds] = useState<string[]>(
    schedule?.participant_ids ?? []
  );
  const [zoomEnabled, setZoomEnabled] = useState(schedule?.zoom_enabled ?? true);
  const [reminderEnabled, setReminderEnabled] = useState(
    schedule?.reminder_enabled ?? true
  );
  const [reminderMinutes, setReminderMinutes] = useState(
    String(schedule?.reminder_minutes_before ?? 60)
  );
  const [reminderText, setReminderText] = useState(schedule?.reminder_text ?? "");
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
  const [nextOccurrenceTimeLocal, setNextOccurrenceTimeLocal] = useState<string>(() => {
    if (schedule?.next_occurrence_time_override) {
      return utcTimeToLocal(schedule.next_occurrence_time_override, schedule.timezone);
    }
    return "";
  });
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);

  const [saving, setSaving] = useState(false);
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

  const hiddenSelectedCount = participantIds.length - selectedMembers.length;

  const toggleTarget = (id: string) => {
    setSelectedTargetIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Введите название");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const tgTargets = telegramTargets
        .filter((t) => selectedTargetIds.includes(t.id))
        .map((t) => ({
          chat_id: String(t.chat_id),
          thread_id: t.thread_id,
        }));

      const data: MeetingScheduleCreateRequest = {
        title: title.trim(),
        day_of_week: Number(dayOfWeek),
        time_local: timeLocal,
        timezone,
        duration_minutes: Number(duration),
        recurrence,
        reminder_enabled: reminderEnabled,
        reminder_minutes_before: Number(reminderMinutes),
        reminder_text: reminderText.trim() || null,
        telegram_targets: tgTargets,
        participant_ids: participantIds,
        zoom_enabled: zoomEnabled,
        ...(isEdit && {
          next_occurrence_skip: nextOccurrenceSkip,
          next_occurrence_time_local: nextOccurrenceTimeLocal || null,
        }),
      };

      await onSave(data);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEdit ? "Редактировать расписание" : "Новое расписание"}
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

          {/* Day + Time row */}
          <div className="grid grid-cols-2 items-end gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                День недели
              </Label>
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
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Время ({getTimezoneShortLabel(timezone)})
              </Label>
              <TimePicker
                value={timeLocal}
                onChange={setTimeLocal}
                className="mt-1.5 w-full rounded-xl"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Часовой пояс
            </Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="mt-1.5 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration + Recurrence */}
          <div className="grid grid-cols-2 gap-3">
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
              <div className="flex items-start justify-between gap-3">
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
                      <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
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

          {/* Zoom toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Создавать Zoom автоматически</span>
            </div>
            <Switch checked={zoomEnabled} onCheckedChange={setZoomEnabled} />
          </div>

          {/* Reminder toggle + settings */}
          <div className="rounded-xl bg-muted/40 border border-border/40 overflow-hidden">
            <div className="flex items-center justify-between p-3">
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
                  <Label className="text-2xs text-muted-foreground">
                    Отправить
                  </Label>
                  <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
                    <SelectTrigger className="mt-1 rounded-lg h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REMINDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-2xs text-muted-foreground">
                    Текст напоминания (необязательно)
                  </Label>
                  <Textarea
                    value={reminderText}
                    onChange={(e) => setReminderText(e.target.value)}
                    placeholder='Доброго времени! Напоминаем, сегодня в {время} по МСК {название}'
                    rows={2}
                    className="mt-1 rounded-lg text-sm resize-none"
                  />
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
          {isEdit && schedule?.next_occurrence_date && (
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 overflow-hidden">
              <div className="p-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarClock className="h-3 w-3" />
                  Ближайшая встреча
                </Label>
                <p className="text-sm font-medium mt-1.5">
                  {(() => {
                    try {
                      const d = new Date(schedule.next_occurrence_date + "T00:00:00");
                      const formatted = d.toLocaleDateString("ru-RU", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      });
                      return `${formatted.charAt(0).toUpperCase() + formatted.slice(1)}, ${timeLocal}`;
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
                      if (checked) setNextOccurrenceTimeLocal("");
                    }}
                  />
                </div>

                {/* Time override (hidden if skip is on) */}
                {!nextOccurrenceSkip && (
                  <div>
                    <Label className="text-2xs text-muted-foreground">
                      Перенести на другое время (только эта встреча)
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <TimePicker
                        value={nextOccurrenceTimeLocal}
                        onChange={setNextOccurrenceTimeLocal}
                        className="rounded-lg h-8 text-sm flex-1"
                      />
                      {nextOccurrenceTimeLocal && (
                        <button
                          type="button"
                          onClick={() => setNextOccurrenceTimeLocal("")}
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
  );
}
