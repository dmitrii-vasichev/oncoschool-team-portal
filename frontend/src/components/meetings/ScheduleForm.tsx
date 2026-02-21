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
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code2,
  Eye,
  Link2,
  Smile,
  Plus,
  Trash2,
  PencilLine,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { DatePicker } from "@/components/shared/DatePicker";
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
const DEFAULT_REMINDER_OFFSETS = [60];
const EMOJIS = [
  "🔥",
  "✅",
  "📌",
  "📣",
  "⚠️",
  "💡",
  "🎯",
  "🚀",
  "🙂",
  "😊",
  "😉",
  "🙏",
  "🤝",
  "👏",
  "❤️",
  "📅",
  "⏰",
  "📈",
  "🧠",
  "📎",
  "🎉",
  "📝",
  "🔔",
  "👀",
];

const REMINDER_TEMPLATE_VARIABLES = [
  { token: "{время}", label: "Время (МСК)" },
  { token: "{название}", label: "Название встречи" },
  { token: "{дата}", label: "Дата (МСК)" },
  { token: "{день_недели}", label: "День недели" },
  { token: "{zoom_link}", label: "Zoom-ссылка" },
];

function applyReminderTemplate(
  template: string,
  values: { time: string; title: string; date: string; weekday: string; zoomLink: string }
): string {
  return template
    .replaceAll("{время}", values.time)
    .replaceAll("{название}", values.title)
    .replaceAll("{дата}", values.date)
    .replaceAll("{день_недели}", values.weekday)
    .replaceAll("{time_msk}", values.time)
    .replaceAll("{title}", values.title)
    .replaceAll("{date_msk}", values.date)
    .replaceAll("{weekday_ru}", values.weekday)
    .replaceAll("{zoom_link}", values.zoomLink)
    .replaceAll("{zoom_url}", values.zoomLink)
    .replaceAll("{ссылка_zoom}", values.zoomLink);
}

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

function hasZoomPlaceholder(template: string): boolean {
  const lower = template.toLowerCase();
  return (
    lower.includes("{zoom_link}") ||
    lower.includes("{zoom_url}") ||
    lower.includes("{ссылка_zoom}")
  );
}

