"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import {
  Bold,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Eye,
  ImagePlus,
  Italic,
  Link2,
  Loader2,
  Megaphone,
  Send,
  Smile,
  Strikethrough,
  Underline,
  Users,
  X,
} from "lucide-react";

import { ModeratorGuard } from "@/components/shared/ModeratorGuard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/shared/Toast";
import { DatePicker } from "@/components/shared/DatePicker";
import { TimePicker } from "@/components/shared/TimePicker";
import { Badge } from "@/components/ui/badge";
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
  ROLE_LABELS,
  TELEGRAM_BROADCAST_STATUS_LABELS,
  type Department,
  type MemberRole,
  type TeamMember,
  type TelegramBroadcast,
  type TelegramBroadcastStatus,
  type TelegramNotificationTarget,
} from "@/lib/types";

type StatusFilter = "all" | TelegramBroadcastStatus;
type LinkSelection = { start: number; end: number };
type ParticipantGroupMode = "role" | "department";
type PendingBroadcastAction =
  | { type: "send_now"; broadcast: TelegramBroadcast }
  | { type: "cancel"; broadcast: TelegramBroadcast };

interface ParticipantGroup {
  id: string;
  name: string;
  sortOrder: number;
  accentColor: string;
  members: TeamMember[];
}

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

const MAX_TELEGRAM_MESSAGE_LEN = 4096;
const MAX_TELEGRAM_CAPTION_LEN = 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ROLE_ORDER: MemberRole[] = ["admin", "moderator", "member"];
const ROLE_ACCENT_COLOR: Record<MemberRole, string> = {
  admin: "#9333EA",
  moderator: "#D97706",
  member: "#6B7280",
};
const GROUP_WITHOUT_DEPARTMENT = "__without_department__";
const GROUP_UNKNOWN_DEPARTMENT = "__unknown_department__";

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

function normalizeTelegramUsername(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/^@+/, "");
  return cleaned || null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
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

