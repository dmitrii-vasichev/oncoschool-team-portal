"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Clock3,
  Code2,
  Eye,
  Italic,
  Link2,
  Loader2,
  Megaphone,
  Send,
  Smile,
  Strikethrough,
  Underline,
} from "lucide-react";

import { ModeratorGuard } from "@/components/shared/ModeratorGuard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { DatePicker } from "@/components/shared/DatePicker";
import { TimePicker } from "@/components/shared/TimePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { parseUTCDate } from "@/lib/dateUtils";
import { zonedDateTimeToUtcIso } from "@/lib/meetingDateTime";
import { api } from "@/lib/api";
import {
  TELEGRAM_BROADCAST_STATUS_LABELS,
  type TelegramBroadcast,
  type TelegramBroadcastStatus,
  type TelegramNotificationTarget,
} from "@/lib/types";

type StatusFilter = "all" | TelegramBroadcastStatus;
type LinkSelection = { start: number; end: number };
type PendingBroadcastAction =
  | { type: "send_now"; broadcast: TelegramBroadcast }
  | { type: "cancel"; broadcast: TelegramBroadcast };

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

const STATUS_BADGE_CLASS: Record<TelegramBroadcastStatus, string> = {
  scheduled: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  sent: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border/60",
};

function formatDateValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimeValue(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function getDefaultSchedule() {
  const date = new Date(Date.now() + 5 * 60_000);
  date.setSeconds(0, 0);
  return {
    date: formatDateValue(date),
    time: formatTimeValue(date),
  };
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderNode(node: ChildNode, key: string): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes).map((child, idx) =>
    renderNode(child, `${key}-${idx}`)
  );

  switch (tag) {
    case "b":
    case "strong":
      return <strong key={key}>{children}</strong>;
    case "i":
    case "em":
      return <em key={key}>{children}</em>;
    case "u":
    case "ins":
      return <u key={key}>{children}</u>;
    case "s":
    case "strike":
    case "del":
      return <s key={key}>{children}</s>;
    case "code":
      return (
        <code key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {children}
        </code>
      );
    case "pre":
      return (
        <pre
          key={key}
          className="mt-2 overflow-x-auto rounded-lg bg-muted p-2.5 font-mono text-xs"
        >
          {children}
        </pre>
      );
    case "tg-spoiler":
      return (
        <span
          key={key}
          className="rounded bg-foreground/15 px-1.5 text-transparent select-none"
          title="Спойлер"
        >
          {children}
        </span>
      );
    case "a": {
      const href = element.getAttribute("href") || "";
      const safeHref = /^https?:\/\//i.test(href) ? href : null;
      if (!safeHref) {
        return <span key={key}>{children}</span>;
      }
      return (
        <a
          key={key}
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          {children}
        </a>
      );
    }
    case "br":
      return <br key={key} />;
    default:
      return <span key={key}>{children}</span>;
  }
}

