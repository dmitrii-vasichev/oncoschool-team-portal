"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code2,
  Eye,
  Link2,
  Smile,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/shared/TimePicker";
import type { TelegramNotificationTarget } from "@/lib/types";

const REMINDER_OPTIONS = [120, 60, 30, 15, 0];
const DEFAULT_LINK_LABEL = "Подключиться ↗";
const DEFAULT_WEEKLY_DIGEST_TEMPLATE =
  "Наши встречи с {week_start} по {week_end}:\n\n{meetings}";
const WEEKLY_DIGEST_DAY_OPTIONS = [
  { value: 1, label: "Понедельник" },
  { value: 2, label: "Вторник" },
  { value: 3, label: "Среда" },
  { value: 4, label: "Четверг" },
  { value: 5, label: "Пятница" },
  { value: 6, label: "Суббота" },
  { value: 7, label: "Воскресенье" },
];
const WEEKLY_DIGEST_VARIABLES = [
  { token: "{week_start}", label: "Начало недели (дд.мм)" },
  { token: "{week_end}", label: "Конец недели (дд.мм)" },
  { token: "{week_start_date}", label: "Начало недели (дд.мм.гггг)" },
  { token: "{week_end_date}", label: "Конец недели (дд.мм.гггг)" },
  { token: "{meetings_count}", label: "Количество встреч" },
  { token: "{meetings}", label: "Список встреч" },
];
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
  { token: "{участники}", label: "Список участников" },
  { token: "{zoom_link}", label: "Zoom-ссылка" },
];

interface WeeklyDigestState {
  enabled: boolean;
  day_of_week: number;
  time_local: string;
  target_ids: string[];
  template: string;
}

function formatReminderOffsetLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "В момент начала";
  if (offsetMinutes === 60) return "За 1 час";
  if (offsetMinutes === 120) return "За 2 часа";
  return `За ${offsetMinutes} мин`;
}

function normalizeReminderTextsByOffset(
  textsByOffset: Record<string, string> | null | undefined
): Record<string, string> {
  const source = textsByOffset ?? {};
  const normalized: Record<string, string> = {};
  for (const offset of REMINDER_OPTIONS) {
    const key = String(offset);
    const text = String(source[key] ?? "").trim();
    if (text) {
      normalized[key] = text;
    }
  }
  return normalized;
}

function normalizeDigestTargetIds(
  targetIds: string[] | null | undefined,
  telegramTargets: TelegramNotificationTarget[]
): string[] {
  const available = new Set(telegramTargets.map((target) => target.id));
  const source = Array.isArray(targetIds) ? targetIds : [];
  const normalized: string[] = [];
  for (const id of source) {
    if (!available.has(id)) continue;
    if (!normalized.includes(id)) normalized.push(id);
  }
  return normalized;
}

function applyReminderTemplate(
  template: string,
  values: {
    time: string;
    title: string;
    date: string;
    weekday: string;
    participants: string;
    zoomLink: string;
  }
): string {
  return template
    .replaceAll("{время}", values.time)
    .replaceAll("{название}", values.title)
    .replaceAll("{дата}", values.date)
    .replaceAll("{день_недели}", values.weekday)
    .replaceAll("{участники}", values.participants)
    .replaceAll("{юзернеймы}", values.participants)
    .replaceAll("{time_msk}", values.time)
    .replaceAll("{title}", values.title)
    .replaceAll("{date_msk}", values.date)
    .replaceAll("{weekday_ru}", values.weekday)
    .replaceAll("{participants}", values.participants)
    .replaceAll("{usernames}", values.participants)
    .replaceAll("{participant_usernames}", values.participants)
    .replaceAll("{zoom_link}", values.zoomLink)
    .replaceAll("{zoom_url}", values.zoomLink)
    .replaceAll("{ссылка_zoom}", values.zoomLink);
}

function applyWeeklyDigestTemplate(
  template: string,
  values: {
    weekStart: string;
    weekEnd: string;
    weekStartDate: string;
    weekEndDate: string;
    meetingsCount: string;
    meetings: string;
  }
): string {
  return template
    .replaceAll("{week_start}", values.weekStart)
    .replaceAll("{week_end}", values.weekEnd)
    .replaceAll("{week_start_date}", values.weekStartDate)
    .replaceAll("{week_end_date}", values.weekEndDate)
    .replaceAll("{meetings_count}", values.meetingsCount)
    .replaceAll("{meetings}", values.meetings)
    .replaceAll("{items}", values.meetings);
}