function TelegramPreview({
  messageHtml,
  imagePreviewUrl,
}: {
  messageHtml: string;
  imagePreviewUrl: string | null;
}) {
  const nodes = useMemo(() => {
    if (!messageHtml.trim()) {
      return null;
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

  const hasAnyContent = !!imagePreviewUrl || !!messageHtml.trim();

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
        <Eye className="h-3.5 w-3.5" />
        Предпросмотр
      </div>
      <div className="max-h-[520px] overflow-auto rounded-xl border border-border/40 bg-muted/20 p-4">
        {!hasAnyContent ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">
            Добавьте текст и при необходимости прикрепите картинку, чтобы увидеть итог.
          </div>
        ) : (
          <div className="ml-auto max-w-[92%] overflow-hidden rounded-2xl bg-primary/10 text-sm leading-relaxed break-words">
            {imagePreviewUrl && (
              <Image
                src={imagePreviewUrl}
                alt="Вложение"
                width={1280}
                height={720}
                unoptimized
                className="max-h-[320px] w-full object-cover"
              />
            )}
            {nodes && (
              <div className="px-3.5 py-2.5 whitespace-pre-wrap">
                {nodes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BroadcastsPage() {
  const { toastSuccess, toastError } = useToast();
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [targets, setTargets] = useState<TelegramNotificationTarget[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [broadcasts, setBroadcasts] = useState<TelegramBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<"schedule" | "now" | null>(null);
  const [sendingBroadcastId, setSendingBroadcastId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [pendingAction, setPendingAction] = useState<PendingBroadcastAction | null>(null);

  const defaultSchedule = useMemo(() => getDefaultSchedule(), []);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [participantGroupMode, setParticipantGroupMode] = useState<ParticipantGroupMode>("role");
  const [expandedParticipantGroups, setExpandedParticipantGroups] = useState<Record<string, boolean>>({});
  const [participantQuery, setParticipantQuery] = useState("");
  const [messageHtml, setMessageHtml] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
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
      const [targetList, teamList, departmentList, broadcastList] = await Promise.all([
        api.getTelegramTargets(),
        api.getTeam(),
        api.getDepartments(),
        api.getTelegramBroadcasts({
          status: filter === "all" ? undefined : filter,
          limit: 100,
        }),
      ]);

      setTargets(targetList);
      setMembers(teamList.filter((member) => member.is_active));
      setDepartments(departmentList);
      setBroadcasts(broadcastList);

      setSelectedTargetIds((prev) => {
        const valid = prev.filter((id) => targetList.some((target) => target.id === id));
        if (valid.length > 0) return valid;
        return targetList[0] ? [targetList[0].id] : [];
      });

      setSelectedParticipantIds((prev) =>
        prev.filter((id) =>
          teamList.some((member) => member.id === id && member.is_active)
        )
      );
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Не удалось загрузить рассылки");
    } finally {
      setLoading(false);
    }
  }, [filter, toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile]);

  const mentionableMembers = useMemo(() => {
    return members.filter((member) => normalizeTelegramUsername(member.telegram_username));
  }, [members]);

  const selectedParticipantSet = useMemo(
    () => new Set(selectedParticipantIds),
    [selectedParticipantIds]
  );

  const selectedParticipants = useMemo(() => {
    return mentionableMembers.filter((member) => selectedParticipantSet.has(member.id));
  }, [mentionableMembers, selectedParticipantSet]);

  const mentionLine = useMemo(() => {
    const seen = new Set<string>();
    const handles: string[] = [];

    for (const member of selectedParticipants) {
      const username = normalizeTelegramUsername(member.telegram_username);
      if (!username || seen.has(username)) continue;
      seen.add(username);
      handles.push(`@${username}`);
    }

    return handles.join(" ");
  }, [selectedParticipants]);

  const composedMessageHtml = useMemo(() => {
    const parts: string[] = [];
    if (mentionLine) {
      parts.push(mentionLine);
    }

    const textPart = messageHtml.trim();
    if (textPart) {
      parts.push(textPart);
    }

    return parts.join("\n\n").trim();
  }, [mentionLine, messageHtml]);

  const messageLimit = imageFile ? MAX_TELEGRAM_CAPTION_LEN : MAX_TELEGRAM_MESSAGE_LEN;
  const messageTooLong = composedMessageHtml.length > messageLimit;

  const departmentById = useMemo(() => {
    return new Map(departments.map((department) => [department.id, department]));
  }, [departments]);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = participantQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return mentionableMembers;
    }

    return mentionableMembers.filter((member) => {
      const fullName = member.full_name.toLowerCase();
      const username = normalizeTelegramUsername(member.telegram_username) || "";
      const position = member.position?.toLowerCase() || "";
      const roleLabel = ROLE_LABELS[member.role].toLowerCase();
      const departmentName = member.department_id
        ? (departmentById.get(member.department_id)?.name || "Отдел не найден").toLowerCase()
        : "без отдела";
      return (
        fullName.includes(normalizedQuery) ||
        username.includes(normalizedQuery) ||
        position.includes(normalizedQuery) ||
        roleLabel.includes(normalizedQuery) ||
        departmentName.includes(normalizedQuery)
      );
    });
  }, [departmentById, mentionableMembers, participantQuery]);

  const participantGroups = useMemo(() => {
    const groupsById = new Map<string, ParticipantGroup>();

    for (const member of filteredMembers) {
      let groupId = "";
      let groupName = "";
      let sortOrder = 0;
      let accentColor = "#6B7280";

      if (participantGroupMode === "role") {
        groupId = `role:${member.role}`;
        groupName = ROLE_LABELS[member.role];
        sortOrder = ROLE_ORDER.indexOf(member.role);
        accentColor = ROLE_ACCENT_COLOR[member.role];
      } else if (!member.department_id) {
        groupId = GROUP_WITHOUT_DEPARTMENT;
        groupName = "Без отдела";
        sortOrder = Number.MAX_SAFE_INTEGER - 1;
      } else {
        const department = departmentById.get(member.department_id);
        if (department) {
          groupId = `department:${department.id}`;
          groupName = department.name;
          sortOrder = department.sort_order;
          accentColor = department.color || accentColor;
        } else {
          groupId = GROUP_UNKNOWN_DEPARTMENT;
          groupName = "Отдел не найден";
          sortOrder = Number.MAX_SAFE_INTEGER;
        }
      }

      const existing = groupsById.get(groupId);
      if (existing) {
        existing.members.push(member);
      } else {
        groupsById.set(groupId, {
          id: groupId,
          name: groupName,
          sortOrder,
          accentColor,
          members: [member],
        });
      }
    }

    return Array.from(groupsById.values())
      .map((group) => ({
        ...group,
        members: [...group.members].sort((a, b) =>
          a.full_name.localeCompare(b.full_name, "ru", { sensitivity: "base" })
        ),
      }))
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
      });
  }, [departmentById, filteredMembers, participantGroupMode]);

  useEffect(() => {
    setExpandedParticipantGroups((prev) => {
      const queryActive = participantQuery.trim().length > 0;
      const nextState: Record<string, boolean> = {};

      for (const group of participantGroups) {
        if (queryActive) {
          nextState[group.id] = true;
          continue;
        }

        if (typeof prev[group.id] === "boolean") {
          nextState[group.id] = prev[group.id];
          continue;
        }

        const hasSelected = group.members.some((member) =>
          selectedParticipantSet.has(member.id)
        );
        nextState[group.id] = hasSelected || participantGroups.length <= 4;
      }

      return nextState;
    });
  }, [participantGroups, participantQuery, selectedParticipantSet]);

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

  const toggleTarget = (targetId: string) => {
    setSelectedTargetIds((prev) =>
      prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId]
    );
  };

  const toggleParticipant = (memberId: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const selectParticipants = (memberIds: string[]) => {
    if (memberIds.length === 0) return;
    setSelectedParticipantIds((prev) => {
      const merged = new Set([...prev, ...memberIds]);
      return Array.from(merged);
    });
  };

  const deselectParticipants = (memberIds: string[]) => {
    if (memberIds.length === 0) return;
    const idsToRemove = new Set(memberIds);
    setSelectedParticipantIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
  };

  const toggleParticipantGroup = (groupId: string) => {
    setExpandedParticipantGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const expandAllParticipantGroups = () => {
    const nextState = Object.fromEntries(
      participantGroups.map((group) => [group.id, true])
    );
    setExpandedParticipantGroups(nextState);
  };

  const collapseAllParticipantGroups = () => {
    const nextState = Object.fromEntries(
      participantGroups.map((group) => [group.id, false])
    );
    setExpandedParticipantGroups(nextState);
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
    const start = Math.max(
      0,
      Math.min(linkSelection?.start ?? messageHtml.length, messageHtml.length)
    );
    const end = Math.max(
      start,
      Math.min(linkSelection?.end ?? start, messageHtml.length)
    );

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

  const handleSelectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toastError("Можно прикрепить только изображение");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toastError("Картинка слишком большая (максимум 10 МБ)");
      return;
    }

    setImageFile(file);
  };

  const handleCreate = async () => {
    if (selectedTargetIds.length === 0) {
      toastError("Выберите хотя бы одну группу");
      return;
    }

    if (!composedMessageHtml) {
      toastError("Введите текст сообщения");
      return;
    }

    if (messageTooLong) {
      toastError(
        imageFile
          ? "С картинкой Telegram поддерживает до 1024 символов подписи"
          : `Сообщение слишком длинное (максимум ${MAX_TELEGRAM_MESSAGE_LEN} символов)`
      );
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      toastError("Укажите дату и время отправки");
      return;
    }

    setSavingAction("schedule");
    try {
      const created = await api.createTelegramBroadcastBatch({
        targetIds: selectedTargetIds,
        messageHtml: composedMessageHtml,
        scheduledAt: zonedDateTimeToUtcIso(
          scheduledDate,
          scheduledTime,
          scheduledTimezone
        ),
        sendNow: false,
        imageFile,
      });

      toastSuccess(`Рассылка запланирована в ${created.length} групп(ы)`);
      setMessageHtml("");
      setImageFile(null);
      setSelectedParticipantIds([]);
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
    if (selectedTargetIds.length === 0) {
      toastError("Выберите хотя бы одну группу");
      return;
    }

    if (!composedMessageHtml) {
      toastError("Введите текст сообщения");
      return;
    }

    if (messageTooLong) {
      toastError(
        imageFile
          ? "С картинкой Telegram поддерживает до 1024 символов подписи"
          : `Сообщение слишком длинное (максимум ${MAX_TELEGRAM_MESSAGE_LEN} символов)`
      );
      return;
    }

    setSavingAction("now");
    try {
      const result = await api.createTelegramBroadcastBatch({
        targetIds: selectedTargetIds,
        messageHtml: composedMessageHtml,
        sendNow: true,
        imageFile,
      });

      const sentCount = result.filter((item) => item.status === "sent").length;
      const failed = result.filter((item) => item.status === "failed");

      if (sentCount > 0) {
        toastSuccess(`Рассылка отправлена в ${sentCount} групп(ы)`);
        setMessageHtml("");
        setImageFile(null);
        setSelectedParticipantIds([]);
      }

      if (failed.length > 0) {
        const failedLabels = failed
          .map((item) => item.target_label || `Chat ${item.chat_id}`)
          .slice(0, 4);
        const suffix = failed.length > failedLabels.length ? "…" : "";
        toastError(`Ошибка в ${failed.length} групп(е): ${failedLabels.join(", ")}${suffix}`);
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
                  Планируйте рассылки или отправляйте сразу в несколько групп,
                  добавляйте теги участников и предпросматривайте итоговое сообщение.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Время отправки по <span className="font-medium text-foreground">МСК</span>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Группы Telegram (мультивыбор)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => setSelectedTargetIds(targets.map((target) => target.id))}
                      disabled={targets.length === 0}
                    >
                      Выбрать все
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => setSelectedTargetIds([])}
                      disabled={selectedTargetIds.length === 0}
                    >
                      Очистить
                    </Button>
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto rounded-xl border border-border/60 bg-muted/15 p-2 space-y-1.5">
                  {loading ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">Загрузка групп...</p>
                  ) : targets.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                      Нет доступных групп. Администратор может добавить их в разделе /settings.
                    </p>
                  ) : (
                    targets.map((target) => {
                      const checked = selectedTargetIds.includes(target.id);
                      return (
                        <label
                          key={target.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTarget(target.id)}
                            className="h-4 w-4 rounded border-border"
                          />
                          <span className="text-sm">{target.label || `Chat ${target.chat_id}`}</span>
                          {target.thread_id ? (
                            <span className="text-xs text-muted-foreground">· topic {target.thread_id}</span>
                          ) : null}
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Выбрано групп: {selectedTargetIds.length}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Участники для тегов (@username)
                  </Label>
                </div>

                <Input
                  value={participantQuery}
                  onChange={(e) => setParticipantQuery(e.target.value)}
                  placeholder="Поиск по имени, username, должности, роли или отделу"
                  className="rounded-xl"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center rounded-lg border border-border/60 bg-muted/20 p-0.5">
                    <button
                      type="button"
                      onClick={() => setParticipantGroupMode("role")}
                      className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                        participantGroupMode === "role"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      По ролям
                    </button>
                    <button
                      type="button"
                      onClick={() => setParticipantGroupMode("department")}
                      className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                        participantGroupMode === "department"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      По отделам
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={expandAllParticipantGroups}
                      className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      disabled={participantGroups.length === 0}
                    >
                      Раскрыть все
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllParticipantGroups}
                      className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      disabled={participantGroups.length === 0}
                    >
                      Свернуть все
                    </button>
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto rounded-xl border border-border/60 bg-muted/15 p-2 space-y-2">
                  {loading ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">Загрузка участников...</p>
                  ) : participantGroups.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                      Участники с Telegram username не найдены.
                    </p>
                  ) : (
                    participantGroups.map((group) => {
                      const groupMemberIds = group.members.map((member) => member.id);
                      const selectedCount = groupMemberIds.filter((id) =>
                        selectedParticipantSet.has(id)
                      ).length;
                      const expanded = participantQuery.trim()
                        ? true
                        : !!expandedParticipantGroups[group.id];

                      return (
                        <div key={group.id} className="rounded-lg border border-border/60 bg-background/80 overflow-hidden">
                          <div className="flex items-center gap-1.5 px-2.5 py-2">
                            <button
                              type="button"
                              onClick={() => toggleParticipantGroup(group.id)}
                              className="min-w-0 flex flex-1 items-center gap-2 text-left"
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: group.accentColor }}
                              />
                              <span className="truncate text-sm font-medium">{group.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {selectedCount}/{group.members.length}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => selectParticipants(groupMemberIds)}
                              className="rounded-md px-2 py-1 text-xs hover:bg-muted transition-colors"
                            >
                              Все
                            </button>
                            <button
                              type="button"
                              onClick={() => deselectParticipants(groupMemberIds)}
                              className="rounded-md px-2 py-1 text-xs hover:bg-muted transition-colors"
                            >
                              Снять
                            </button>
                          </div>

                          {expanded && (
                            <div className="border-t border-border/50 space-y-1.5 p-2">
                              {group.members.map((member) => {
                                const username = normalizeTelegramUsername(member.telegram_username);
                                if (!username) return null;
                                const checked = selectedParticipantSet.has(member.id);

                                return (
                                  <label
                                    key={member.id}
                                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">{member.full_name}</p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        @{username}
                                        {member.position ? ` · ${member.position}` : ""}
                                      </p>
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleParticipant(member.id)}
                                      className="h-4 w-4 rounded border-border"
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedParticipants.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedParticipants.map((member) => {
                      const username = normalizeTelegramUsername(member.telegram_username);
                      if (!username) return null;
                      return (
                        <Badge key={member.id} variant="secondary" className="rounded-lg">
                          @{username}
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Выбранные участники автоматически добавляются в начало сообщения.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Сообщение
                  </Label>
                  <div className={`text-xs ${messageTooLong ? "text-destructive" : "text-muted-foreground"}`}>
                    {composedMessageHtml.length} / {messageLimit}
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
                {messageTooLong && (
                  <p className="text-xs text-destructive">
                    {imageFile
                      ? "С картинкой подпись ограничена 1024 символами."
                      : `Лимит Telegram: ${MAX_TELEGRAM_MESSAGE_LEN} символов.`}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Картинка
                </Label>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleSelectImage}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {imageFile ? "Заменить картинку" : "Прикрепить картинку"}
                    </Button>
                    {imageFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-lg"
                        onClick={() => setImageFile(null)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Удалить
                      </Button>
                    )}
                  </div>

                  {imageFile ? (
                    <div className="text-xs text-muted-foreground">
                      {imageFile.name} · {formatFileSize(imageFile.size)}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Форматы: JPG, PNG, WEBP. Максимальный размер: 10 МБ.
                    </p>
                  )}
                </div>
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
                  disabled={savingAction !== null || targets.length === 0 || messageTooLong}
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
                  disabled={savingAction !== null || targets.length === 0 || messageTooLong}
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

          <TelegramPreview
            messageHtml={composedMessageHtml}
            imagePreviewUrl={imagePreviewUrl}
          />
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
                          <span className="truncate text-sm font-heading font-semibold">
                            {broadcast.target_label || `Chat ${broadcast.chat_id}`}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-2xs font-medium ${STATUS_BADGE_CLASS[broadcast.status]}`}
                          >
                            {TELEGRAM_BROADCAST_STATUS_LABELS[broadcast.status]}
                          </span>
                          {broadcast.status === "scheduled" && broadcast.image_path && (
                            <Badge variant="outline" className="rounded-md text-2xs">
                              С фото
                            </Badge>
                          )}
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