function renderTelegramHtmlPreview(htmlText: string): { __html: string } {
  return { __html: htmlText.replace(/\n/g, "<br/>") };
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
  const [reminderOffsets, setReminderOffsets] = useState<number[]>(() =>
    normalizeReminderOffsets(
      schedule?.reminder_offsets_minutes,
      schedule?.reminder_minutes_before ?? 60
    )
  );
  const [reminderText, setReminderText] = useState(schedule?.reminder_text ?? "");
  const [reminderEditorOpen, setReminderEditorOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkSelection, setLinkSelection] = useState<{ start: number; end: number } | null>(null);
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
  const reminderTextRef = useRef<HTMLTextAreaElement | null>(null);

  const participantMentionsPreview = useMemo(
    () =>
      selectedMembers
        .map((member) => {
          if (!member.telegram_username) return null;
          const username = member.telegram_username.startsWith("@")
            ? member.telegram_username
            : `@${member.telegram_username}`;
          return username;
        })
        .filter((username): username is string => !!username)
        .join(" "),
    [selectedMembers]
  );

  const previewTemplateValues = useMemo(() => {
    const previewTime = timeMsk || "15:00";
    const previewTitle = title.trim() || "Название встречи";
    const previewDate =
      meetingDate ||
      new Date().toLocaleDateString("en-CA", {
        timeZone: "Europe/Moscow",
      });
    const previewWeekday =
      meetingDate
        ? DAY_OF_WEEK_LABELS[
            new Date(`${meetingDate}T12:00:00`).getDay() === 0
              ? 7
              : new Date(`${meetingDate}T12:00:00`).getDay()
          ]
        : DAY_OF_WEEK_LABELS[Number(dayOfWeek)] || "понедельник";
    return {
      time: previewTime,
      title: previewTitle,
      date: new Date(`${previewDate}T12:00:00`).toLocaleDateString("ru-RU", {
        timeZone: "Europe/Moscow",
      }),
      weekday: previewWeekday.toLowerCase(),
      zoomLink: "https://zoom.us/j/1234567890",
    };
  }, [dayOfWeek, meetingDate, timeMsk, title]);

  const baseReminderPreview = useMemo(() => {
    if (reminderText.trim()) {
      return applyReminderTemplate(reminderText.trim(), previewTemplateValues);
    }
    return `Здравствуйте! Напоминаю, сегодня в ${previewTemplateValues.time} по МСК встреча ${previewTemplateValues.title}`;
  }, [reminderText, previewTemplateValues]);

  const reminderPreviewWithZoom = useMemo(() => {
    let text = baseReminderPreview;
    if (participantMentionsPreview) {
      text += `\n\n${participantMentionsPreview}`;
    }
    if (!hasZoomPlaceholder(reminderText)) {
      text += "\n\nСсылка для подключения: https://zoom.us/j/1234567890";
    }
    return text;
  }, [baseReminderPreview, participantMentionsPreview, reminderText]);

  const updateReminderOffset = (index: number, value: number) => {
    setReminderOffsets((prev) => {
      const next = [...prev];
      next[index] = value;
      return normalizeReminderOffsets(next);
    });
  };

  const addReminderOffset = () => {
    setReminderOffsets((prev) => {
      const next = normalizeReminderOffsets(prev);
      const candidate = REMINDER_OPTIONS.find((value) => !next.includes(value));
      if (candidate == null) return next;
      return normalizeReminderOffsets([...next, candidate]);
    });
  };

  const removeReminderOffset = (index: number) => {
    setReminderOffsets((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, idx) => idx !== index);
      return normalizeReminderOffsets(next);
    });
  };

  const replaceReminderSelection = (replacement: string, cursorOffset = replacement.length) => {
    const textarea = reminderTextRef.current;
    if (!textarea) {
      setReminderText((prev) => `${prev}${replacement}`);
      return;
    }
    const start = textarea.selectionStart ?? reminderText.length;
    const end = textarea.selectionEnd ?? reminderText.length;
    const next = `${reminderText.slice(0, start)}${replacement}${reminderText.slice(end)}`;
    setReminderText(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + cursorOffset;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const wrapReminderSelection = (openTag: string, closeTag: string, fallback = "текст") => {
    const textarea = reminderTextRef.current;
    if (!textarea) {
      replaceReminderSelection(`${openTag}${fallback}${closeTag}`);
      return;
    }
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = reminderText.slice(start, end) || fallback;
    const next =
      reminderText.slice(0, start) +
      openTag +
      selected +
      closeTag +
      reminderText.slice(end);
    setReminderText(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + openTag.length;
      const selectionEnd = selectionStart + selected.length;
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const openLinkDialog = () => {
    const textarea = reminderTextRef.current;
    const start = textarea?.selectionStart ?? reminderText.length;
    const end = textarea?.selectionEnd ?? reminderText.length;
    const selectedText = reminderText.slice(start, end).trim();

    setLinkSelection({ start, end });
    setLinkLabel(selectedText || "");
    setLinkUrl("https://");
    setLinkDialogOpen(true);
  };

  const handleInsertLink = () => {
    const href = linkUrl.trim();
    const isZoomToken =
      href === "{zoom_link}" || href === "{zoom_url}" || href === "{ссылка_zoom}";
    if (!isZoomToken && !/^https?:\/\//i.test(href)) {
      setError("URL должен начинаться с http://, https:// или быть {zoom_link}");
      return;
    }
    setError(null);

    const label = linkLabel.trim() || "ссылка";
    const replacement = `<a href="${href}">${label}</a>`;
    const start = Math.max(0, Math.min(linkSelection?.start ?? reminderText.length, reminderText.length));
    const end = Math.max(start, Math.min(linkSelection?.end ?? start, reminderText.length));
    const next = reminderText.slice(0, start) + replacement + reminderText.slice(end);
    setReminderText(next);
    setLinkDialogOpen(false);

    const textarea = reminderTextRef.current;
    if (textarea) {
      requestAnimationFrame(() => {
        textarea.focus();
        const caret = start + `<a href="${href}">`.length + label.length;
        textarea.setSelectionRange(caret, caret);
      });
    }
  };

  const insertReminderVariable = (token: string) => {
    replaceReminderSelection(token);
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
        timezone: "Europe/Moscow",
        duration_minutes: Number(duration),
        recurrence,
        reminder_enabled: reminderEnabled,
        reminder_minutes_before: reminderOffsets[0] ?? 60,
        reminder_offsets_minutes: reminderOffsets,
        reminder_text: reminderText.trim() || null,
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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label className="text-xs font-medium">Текст напоминания</Label>
                      <p className="text-2xs text-muted-foreground/70 mt-0.5">
                        Откройте редактор, чтобы настроить форматирование, переменные и ссылку.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      onClick={() => setReminderEditorOpen(true)}
                    >
                      <PencilLine className="h-3.5 w-3.5 mr-1.5" />
                      Редактировать
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {reminderText.trim()
                      ? reminderText
                          .replace(/<[^>]*>/g, " ")
                          .replace(/\s+/g, " ")
                          .trim()
                      : "Будет использован стандартный текст напоминания."}
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 bg-card px-2.5 py-2 space-y-2">
                  <div>
                    <div>
                      <Label className="text-xs font-medium">Zoom-ссылка обязательна</Label>
                      <p className="text-2xs text-muted-foreground/70 mt-0.5">
                        Ссылка добавляется автоматически. Если Zoom не создан, напоминание не отправляется.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-border/60 bg-background/80 p-2.5 space-y-2">
                  <Label className="text-2xs text-muted-foreground">Предпросмотр сообщения</Label>
                  <div className="space-y-1.5 text-xs">
                    <div className="rounded-md border border-border/50 bg-card p-2">
                      <p className="text-2xs font-medium text-muted-foreground mb-1">
                        Итоговый текст напоминания
                      </p>
                      <div
                        className="whitespace-pre-wrap"
                        dangerouslySetInnerHTML={renderTelegramHtmlPreview(reminderPreviewWithZoom)}
                      />
                    </div>
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

          <Dialog open={reminderEditorOpen} onOpenChange={setReminderEditorOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">Редактор напоминания</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => wrapReminderSelection("<b>", "</b>", "жирный")}
                        title="Жирный"
                      >
                        <Bold className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => wrapReminderSelection("<i>", "</i>", "курсив")}
                        title="Курсив"
                      >
                        <Italic className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => wrapReminderSelection("<u>", "</u>", "подчеркнуто")}
                        title="Подчеркнутый"
                      >
                        <Underline className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => wrapReminderSelection("<s>", "</s>", "зачеркнуто")}
                        title="Зачеркнутый"
                      >
                        <Strikethrough className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => wrapReminderSelection("<code>", "</code>", "код")}
                        title="Код"
                      >
                        <Code2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => wrapReminderSelection("<tg-spoiler>", "</tg-spoiler>", "спойлер")}
                        title="Спойлер"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={openLinkDialog}
                        title="Ссылка"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Emoji"
                          >
                            <Smile className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 p-3">
                          <div className="grid grid-cols-8 gap-1">
                            {EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className="h-8 w-8 rounded-md text-lg hover:bg-muted"
                                onClick={() => replaceReminderSelection(emoji)}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <Textarea
                    ref={reminderTextRef}
                    value={reminderText}
                    onChange={(e) => setReminderText(e.target.value)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const token = e.dataTransfer.getData("text/reminder-variable");
                      if (token) {
                        insertReminderVariable(token);
                      }
                    }}
                    placeholder="Здравствуйте! Напоминаю, сегодня в {время} по МСК встреча {название}"
                    rows={10}
                    className="rounded-xl text-sm font-body"
                  />

                  <div>
                    <Label className="text-2xs text-muted-foreground">
                      Вставить переменную
                    </Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {REMINDER_TEMPLATE_VARIABLES.map((item) => (
                        <button
                          key={item.token}
                          type="button"
                          draggable
                          onDragStart={(e) =>
                            e.dataTransfer.setData("text/reminder-variable", item.token)
                          }
                          onClick={() => insertReminderVariable(item.token)}
                          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1 text-2xs hover:border-border transition-colors"
                        >
                          <span className="text-muted-foreground">{item.label}</span>
                          <code className="font-mono text-[10px]">{item.token}</code>
                        </button>
                      ))}
                    </div>
                    <p className="text-2xs text-muted-foreground/60 mt-1">
                      Можно использовать HTML, например:
                      {" "}
                      <code className="font-mono">{`<a href="{zoom_link}">Подключиться ↗</a>`}</code>
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    Предпросмотр
                  </div>
                  <div className="max-h-[360px] overflow-auto rounded-xl border border-border/40 bg-muted/20 p-4">
                    <div
                      className="ml-auto max-w-[96%] rounded-2xl bg-primary/10 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
                      dangerouslySetInnerHTML={renderTelegramHtmlPreview(reminderPreviewWithZoom)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="button" className="rounded-xl" onClick={() => setReminderEditorOpen(false)}>
                  Готово
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading text-base">Добавить ссылку</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reminder-link-url">URL</Label>
                  <Input
                    id="reminder-link-url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder='https://example.com или {zoom_link}'
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reminder-link-label">Текст ссылки</Label>
                  <Input
                    id="reminder-link-label"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="Подключиться ↗"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLinkDialogOpen(false)}
                  >
                    Отмена
                  </Button>
                  <Button type="button" onClick={handleInsertLink}>
                    Вставить
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
  );
}