function getDefaultReminderText(
  offsetMinutes: number,
  values: { time: string; title: string }
): string {
  if (offsetMinutes === 0) {
    return `Здравствуйте! Встреча ${values.title} начинается сейчас (${values.time} МСК)`;
  }
  return `Здравствуйте! Напоминаю, сегодня в ${values.time} по МСК встреча ${values.title}`;
}

function hasZoomPlaceholder(template: string): boolean {
  const lower = template.toLowerCase();
  return (
    lower.includes("{zoom_link}") ||
    lower.includes("{zoom_url}") ||
    lower.includes("{ссылка_zoom}")
  );
}

function hasParticipantsPlaceholder(template: string): boolean {
  const lower = template.toLowerCase();
  return (
    lower.includes("{участники}") ||
    lower.includes("{юзернеймы}") ||
    lower.includes("{participants}") ||
    lower.includes("{usernames}") ||
    lower.includes("{participant_usernames}")
  );
}

function renderTelegramHtmlPreview(htmlText: string): { __html: string } {
  return { __html: htmlText.replace(/\n/g, "<br/>") };
}

interface MeetingReminderTextsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  telegramTargets: TelegramNotificationTarget[];
}

export function MeetingReminderTextsDialog({
  open,
  onOpenChange,
  telegramTargets,
}: MeetingReminderTextsDialogProps) {
  const { toastSuccess, toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"reminders" | "weekly">("reminders");
  const [textsByOffset, setTextsByOffset] = useState<Record<string, string>>({});
  const [activeReminderOffset, setActiveReminderOffset] = useState<number>(60);
  const [weeklyDigest, setWeeklyDigest] = useState<WeeklyDigestState>({
    enabled: false,
    day_of_week: 7,
    time_local: "21:00",
    target_ids: [],
    template: DEFAULT_WEEKLY_DIGEST_TEMPLATE,
  });
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("{zoom_link}");
  const [linkLabel, setLinkLabel] = useState(DEFAULT_LINK_LABEL);
  const [linkSelection, setLinkSelection] = useState<{ start: number; end: number } | null>(null);

  const reminderTextRef = useRef<HTMLTextAreaElement | null>(null);
  const weeklyTemplateRef = useRef<HTMLTextAreaElement | null>(null);
  const activeReminderOffsetKey = String(activeReminderOffset);
  const activeReminderText = textsByOffset[activeReminderOffsetKey] ?? "";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setActiveTab("reminders");

    Promise.allSettled([
      api.getMeetingReminderTexts(),
      api.getMeetingWeeklyDigestSettings(),
    ])
      .then(([reminderResult, digestResult]) => {
        if (cancelled) return;

        if (reminderResult.status === "fulfilled") {
          setTextsByOffset(
            normalizeReminderTextsByOffset(reminderResult.value.texts_by_offset)
          );
        }

        if (digestResult.status === "fulfilled") {
          const digest = digestResult.value;
          setWeeklyDigest({
            enabled: !!digest.enabled,
            day_of_week: digest.day_of_week || 7,
            time_local: digest.time_local || "21:00",
            target_ids: normalizeDigestTargetIds(digest.target_ids, telegramTargets),
            template: digest.template?.trim() || DEFAULT_WEEKLY_DIGEST_TEMPLATE,
          });
        }

        const failedMessages: string[] = [];
        if (reminderResult.status === "rejected") {
          const reason = reminderResult.reason;
          failedMessages.push(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить тексты напоминаний"
          );
        }
        if (digestResult.status === "rejected") {
          const reason = digestResult.reason;
          failedMessages.push(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить настройки дайджеста"
          );
        }

        if (failedMessages.length > 0) {
          const message = failedMessages[0];
          setError(message);
          toastError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, telegramTargets, toastError]);

  useEffect(() => {
    setWeeklyDigest((prev) => ({
      ...prev,
      target_ids: normalizeDigestTargetIds(prev.target_ids, telegramTargets),
    }));
  }, [telegramTargets]);

  const setReminderTextForOffset = (offset: number, text: string) => {
    setTextsByOffset((prev) => {
      const key = String(offset);
      const next = { ...prev };
      if (text.trim()) {
        next[key] = text;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const replaceReminderSelection = (replacement: string, cursorOffset = replacement.length) => {
    const textarea = reminderTextRef.current;
    if (!textarea) {
      setReminderTextForOffset(activeReminderOffset, `${activeReminderText}${replacement}`);
      return;
    }
    const start = textarea.selectionStart ?? activeReminderText.length;
    const end = textarea.selectionEnd ?? activeReminderText.length;
    const next = `${activeReminderText.slice(0, start)}${replacement}${activeReminderText.slice(end)}`;
    setReminderTextForOffset(activeReminderOffset, next);
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
    const selected = activeReminderText.slice(start, end) || fallback;
    const next =
      activeReminderText.slice(0, start) +
      openTag +
      selected +
      closeTag +
      activeReminderText.slice(end);
    setReminderTextForOffset(activeReminderOffset, next);
    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + openTag.length;
      const selectionEnd = selectionStart + selected.length;
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const replaceWeeklySelection = (replacement: string, cursorOffset = replacement.length) => {
    const textarea = weeklyTemplateRef.current;
    const currentText = weeklyDigest.template;
    if (!textarea) {
      setWeeklyDigest((prev) => ({ ...prev, template: `${currentText}${replacement}` }));
      return;
    }
    const start = textarea.selectionStart ?? currentText.length;
    const end = textarea.selectionEnd ?? currentText.length;
    const next = `${currentText.slice(0, start)}${replacement}${currentText.slice(end)}`;
    setWeeklyDigest((prev) => ({ ...prev, template: next }));
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + cursorOffset;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const openLinkDialog = () => {
    const textarea = reminderTextRef.current;
    const start = textarea?.selectionStart ?? activeReminderText.length;
    const end = textarea?.selectionEnd ?? activeReminderText.length;
    const selectedText = activeReminderText.slice(start, end).trim();

    setLinkSelection({ start, end });
    setLinkLabel(selectedText || DEFAULT_LINK_LABEL);
    setLinkUrl("{zoom_link}");
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
    const start = Math.max(
      0,
      Math.min(linkSelection?.start ?? activeReminderText.length, activeReminderText.length)
    );
    const end = Math.max(start, Math.min(linkSelection?.end ?? start, activeReminderText.length));
    const next = activeReminderText.slice(0, start) + replacement + activeReminderText.slice(end);
    setReminderTextForOffset(activeReminderOffset, next);
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

  const previewTemplateValues = useMemo(() => {
    const now = new Date();
    const previewDate = now.toLocaleDateString("ru-RU", {
      timeZone: "Europe/Moscow",
    });
    const weekday = now
      .toLocaleDateString("ru-RU", { weekday: "long", timeZone: "Europe/Moscow" })
      .toLowerCase();

    return {
      time: "15:00",
      title: "Планёрка команды",
      date: previewDate,
      weekday,
      participants: "@ivanov @petrova",
      zoomLink: "https://zoom.us/j/1234567890",
    };
  }, []);

  const reminderPreviewWithZoom = useMemo(() => {
    let previewText = activeReminderText.trim()
      ? applyReminderTemplate(activeReminderText.trim(), previewTemplateValues)
      : getDefaultReminderText(activeReminderOffset, {
          time: previewTemplateValues.time,
          title: previewTemplateValues.title,
        });

    if (previewTemplateValues.participants && !hasParticipantsPlaceholder(activeReminderText)) {
      previewText += `\n\n${previewTemplateValues.participants}`;
    }

    if (!hasZoomPlaceholder(activeReminderText)) {
      previewText += `\n\nСсылка для подключения: ${previewTemplateValues.zoomLink}`;
    }

    return previewText;
  }, [activeReminderOffset, activeReminderText, previewTemplateValues]);

  const weeklyDigestPreview = useMemo(() => {
    const meetingsBlock = [
      "<b>Пн 11:00 по мск</b>",
      "Планерка по продажам",
      "@Danil126 @Valentina_Parkosidi @oksigon",
      "",
      "<b>Вт 15:00 по мск</b>",
      "Планерка технического отдела и отдела маркетинга",
      "@TatjanaTsoy @darya_pleshkova @Nasten25",
    ].join("\n");

    const template = weeklyDigest.template.trim() || DEFAULT_WEEKLY_DIGEST_TEMPLATE;
    return applyWeeklyDigestTemplate(template, {
      weekStart: "23.02",
      weekEnd: "01.03",
      weekStartDate: "23.02.2026",
      weekEndDate: "01.03.2026",
      meetingsCount: "2",
      meetings: meetingsBlock,
    });
  }, [weeklyDigest.template]);

  const toggleWeeklyDigestTarget = (targetId: string) => {
    setWeeklyDigest((prev) => ({
      ...prev,
      target_ids: prev.target_ids.includes(targetId)
        ? prev.target_ids.filter((id) => id !== targetId)
        : [...prev.target_ids, targetId],
    }));
  };

  const handleSaveReminders = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateMeetingReminderTexts(normalizeReminderTextsByOffset(textsByOffset));
      toastSuccess("Тексты напоминаний сохранены");
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка сохранения";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWeeklyDigest = async () => {
    if (weeklyDigest.enabled && weeklyDigest.target_ids.length === 0) {
      setError("Выберите хотя бы одну Telegram-группу для недельного дайджеста");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await api.updateMeetingWeeklyDigestSettings({
        enabled: weeklyDigest.enabled,
        day_of_week: weeklyDigest.day_of_week,
        time_local: weeklyDigest.time_local,
        target_ids: weeklyDigest.target_ids,
        template: weeklyDigest.template.trim() || DEFAULT_WEEKLY_DIGEST_TEMPLATE,
      });
      setWeeklyDigest((prev) => ({
        ...prev,
        enabled: saved.enabled,
        day_of_week: saved.day_of_week,
        time_local: saved.time_local,
        target_ids: normalizeDigestTargetIds(saved.target_ids, telegramTargets),
        template: saved.template?.trim() || DEFAULT_WEEKLY_DIGEST_TEMPLATE,
      }));
      toastSuccess("Настройки недельного дайджеста сохранены");
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка сохранения";
      setError(message);
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (activeTab === "weekly") {
      await handleSaveWeeklyDigest();
      return;
    }
    await handleSaveReminders();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[92vh] sm:min-h-[640px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Сообщения по встречам</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Настройте оперативные напоминания перед встречами и отдельный недельный дайджест.
          </p>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "reminders" | "weekly")}
          >
            <TabsList className="w-full rounded-xl">
              <TabsTrigger value="reminders" className="rounded-lg">
                Перед встречей
              </TabsTrigger>
              <TabsTrigger value="weekly" className="rounded-lg">
                Дайджест на неделю
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reminders" className="mt-4">
              {loading ? (
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-2xs text-muted-foreground">Тайминг</Label>
                      <Skeleton className="h-9 w-full rounded-lg" />
                    </div>
                    <Skeleton className="h-11 w-full rounded-xl" />
                    <Skeleton className="h-[250px] w-full rounded-xl" />
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card p-4">
                    <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      Предпросмотр
                    </div>
                    <div className="max-h-[420px] overflow-auto rounded-xl border border-border/40 bg-muted/20 p-4">
                      <Skeleton className="ml-auto h-[130px] w-[95%] rounded-2xl" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-2xs text-muted-foreground">Тайминг</Label>
                      <Select
                        value={String(activeReminderOffset)}
                        onValueChange={(value) => setActiveReminderOffset(Number(value))}
                      >
                        <SelectTrigger className="h-9 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REMINDER_OPTIONS.map((offset) => (
                            <SelectItem key={offset} value={String(offset)}>
                              {formatReminderOffsetLabel(offset)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

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
                          onClick={() =>
                            wrapReminderSelection("<tg-spoiler>", "</tg-spoiler>", "спойлер")
                          }
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
                      value={activeReminderText}
                      onChange={(e) =>
                        setReminderTextForOffset(activeReminderOffset, e.target.value)
                      }
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const token = e.dataTransfer.getData("text/reminder-variable");
                        if (token) {
                          replaceReminderSelection(token);
                        }
                      }}
                      placeholder={getDefaultReminderText(activeReminderOffset, {
                        time: "{время}",
                        title: "{название}",
                      })}
                      rows={11}
                      className="rounded-xl text-sm font-body"
                    />

                    <div>
                      <Label className="text-2xs text-muted-foreground">Переменные</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {REMINDER_TEMPLATE_VARIABLES.map((item) => (
                          <button
                            key={item.token}
                            type="button"
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData("text/reminder-variable", item.token)
                            }
                            onClick={() => replaceReminderSelection(item.token)}
                            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1 text-2xs hover:border-border transition-colors"
                          >
                            <span className="text-muted-foreground">{item.label}</span>
                            <code className="font-mono text-[10px]">{item.token}</code>
                          </button>
                        ))}
                      </div>
                      <p className="text-2xs text-muted-foreground/60 mt-1">
                        Можно использовать HTML, например{" "}
                        <code className="font-mono">{`<a href="{zoom_link}">Подключиться ↗</a>`}</code>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card p-4">
                    <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      {`Предпросмотр (${formatReminderOffsetLabel(activeReminderOffset)})`}
                    </div>
                    <div className="max-h-[420px] overflow-auto rounded-xl border border-border/40 bg-muted/20 p-4">
                      <div
                        className="ml-auto max-w-[96%] rounded-2xl bg-primary/10 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
                        dangerouslySetInnerHTML={renderTelegramHtmlPreview(reminderPreviewWithZoom)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="weekly" className="mt-4">
              {loading ? (
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-[260px] w-full rounded-xl" />
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-card p-4">
                    <Skeleton className="h-[280px] w-full rounded-xl" />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Авто-дайджест встреч</p>
                          <p className="text-2xs text-muted-foreground mt-0.5">
                            Отправка обзора встреч на следующую неделю в выбранные Telegram-группы
                          </p>
                        </div>
                        <Switch
                          checked={weeklyDigest.enabled}
                          onCheckedChange={(checked) =>
                            setWeeklyDigest((prev) => ({ ...prev, enabled: checked }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-2xs text-muted-foreground">День отправки</Label>
                        <Select
                          value={String(weeklyDigest.day_of_week)}
                          onValueChange={(value) =>
                            setWeeklyDigest((prev) => ({
                              ...prev,
                              day_of_week: Number(value),
                            }))
                          }
                        >
                          <SelectTrigger className="mt-1.5 rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WEEKLY_DIGEST_DAY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={String(option.value)}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-2xs text-muted-foreground">Время отправки (МСК)</Label>
                        <TimePicker
                          value={weeklyDigest.time_local}
                          onChange={(value) =>
                            setWeeklyDigest((prev) => ({
                              ...prev,
                              time_local: value,
                            }))
                          }
                          className="mt-1.5 w-full rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-2xs text-muted-foreground">Telegram-группы</Label>
                      {telegramTargets.length === 0 ? (
                        <p className="text-2xs text-muted-foreground/70 mt-1">
                          Нет настроенных групп. Добавьте их в «Настройки → Telegram-группы».
                        </p>
                      ) : (
                        <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl border border-border/60 bg-muted/15 p-2 space-y-1.5">
                          {telegramTargets.map((target) => {
                            const selected = weeklyDigest.target_ids.includes(target.id);
                            return (
                              <button
                                key={target.id}
                                type="button"
                                onClick={() => toggleWeeklyDigestTarget(target.id)}
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

                    <div>
                      <Label className="text-2xs text-muted-foreground">Шаблон дайджеста</Label>
                      <Textarea
                        ref={weeklyTemplateRef}
                        value={weeklyDigest.template}
                        onChange={(e) =>
                          setWeeklyDigest((prev) => ({
                            ...prev,
                            template: e.target.value,
                          }))
                        }
                        rows={10}
                        className="mt-1.5 rounded-xl text-sm font-body"
                        placeholder={DEFAULT_WEEKLY_DIGEST_TEMPLATE}
                      />
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {WEEKLY_DIGEST_VARIABLES.map((item) => (
                          <button
                            key={item.token}
                            type="button"
                            onClick={() => replaceWeeklySelection(item.token)}
                            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card px-2 py-1 text-2xs hover:border-border transition-colors"
                          >
                            <span className="text-muted-foreground">{item.label}</span>
                            <code className="font-mono text-[10px]">{item.token}</code>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card p-4">
                    <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      Предпросмотр дайджеста
                    </div>
                    <div className="max-h-[520px] overflow-auto rounded-xl border border-border/40 bg-muted/20 p-4">
                      <div
                        className="ml-auto max-w-[96%] rounded-2xl bg-primary/10 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
                        dangerouslySetInnerHTML={renderTelegramHtmlPreview(weeklyDigestPreview)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || loading}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : activeTab === "weekly" ? (
                "Сохранить дайджест"
              ) : (
                "Сохранить напоминания"
              )}
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
              <Label htmlFor="global-reminder-link-url">URL</Label>
              <Input
                id="global-reminder-link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="{zoom_link} или https://example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="global-reminder-link-label">Текст ссылки</Label>
              <Input
                id="global-reminder-link-label"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder={DEFAULT_LINK_LABEL}
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
    </>
  );
}