function TelegramPreview({ messageHtml }: { messageHtml: string }) {
  const nodes = useMemo(() => {
    if (!messageHtml.trim()) {
      return (
        <span className="text-muted-foreground">
          Добавьте текст сообщения, чтобы увидеть предпросмотр.
        </span>
      );
    }

    if (typeof window === "undefined") {
      return messageHtml;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${messageHtml}</div>`, "text/html");
    const root = doc.body.firstElementChild;

    if (!root) {
      return messageHtml;
    }

    return Array.from(root.childNodes).map((node, idx) =>
      renderNode(node, `preview-${idx}`)
    );
  }, [messageHtml]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
        <Eye className="h-3.5 w-3.5" />
        Предпросмотр
      </div>
      <div className="max-h-[360px] overflow-auto rounded-xl border border-border/40 bg-muted/20 p-4">
        <div className="ml-auto max-w-[92%] rounded-2xl bg-primary/10 px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {nodes}
        </div>
      </div>
    </div>
  );
}

export default function BroadcastsPage() {
  const { toastSuccess, toastError } = useToast();
  const messageRef = useRef<HTMLTextAreaElement | null>(null);

  const [targets, setTargets] = useState<TelegramNotificationTarget[]>([]);
  const [broadcasts, setBroadcasts] = useState<TelegramBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<"schedule" | "now" | null>(null);
  const [sendingBroadcastId, setSendingBroadcastId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [pendingAction, setPendingAction] = useState<PendingBroadcastAction | null>(null);

  const defaultSchedule = useMemo(() => getDefaultSchedule(), []);
  const [targetId, setTargetId] = useState("");
  const [messageHtml, setMessageHtml] = useState("");
  const [scheduledDate, setScheduledDate] = useState(defaultSchedule.date);
  const [scheduledTime, setScheduledTime] = useState(defaultSchedule.time);
  const scheduledTimezone = "Europe/Moscow";
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkSelection, setLinkSelection] = useState<LinkSelection | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [targetList, broadcastList] = await Promise.all([
        api.getTelegramTargets(),
        api.getTelegramBroadcasts({
          status: filter === "all" ? undefined : filter,
          limit: 100,
        }),
      ]);
      setTargets(targetList);
      setBroadcasts(broadcastList);
      setTargetId((prev) => (prev ? prev : (targetList[0]?.id ?? "")));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Не удалось загрузить рассылки");
    } finally {
      setLoading(false);
    }
  }, [filter, toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const replaceSelection = (replacement: string, cursorOffset = replacement.length) => {
    const textarea = messageRef.current;
    if (!textarea) {
      setMessageHtml((prev) => prev + replacement);
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;

    const next =
      messageHtml.slice(0, start) + replacement + messageHtml.slice(end);
    setMessageHtml(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + cursorOffset;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const wrapSelection = (openTag: string, closeTag: string, fallback = "текст") => {
    const textarea = messageRef.current;
    if (!textarea) {
      replaceSelection(`${openTag}${fallback}${closeTag}`);
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = messageHtml.slice(start, end) || fallback;
    const next =
      messageHtml.slice(0, start) +
      openTag +
      selected +
      closeTag +
      messageHtml.slice(end);

    setMessageHtml(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + openTag.length;
      const selectionEnd = selectionStart + selected.length;
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const openLinkDialog = () => {
    const textarea = messageRef.current;
    const start = textarea?.selectionStart ?? messageHtml.length;
    const end = textarea?.selectionEnd ?? messageHtml.length;
    const selectedText = messageHtml.slice(start, end).trim();

    setLinkSelection({ start, end });
    setLinkLabel(selectedText || "");
    setLinkUrl("https://");
    setLinkDialogOpen(true);
  };

  const handleInsertLink = () => {
    const href = linkUrl.trim();
    if (!/^https?:\/\//i.test(href)) {
      toastError("URL должен начинаться с http:// или https://");
      return;
    }

    const label = linkLabel.trim() || "ссылка";
    const replacement = `<a href="${href}">${label}</a>`;
    const start = Math.max(0, Math.min(linkSelection?.start ?? messageHtml.length, messageHtml.length));
    const end = Math.max(start, Math.min(linkSelection?.end ?? start, messageHtml.length));
    const next = messageHtml.slice(0, start) + replacement + messageHtml.slice(end);
    setMessageHtml(next);
    setLinkDialogOpen(false);

    const textarea = messageRef.current;
    if (textarea) {
      requestAnimationFrame(() => {
        textarea.focus();
        const caret = start + `<a href="${href}">`.length + label.length;
        textarea.setSelectionRange(caret, caret);
      });
    }
  };

  const handleCreate = async () => {
    if (!targetId) {
      toastError("Выберите группу");
      return;
    }

    if (!messageHtml.trim()) {
      toastError("Введите текст сообщения");
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      toastError("Укажите дату и время отправки");
      return;
    }

    setSavingAction("schedule");
    try {
      await api.createTelegramBroadcast({
        target_id: targetId,
        message_html: messageHtml.trim(),
        scheduled_at: zonedDateTimeToUtcIso(
          scheduledDate,
          scheduledTime,
          scheduledTimezone
        ),
      });

      toastSuccess("Рассылка запланирована");
      setMessageHtml("");
      const next = getDefaultSchedule();
      setScheduledDate(next.date);
      setScheduledTime(next.time);
      await fetchData();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка при создании рассылки");
    } finally {
      setSavingAction(null);
    }
  };

  const handleSendNow = async () => {
    if (!targetId) {
      toastError("Выберите группу");
      return;
    }

    if (!messageHtml.trim()) {
      toastError("Введите текст сообщения");
      return;
    }

    setSavingAction("now");
    try {
      const result = await api.createTelegramBroadcast({
        target_id: targetId,
        message_html: messageHtml.trim(),
        send_now: true,
      });

      if (result.status === "failed") {
        toastError(
          result.error_message
            ? `Ошибка отправки: ${result.error_message}`
            : "Не удалось отправить рассылку"
        );
      } else {
        toastSuccess("Рассылка отправлена");
        setMessageHtml("");
      }

      await fetchData();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка отправки рассылки");
    } finally {
      setSavingAction(null);
    }
  };

  const requestSendScheduledNow = (broadcast: TelegramBroadcast) => {
    setPendingAction({ type: "send_now", broadcast });
  };

  const requestCancelBroadcast = (broadcast: TelegramBroadcast) => {
    setPendingAction({ type: "cancel", broadcast });
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) {
      return;
    }

    const action = pendingAction;
    setPendingAction(null);

    if (action.type === "send_now") {
      setSendingBroadcastId(action.broadcast.id);
      try {
        const result = await api.sendNowTelegramBroadcast(action.broadcast.id);
        if (result.status === "failed") {
          toastError(
            result.error_message
              ? `Ошибка отправки: ${result.error_message}`
              : "Не удалось отправить рассылку"
          );
        } else {
          toastSuccess("Рассылка отправлена");
        }
        await fetchData();
      } catch (e) {
        toastError(e instanceof Error ? e.message : "Ошибка отправки рассылки");
      } finally {
        setSendingBroadcastId(null);
      }
      return;
    }

    try {
      await api.cancelTelegramBroadcast(action.broadcast.id);
      toastSuccess("Рассылка отменена");
      await fetchData();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка отмены");
    }
  };

  return (
    <ModeratorGuard>
      <div className="space-y-6 max-w-6xl animate-in fade-in duration-300">
        <section className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-heading text-lg font-semibold">Рассылки в Telegram</h1>
                <p className="text-sm text-muted-foreground">
                  Планируйте информационные сообщения в группы и проверяйте формат перед отправкой.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Время отправки по{" "}
              <span className="font-medium text-foreground">МСК</span>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Группа
                </Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Выберите группу" />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.label || `Chat ${target.chat_id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targets.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Нет доступных групп. Администратор может добавить их в разделе /settings.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Сообщение
                  </Label>
                  <div className="text-xs text-muted-foreground">
                    {messageHtml.length} / 4096
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => wrapSelection("<b>", "</b>", "жирный")}
                      title="Жирный"
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => wrapSelection("<i>", "</i>", "курсив")}
                      title="Курсив"
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => wrapSelection("<u>", "</u>", "подчеркнуто")}
                      title="Подчеркнутый"
                    >
                      <Underline className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => wrapSelection("<s>", "</s>", "зачеркнуто")}
                      title="Зачеркнутый"
                    >
                      <Strikethrough className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => wrapSelection("<code>", "</code>", "код")}
                      title="Код"
                    >
                      <Code2 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => wrapSelection("<tg-spoiler>", "</tg-spoiler>", "спойлер")}
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
                              onClick={() => replaceSelection(emoji)}
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
                  ref={messageRef}
                  value={messageHtml}
                  onChange={(e) => setMessageHtml(e.target.value)}
                  placeholder="Введите сообщение для Telegram..."
                  className="min-h-[220px] rounded-xl font-body"
                />

                <p className="text-xs text-muted-foreground">
                  Поддерживаются Telegram HTML-теги: b, i, u, s, code, pre, a, tg-spoiler.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Дата отправки
                  </Label>
                  <DatePicker
                    value={scheduledDate}
                    onChange={setScheduledDate}
                    className="mt-1.5 w-full rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Время отправки (МСК)
                  </Label>
                  <TimePicker
                    value={scheduledTime}
                    onChange={setScheduledTime}
                    className="mt-1.5 w-full rounded-xl"
                    minuteStep={5}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  className="w-full rounded-xl"
                  onClick={handleCreate}
                  disabled={savingAction !== null || targets.length === 0}
                >
                  {savingAction === "schedule" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Планирование...
                    </>
                  ) : (
                    <>
                      <Clock3 className="mr-2 h-4 w-4" />
                      Запланировать рассылку
                    </>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full rounded-xl"
                  onClick={handleSendNow}
                  disabled={savingAction !== null || targets.length === 0}
                >
                  {savingAction === "now" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Отправить сейчас
                    </>
                  )}
                </Button>
              </div>
            </div>
          </section>

          <TelegramPreview messageHtml={messageHtml} />
        </div>

        <section className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-base font-semibold">История рассылок</h2>
              <p className="text-xs text-muted-foreground">
                Последние 100 сообщений с текущими статусами доставки.
              </p>
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full rounded-xl sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="scheduled">Запланировано</SelectItem>
                <SelectItem value="sent">Отправлено</SelectItem>
                <SelectItem value="failed">Ошибка</SelectItem>
                <SelectItem value="cancelled">Отменено</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, idx) => (
                <Skeleton key={idx} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Рассылок пока нет.
            </div>
          ) : (
            <div className="space-y-2">
              {broadcasts.map((broadcast) => {
                const scheduleDate = parseUTCDate(broadcast.scheduled_at);
                const sentDate = broadcast.sent_at ? parseUTCDate(broadcast.sent_at) : null;
                const messagePreview = stripHtmlTags(broadcast.message_html);

                return (
                  <div
                    key={broadcast.id}
                    className="rounded-xl border border-border/60 p-4 hover:border-border transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {broadcast.target_label || `Chat ${broadcast.chat_id}`}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-2xs font-medium ${STATUS_BADGE_CLASS[broadcast.status]}`}
                          >
                            {TELEGRAM_BROADCAST_STATUS_LABELS[broadcast.status]}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                          Запланировано: {scheduleDate.toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {sentDate && (
                            <>
                              {" · "}
                              Отправлено: {sentDate.toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </>
                          )}
                        </p>

                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {messagePreview || "Пустое сообщение"}
                        </p>

                        {broadcast.error_message && (
                          <p className="mt-2 text-xs text-destructive">
                            Ошибка: {broadcast.error_message}
                          </p>
                        )}
                      </div>

                      {broadcast.status === "scheduled" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            className="rounded-lg"
                            onClick={() => requestSendScheduledNow(broadcast)}
                            disabled={sendingBroadcastId === broadcast.id}
                          >
                            {sendingBroadcastId === broadcast.id ? (
                              <>
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                Отправка...
                              </>
                            ) : (
                              <>
                                <Send className="mr-1.5 h-3.5 w-3.5" />
                                Отправить сейчас
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            onClick={() => requestCancelBroadcast(broadcast)}
                            disabled={sendingBroadcastId === broadcast.id}
                          >
                            Отменить
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">Добавить ссылку</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-link-url">URL</Label>
              <Input
                id="broadcast-link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="broadcast-link-label">Текст ссылки</Label>
              <Input
                id="broadcast-link-label"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="ссылка"
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

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
          }
        }}
        title={
          pendingAction?.type === "send_now"
            ? "Отправить рассылку сейчас?"
            : "Отменить рассылку?"
        }
        description={
          pendingAction?.type === "send_now"
            ? "Сообщение будет отправлено немедленно и статус изменится на 'Отправлено'."
            : "Рассылка не будет отправлена по расписанию и получит статус 'Отменено'."
        }
        confirmLabel={pendingAction?.type === "send_now" ? "Отправить" : "Отменить рассылку"}
        cancelLabel="Назад"
        variant={pendingAction?.type === "send_now" ? "default" : "destructive"}
        onConfirm={handleConfirmPendingAction}
      />
    </ModeratorGuard>
  );
}
