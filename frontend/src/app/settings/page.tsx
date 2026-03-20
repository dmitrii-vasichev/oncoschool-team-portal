"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bell,
  Clock,
  Loader2,
  Save,
  Users,
  Settings,
  Info,
  CheckCircle2,
  AlertTriangle,
  CalendarPlus,
  MessageSquarePlus,
  ClipboardCheck,
  ListChecks,
  Send,
  Plus,
  Pencil,
  Trash2,
  MessageCircle,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Hash,
  Type,
  CalendarDays,
  Flag,
} from "lucide-react";
import { ModeratorGuard } from "@/components/shared/ModeratorGuard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useToast } from "@/components/shared/Toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TimePicker } from "@/components/shared/TimePicker";
import { AIFeatureConfigSection } from "@/components/settings/AIFeatureConfigSection";
import { GetCourseSection } from "@/components/settings/GetCourseSection";
import { ReportScheduleSection } from "@/components/settings/ReportScheduleSection";
import { TelegramConnectionSection } from "@/components/settings/TelegramConnectionSection";
import { ContentAccessSection } from "@/components/settings/ContentAccessSection";
import { api } from "@/lib/api";
import { useTeam } from "@/hooks/useTeam";
import { useDepartments } from "@/hooks/useDepartments";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PermissionService } from "@/lib/permissions";
import type {
  ReminderDigestSectionKey,
  ReminderTaskLineFieldKey,
  ReminderSettings,
  TeamMember,
  TelegramNotificationTarget,
} from "@/lib/types";

export default function SettingsPage() {
  const { user } = useCurrentUser();
  const isAdmin = user ? PermissionService.isAdmin(user) : false;
  const canConfigureReminders = user
    ? PermissionService.canConfigureReminders(user)
    : false;

  return (
    <ModeratorGuard>
      <div className="max-w-3xl space-y-8 animate-in fade-in duration-300">
        {isAdmin && <AIFeatureConfigSection />}
        {isAdmin && <GetCourseSection />}
        {isAdmin && <ReportScheduleSection />}
        <NotificationsSection />
        {isAdmin && <TelegramTargetsSection />}
        {isAdmin && <TelegramConnectionSection />}
        {isAdmin && <ContentAccessSection />}
        {canConfigureReminders && <RemindersSection />}
      </div>
    </ModeratorGuard>
  );
}

// ============================================
// Telegram Targets Section
// ============================================

type TargetTabType = "meeting" | "report";

function TelegramTargetsSection() {
  const { toastSuccess, toastError } = useToast();
  const [targets, setTargets] = useState<TelegramNotificationTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<TelegramNotificationTarget | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<TargetTabType>("meeting");
  const [deleteTarget, setDeleteTarget] = useState<TelegramNotificationTarget | null>(null);

  const fetchTargets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTelegramTargets();
      setTargets(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const meetingTargets = useMemo(
    () => targets.filter((t) => t.type === "meeting" || t.type === null),
    [targets]
  );
  const reportTargets = useMemo(
    () => targets.filter((t) => t.type === "report:getcourse"),
    [targets]
  );

  const filteredTargets = activeTab === "meeting" ? meetingTargets : reportTargets;

  const handleDelete = async (target: TelegramNotificationTarget) => {
    try {
      await api.deleteTelegramTarget(target.id);
      toastSuccess("Группа удалена");
      fetchTargets();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="animate-fade-in-up stagger-2 rounded-2xl border border-border/60 bg-card overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-3 p-6 pb-0">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "hsl(200, 60%, 50%, 0.1)" }}
          >
            <Send
              className="h-5 w-5"
              style={{ color: "hsl(200, 60%, 50%)" }}
            />
          </div>
          <div className="flex-1">
            <h2 className="font-heading font-semibold text-base">
              Telegram-группы для уведомлений
            </h2>
            <p className="text-xs text-muted-foreground">
              Группы для отправки уведомлений и (опционально) входящих задач через @бот
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-lg gap-1.5"
            onClick={() => {
              setEditTarget(null);
              setShowForm(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить
          </Button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
            <button
              onClick={() => setActiveTab("meeting")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "meeting"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Встречи ({meetingTargets.length})
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "report"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Отчёты ({reportTargets.length})
            </button>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {filteredTargets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
              <MessageCircle className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Нет настроенных групп</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {activeTab === "meeting"
                  ? "Добавьте Telegram-группы для напоминаний о встречах"
                  : "Добавьте Telegram-группы для отправки ежедневных отчётов"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTargets.map((target) => (
                <div
                  key={target.id}
                  className="group flex items-center gap-3 p-3.5 rounded-xl border border-border/60 hover:shadow-sm hover:border-border"
                >
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "hsl(200, 60%, 50%, 0.08)" }}
                  >
                    <Send className="h-4 w-4" style={{ color: "hsl(200, 60%, 50%)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-heading font-semibold truncate">
                      {target.label || `Chat ${target.chat_id}`}
                    </p>
                    <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                      <span>ID: {target.chat_id}</span>
                      {target.thread_id && (
                        <>
                          <span className="text-border">|</span>
                          <span>Тема: #{target.thread_id}</span>
                        </>
                      )}
                      {activeTab === "meeting" && (
                        <>
                          <span className="text-border">|</span>
                          <span>
                            Входящие задачи: {target.allow_incoming_tasks ? "вкл" : "выкл"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status dot */}
                  <div
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      target.is_active ? "bg-status-done-fg" : "bg-border"
                    }`}
                  />

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditTarget(target);
                        setShowForm(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(target)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Help text */}
          <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/40 p-3.5 rounded-xl border border-border/40">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
            <span>
              Чтобы узнать Chat ID группы, добавьте бота @userinfobot в группу
              или перешлите сообщение из группы боту @JsonDumpBot.
              {activeTab === "meeting" && " Включайте «Входящие задачи», только если в этой группе хотите создавать задачи через @бот."}
            </span>
          </div>
        </div>
      </div>

      {/* Telegram target form dialog */}
      {showForm && (
        <TelegramTargetFormDialog
          target={editTarget}
          defaultType={activeTab === "report" ? "report:getcourse" : "meeting"}
          onClose={() => {
            setShowForm(false);
            setEditTarget(null);
          }}
          onSaved={() => {
            fetchTargets();
            setShowForm(false);
            setEditTarget(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Удалить «${deleteTarget?.label || `Chat ${deleteTarget?.chat_id}`}»?`}
        description="Telegram-группа будет удалена из списка целей для уведомлений."
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />
    </>
  );
}

// ============================================
// Telegram Target Form Dialog
// ============================================

function TelegramTargetFormDialog({
  target,
  defaultType,
  onClose,
  onSaved,
}: {
  target: TelegramNotificationTarget | null;
  defaultType?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const isEdit = !!target;
  const [chatId, setChatId] = useState(target ? String(target.chat_id) : "");
  const [threadId, setThreadId] = useState(
    target?.thread_id ? String(target.thread_id) : ""
  );
  const [label, setLabel] = useState(target?.label ?? "");
  const [allowIncomingTasks, setAllowIncomingTasks] = useState(
    target?.allow_incoming_tasks ?? false
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const chatIdNum = Number(chatId);
    if (!chatId || isNaN(chatIdNum)) {
      setError("Введите корректный Chat ID");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const targetType = target?.type ?? defaultType ?? "meeting";
      const data = {
        chat_id: chatIdNum,
        thread_id: threadId ? Number(threadId) : null,
        label: label.trim() || null,
        type: targetType,
        allow_incoming_tasks: allowIncomingTasks,
      };

      if (isEdit && target) {
        await api.updateTelegramTarget(target.id, data);
        toastSuccess("Группа обновлена");
      } else {
        await api.createTelegramTarget(data);
        toastSuccess("Группа добавлена");
      }
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка сохранения";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEdit ? "Редактировать группу" : "Добавить Telegram-группу"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Название (для удобства)
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Основная группа"
              className="mt-1.5 rounded-xl"
            />
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Chat ID *
            </Label>
            <Input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-1003693766132"
              className="mt-1.5 rounded-xl font-mono text-sm"
            />
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Thread ID (необязательно)
            </Label>
            <Input
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
              placeholder="Оставьте пустым для общей ветки"
              className="mt-1.5 rounded-xl font-mono text-sm"
            />
            <p className="text-2xs text-muted-foreground mt-1">
              Укажите, если группа использует темы (topics)
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label className="text-sm font-medium">Входящие задачи через @бот</Label>
                <p className="text-2xs text-muted-foreground mt-1">
                  Если включено, в этой группе можно ставить задачи с упоминанием бота.
                </p>
              </div>
              <Switch
                checked={allowIncomingTasks}
                onCheckedChange={setAllowIncomingTasks}
                disabled={saving}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={onClose}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button className="rounded-xl" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : isEdit ? (
                "Сохранить"
              ) : (
                "Добавить"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Notifications Section
// ============================================

interface EventConfig {
  label: string;
  description: string;
  icon: typeof Bell;
  group: "tasks" | "meetings";
}

const EVENT_TYPES: Record<string, EventConfig> = {
  task_created: {
    label: "Создание задачи",
    description: "Когда создаётся новая задача",
    icon: CalendarPlus,
    group: "tasks",
  },
  task_status_changed: {
    label: "Изменение статуса",
    description: "Когда задача меняет статус",
    icon: ClipboardCheck,
    group: "tasks",
  },
  task_completed: {
    label: "Завершение задачи",
    description: "Когда задача отмечена как выполненная",
    icon: CheckCircle2,
    group: "tasks",
  },
  task_overdue: {
    label: "Просроченная задача",
    description: "Когда задача выходит за дедлайн",
    icon: AlertTriangle,
    group: "tasks",
  },
  task_update_added: {
    label: "Новое обновление",
    description: "Когда участник добавляет апдейт к задаче",
    icon: MessageSquarePlus,
    group: "tasks",
  },
  meeting_created: {
    label: "Создание встречи",
    description: "Когда создаётся встреча из summary",
    icon: ListChecks,
    group: "meetings",
  },
};

const TASK_OVERDUE_INTERVAL_OPTIONS = [
  { value: "1", label: "Каждый час" },
  { value: "24", label: "Каждые 24 часа" },
] as const;

function NotificationsSection() {
  const { toastSuccess, toastError } = useToast();
  const [subscriptions, setSubscriptions] = useState<Record<string, boolean>>(
    {}
  );
  const [taskOverdueIntervalHours, setTaskOverdueIntervalHours] = useState("1");
  const [taskOverdueDailyTimeMsk, setTaskOverdueDailyTimeMsk] = useState("09:00");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getNotificationSubscriptions()
      .then((data) => {
        setSubscriptions(data.subscriptions);
        setTaskOverdueIntervalHours(
          String(data.task_overdue_interval_hours ?? 1)
        );
        setTaskOverdueDailyTimeMsk(data.task_overdue_daily_time_msk ?? "09:00");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (eventType: string) => {
    setSubscriptions((prev) => ({
      ...prev,
      [eventType]: !prev[eventType],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const intervalHours = Number(taskOverdueIntervalHours) || 1;
      const result = await api.updateNotificationSubscriptions({
        subscriptions,
        task_overdue_interval_hours: intervalHours,
        task_overdue_daily_time_msk: taskOverdueDailyTimeMsk,
      });
      setSubscriptions(result.subscriptions);
      setTaskOverdueIntervalHours(String(result.task_overdue_interval_hours ?? 1));
      setTaskOverdueDailyTimeMsk(result.task_overdue_daily_time_msk ?? "09:00");
      toastSuccess("Подписки сохранены");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка сохранения";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const taskEvents = Object.entries(EVENT_TYPES).filter(
    ([, c]) => c.group === "tasks"
  );
  const meetingEvents = Object.entries(EVENT_TYPES).filter(
    ([, c]) => c.group === "meetings"
  );
  const overdueSubscriptionEnabled = subscriptions.task_overdue || false;
  const isDailyInterval = taskOverdueIntervalHours === "24";

  return (
    <div className="animate-fade-in-up stagger-2 rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 p-6 pb-0">
        <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center">
          <Bell className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h2 className="font-heading font-semibold text-base">
            Подписки на уведомления
          </h2>
          <p className="text-xs text-muted-foreground">
            Получайте уведомления в Telegram при наступлении событий
          </p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Task events */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 mb-3">
            Задачи
          </p>
          <div className="space-y-1">
            {taskEvents.map(([eventType, config]) => {
              const Icon = config.icon;
              return (
                <div
                  key={eventType}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-muted/40"
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={`notify-${eventType}`}
                      className="cursor-pointer text-sm font-medium"
                    >
                      {config.label}
                    </Label>
                    <p className="text-2xs text-muted-foreground">
                      {config.description}
                    </p>
                  </div>
                  <Switch
                    id={`notify-${eventType}`}
                    checked={subscriptions[eventType] || false}
                    onCheckedChange={() => handleToggle(eventType)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Периодичность напоминаний о просроченных задачах</p>
              <p className="text-2xs text-muted-foreground">
                По МСК: каждый час в начале часа или раз в сутки в выбранное время.
              </p>
            </div>
            <Select
              value={taskOverdueIntervalHours}
              onValueChange={setTaskOverdueIntervalHours}
              disabled={!overdueSubscriptionEnabled}
            >
              <SelectTrigger className="h-9 w-full rounded-lg sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_OVERDUE_INTERVAL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isDailyInterval && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-2xs text-muted-foreground">
                Время ежедневной отправки (МСК)
              </p>
              <TimePicker
                value={taskOverdueDailyTimeMsk}
                onChange={setTaskOverdueDailyTimeMsk}
                disabled={!overdueSubscriptionEnabled}
                className="h-9 w-full rounded-lg sm:w-40"
              />
            </div>
          )}
          {!overdueSubscriptionEnabled && (
            <p className="mt-2 text-2xs text-muted-foreground">
              Включите переключатель «Просроченная задача», чтобы применять периодичность.
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60" />

        {/* Meeting events */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 mb-3">
            Встречи
          </p>
          <div className="space-y-1">
            {meetingEvents.map(([eventType, config]) => {
              const Icon = config.icon;
              return (
                <div
                  key={eventType}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-muted/40"
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={`notify-${eventType}`}
                      className="cursor-pointer text-sm font-medium"
                    >
                      {config.label}
                    </Label>
                    <p className="text-2xs text-muted-foreground">
                      {config.description}
                    </p>
                  </div>
                  <Switch
                    id={`notify-${eventType}`}
                    checked={subscriptions[eventType] || false}
                    onCheckedChange={() => handleToggle(eventType)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Сохранение...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Сохранить подписки
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Reminders Section
// ============================================

const DAY_LABELS: Record<number, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  7: "Вс",
};

const DEFAULT_DIGEST_SECTIONS_ORDER: ReminderDigestSectionKey[] = [
  "overdue",
  "upcoming",
  "in_progress",
  "new",
];

const DIGEST_SECTION_META: Record<
  ReminderDigestSectionKey,
  {
    label: string;
    icon: typeof AlertTriangle;
    iconClassName: string;
  }
> = {
  overdue: {
    label: "Просроченные задачи",
    icon: AlertTriangle,
    iconClassName: "text-destructive",
  },
  upcoming: {
    label: "Ближайшие по дедлайну (3 дня)",
    icon: Clock,
    iconClassName: "text-muted-foreground",
  },
  in_progress: {
    label: "Задачи в работе",
    icon: Loader2,
    iconClassName: "text-primary",
  },
  new: {
    label: "Новые задачи",
    icon: CalendarPlus,
    iconClassName: "text-muted-foreground",
  },
};

function normalizeDigestSectionsOrder(
  value: ReminderDigestSectionKey[] | string[] | null | undefined
): ReminderDigestSectionKey[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_DIGEST_SECTIONS_ORDER];
  }

  const allowed = new Set<ReminderDigestSectionKey>(DEFAULT_DIGEST_SECTIONS_ORDER);
  const normalized: ReminderDigestSectionKey[] = [];

  for (const rawKey of value) {
    if (typeof rawKey !== "string") continue;
    if (!allowed.has(rawKey as ReminderDigestSectionKey)) continue;
    const key = rawKey as ReminderDigestSectionKey;
    if (!normalized.includes(key)) {
      normalized.push(key);
    }
  }

  for (const key of DEFAULT_DIGEST_SECTIONS_ORDER) {
    if (!normalized.includes(key)) {
      normalized.push(key);
    }
  }

  return normalized;
}

function normalizeUpcomingDays(value: number): number {
  if (!Number.isFinite(value)) return 3;
  const whole = Math.trunc(value);
  return Math.max(0, Math.min(whole, 7));
}

const UPCOMING_DAYS_OPTIONS = Array.from({ length: 8 }, (_, idx) => idx);

const DEFAULT_TASK_LINE_FIELDS_ORDER: ReminderTaskLineFieldKey[] = [
  "number",
  "title",
  "deadline",
  "priority",
];

interface ApplyMembersGroup {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  members: TeamMember[];
}

const APPLY_GROUP_UNASSIGNED = "__apply_unassigned__";
const APPLY_GROUP_UNKNOWN_DEPARTMENT = "__apply_unknown_department__";

function sortMembersByFullName(a: TeamMember, b: TeamMember) {
  return a.full_name.localeCompare(b.full_name, "ru", { sensitivity: "base" });
}

const TASK_LINE_FIELD_META: Record<
  ReminderTaskLineFieldKey,
  {
    label: string;
    icon: typeof AlertTriangle;
    iconClassName: string;
  }
> = {
  number: {
    label: "Номер задачи",
    icon: Hash,
    iconClassName: "text-muted-foreground",
  },
  title: {
    label: "Название задачи",
    icon: Type,
    iconClassName: "text-foreground/80",
  },
  deadline: {
    label: "Дата дедлайна",
    icon: CalendarDays,
    iconClassName: "text-muted-foreground",
  },
  priority: {
    label: "Приоритет",
    icon: Flag,
    iconClassName: "text-primary",
  },
};

function normalizeTaskLineFieldsOrder(
  value: ReminderTaskLineFieldKey[] | string[] | null | undefined
): ReminderTaskLineFieldKey[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_TASK_LINE_FIELDS_ORDER];
  }

  const allowed = new Set<ReminderTaskLineFieldKey>(DEFAULT_TASK_LINE_FIELDS_ORDER);
  const normalized: ReminderTaskLineFieldKey[] = [];

  for (const rawKey of value) {
    if (typeof rawKey !== "string") continue;
    if (!allowed.has(rawKey as ReminderTaskLineFieldKey)) continue;
    const key = rawKey as ReminderTaskLineFieldKey;
    if (!normalized.includes(key)) {
      normalized.push(key);
    }
  }

  for (const key of DEFAULT_TASK_LINE_FIELDS_ORDER) {
    if (!normalized.includes(key)) {
      normalized.push(key);
    }
  }

  return normalized;
}

const MOSCOW_TIMEZONE = "Europe/Moscow";

function getTimezoneOffsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const offsetToken =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = offsetToken.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours >= 0 ? hours * 60 + minutes : hours * 60 - minutes;
}

function formatUtcOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  const hh = String(Math.floor(absolute / 60)).padStart(2, "0");
  const mm = String(absolute % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

function getLocalTimeFromMoscow(time: string): {
  localTime: string;
  localTimezone: string;
  localOffset: string;
} | null {
  const parts = time.split(":");
  if (parts.length !== 2) return null;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (
    Number.isNaN(hh) ||
    Number.isNaN(mm) ||
    hh < 0 ||
    hh > 23 ||
    mm < 0 ||
    mm > 59
  ) {
    return null;
  }

  try {
    const now = new Date();
    const dateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: MOSCOW_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = Number(
      dateParts.find((part) => part.type === "year")?.value ?? now.getUTCFullYear()
    );
    const month = Number(
      dateParts.find((part) => part.type === "month")?.value ??
        now.getUTCMonth() + 1
    );
    const day = Number(
      dateParts.find((part) => part.type === "day")?.value ?? now.getUTCDate()
    );
    const utcGuess = Date.UTC(year, month - 1, day, hh, mm, 0);
    const mskOffset = getTimezoneOffsetMinutes(
      MOSCOW_TIMEZONE,
      new Date(utcGuess)
    );
    const exactInstant = new Date(utcGuess - mskOffset * 60 * 1000);

    const localTimezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
    const localTime = new Intl.DateTimeFormat("ru-RU", {
      timeZone: localTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(exactInstant);
    const localOffset = formatUtcOffset(
      getTimezoneOffsetMinutes(localTimezone, exactInstant)
    );

    return {
      localTime,
      localTimezone,
      localOffset,
    };
  } catch {
    return null;
  }
}

function RemindersSection() {
  const { toastSuccess, toastError } = useToast();
  const { members, loading: membersLoading } = useTeam();
  const [reminders, setReminders] = useState<
    Record<string, ReminderSettings | null>
  >({});
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkTime, setBulkTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    if (members.length === 0) return;
    setLoadingReminders(true);
    try {
      const results = await Promise.all(
        members.map(async (m) => {
          try {
            const r = await api.getReminderSettings(m.id);
            return [m.id, r] as const;
          } catch {
            return [m.id, null] as const;
          }
        })
      );
      setReminders(Object.fromEntries(results));
    } finally {
      setLoadingReminders(false);
    }
  }, [members]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleBulkEnable = async () => {
    setBulkSaving(true);
    setError(null);
    try {
      await api.bulkUpdateReminders({
        is_enabled: true,
        reminder_time: bulkTime,
        days_of_week: [1, 2, 3, 4, 5],
      });
      await fetchReminders();
      toastSuccess("Напоминания включены для всех");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toastError(msg);
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkDisable = async () => {
    setBulkSaving(true);
    setError(null);
    try {
      await api.bulkUpdateReminders({ is_enabled: false });
      await fetchReminders();
      toastSuccess("Напоминания отключены");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      setError(msg);
      toastError(msg);
    } finally {
      setBulkSaving(false);
    }
  };

  const loading = membersLoading || loadingReminders;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-12 rounded-xl" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const editMember = members.find((m) => m.id === editMemberId);
  const enabledCount = Object.values(reminders).filter(
    (r) => r?.is_enabled
  ).length;

  return (
    <>
      <div className="animate-fade-in-up stagger-3 rounded-2xl border border-border/60 bg-card overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-3 p-6 pb-0">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "hsl(262, 52%, 55%, 0.1)" }}
          >
            <Clock
              className="h-5 w-5"
              style={{ color: "hsl(262, 52%, 55%)" }}
            />
          </div>
          <div className="flex-1">
            <h2 className="font-heading font-semibold text-base">
              Напоминания команды
            </h2>
            <p className="text-xs text-muted-foreground">
              Ежедневные дайджесты задач для участников
            </p>
          </div>
          <Badge variant="secondary" className="rounded-lg text-2xs">
            {enabledCount} / {members.length} вкл.
          </Badge>
        </div>

        <div className="p-6 space-y-4">
          {/* Bulk actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-4 bg-muted/40 rounded-xl border border-border/40">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">
                Массово:
              </span>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <TimePicker
                value={bulkTime}
                onChange={setBulkTime}
                className="w-28 rounded-lg h-8 text-sm shrink-0"
              />
              <span className="text-2xs text-muted-foreground shrink-0">
                МСК
              </span>
              <Button
                size="sm"
                className="rounded-lg shrink-0"
                onClick={handleBulkEnable}
                disabled={bulkSaving}
              >
                {bulkSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Включить всем"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg shrink-0"
                onClick={handleBulkDisable}
                disabled={bulkSaving}
              >
                Выключить
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Members list */}
          <div className="space-y-2">
            {members.map((member) => {
              const reminder = reminders[member.id];
              return (
                <div
                  key={member.id}
                  className="group flex items-center gap-3 p-3.5 rounded-xl border border-border/60 hover:shadow-sm hover:border-border"
                >
                  <UserAvatar name={member.full_name} avatarUrl={member.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-heading font-semibold truncate">
                      {member.full_name}
                    </p>
                    {reminder?.is_enabled ? (
                      <p className="text-2xs text-muted-foreground">
                        {reminder.reminder_time?.slice(0, 5)} МСК{" "}
                        <span className="text-border mx-0.5">|</span>{" "}
                        {reminder.days_of_week
                          ?.map((d) => DAY_LABELS[d])
                          .join(", ")}
                      </p>
                    ) : (
                      <p className="text-2xs text-muted-foreground/60">
                        Не настроено
                      </p>
                    )}
                  </div>

                  {/* Status indicator */}
                  <div
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      reminder?.is_enabled
                        ? "bg-status-done-fg"
                        : "bg-border"
                    }`}
                  />

                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setEditMemberId(member.id)}
                  >
                    <Settings className="h-3.5 w-3.5 mr-1" />
                    Настроить
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit reminder dialog */}
      {editMember && (
        <ReminderEditDialog
          member={editMember}
          allMembers={members}
          reminder={editMemberId ? reminders[editMemberId] ?? null : null}
          onClose={() => setEditMemberId(null)}
          onSaved={fetchReminders}
        />
      )}
    </>
  );
}

// ============================================
// Reminder Edit Dialog
// ============================================

function ReminderEditDialog({
  member,
  allMembers,
  reminder,
  onClose,
  onSaved,
}: {
  member: TeamMember;
  allMembers: TeamMember[];
  reminder: ReminderSettings | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const { departments } = useDepartments();
  const [isEnabled, setIsEnabled] = useState(reminder?.is_enabled ?? false);
  const [time, setTime] = useState(
    reminder?.reminder_time?.slice(0, 5) ?? "09:00"
  );
  const [days, setDays] = useState<number[]>(
    reminder?.days_of_week ?? [1, 2, 3, 4, 5]
  );
  const [includeOverdue, setIncludeOverdue] = useState(
    reminder?.include_overdue ?? true
  );
  const [includeUpcoming, setIncludeUpcoming] = useState(
    reminder?.include_upcoming ?? true
  );
  const [upcomingDays, setUpcomingDays] = useState(
    normalizeUpcomingDays(reminder?.upcoming_days ?? 3)
  );
  const [includeInProgress, setIncludeInProgress] = useState(
    reminder?.include_in_progress ?? true
  );
  const [includeNew, setIncludeNew] = useState(
    reminder?.include_new ?? true
  );
  const [digestSectionsOrder, setDigestSectionsOrder] = useState<
    ReminderDigestSectionKey[]
  >(() => normalizeDigestSectionsOrder(reminder?.digest_sections_order));
  const [draggingSection, setDraggingSection] = useState<ReminderDigestSectionKey | null>(null);
  const [dragOverSection, setDragOverSection] = useState<ReminderDigestSectionKey | null>(null);
  const [taskLineShowNumber, setTaskLineShowNumber] = useState(
    reminder?.task_line_show_number ?? true
  );
  const [taskLineShowTitle, setTaskLineShowTitle] = useState(
    reminder?.task_line_show_title ?? true
  );
  const [taskLineShowDeadline, setTaskLineShowDeadline] = useState(
    reminder?.task_line_show_deadline ?? true
  );
  const [taskLineShowPriority, setTaskLineShowPriority] = useState(
    reminder?.task_line_show_priority ?? true
  );
  const [taskLineFieldsOrder, setTaskLineFieldsOrder] = useState<
    ReminderTaskLineFieldKey[]
  >(() => normalizeTaskLineFieldsOrder(reminder?.task_line_fields_order));
  const [draggingTaskLineField, setDraggingTaskLineField] = useState<ReminderTaskLineFieldKey | null>(null);
  const [dragOverTaskLineField, setDragOverTaskLineField] = useState<ReminderTaskLineFieldKey | null>(null);
  const [isDigestSectionsExpanded, setIsDigestSectionsExpanded] = useState(false);
  const [isTaskLineFormatExpanded, setIsTaskLineFormatExpanded] = useState(false);
  const [isApplySettingsExpanded, setIsApplySettingsExpanded] = useState(false);
  const [selectedApplyMemberIds, setSelectedApplyMemberIds] = useState<string[]>([]);
  const [applyTimeSettings, setApplyTimeSettings] = useState(true);
  const [applyDaysSettings, setApplyDaysSettings] = useState(true);
  const [applyDigestSettings, setApplyDigestSettings] = useState(true);
  const [applyTaskLineSettings, setApplyTaskLineSettings] = useState(true);
  const [applyingSettings, setApplyingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedApplyGroupIds, setExpandedApplyGroupIds] = useState<Record<string, boolean>>({});
  const otherMembers = useMemo(
    () => allMembers.filter((candidate) => candidate.id !== member.id),
    [allMembers, member.id]
  );
  const departmentById = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments]
  );
  const applyMemberGroups = useMemo(() => {
    const grouped = new Map<string, ApplyMembersGroup>();

    for (const candidate of otherMembers) {
      let groupId = APPLY_GROUP_UNASSIGNED;
      let groupName = "Без отдела";
      let groupColor: string | null = "#6B7280";
      let groupSortOrder = Number.MAX_SAFE_INTEGER;

      if (candidate.department_id) {
        const department = departmentById.get(candidate.department_id);
        if (department) {
          groupId = department.id;
          groupName = department.name;
          groupColor = department.color;
          groupSortOrder = department.sort_order;
        } else {
          groupId = APPLY_GROUP_UNKNOWN_DEPARTMENT;
          groupName = "Отдел не найден";
          groupColor = "#9CA3AF";
          groupSortOrder = Number.MAX_SAFE_INTEGER - 1;
        }
      }

      const existingGroup = grouped.get(groupId);
      if (existingGroup) {
        existingGroup.members.push(candidate);
      } else {
        grouped.set(groupId, {
          id: groupId,
          name: groupName,
          color: groupColor,
          sortOrder: groupSortOrder,
          members: [candidate],
        });
      }
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        members: [...group.members].sort(sortMembersByFullName),
      }))
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
      });
  }, [departmentById, otherMembers]);
  const selectedApplyMemberIdSet = useMemo(
    () => new Set(selectedApplyMemberIds),
    [selectedApplyMemberIds]
  );
  const localTimeInfo = useMemo(() => getLocalTimeFromMoscow(time), [time]);
  const hasAnyDigestSectionEnabled =
    includeOverdue || includeUpcoming || includeInProgress || includeNew;
  const hasAnyTaskLineFieldEnabled =
    taskLineShowNumber ||
    taskLineShowTitle ||
    taskLineShowDeadline ||
    taskLineShowPriority;
  const hasAnyApplySettingSelected =
    applyTimeSettings ||
    applyDaysSettings ||
    applyDigestSettings ||
    applyTaskLineSettings;
  const digestSectionEnabledMap: Record<ReminderDigestSectionKey, boolean> = {
    overdue: includeOverdue,
    upcoming: includeUpcoming,
    in_progress: includeInProgress,
    new: includeNew,
  };
  const taskLineFieldEnabledMap: Record<ReminderTaskLineFieldKey, boolean> = {
    number: taskLineShowNumber,
    title: taskLineShowTitle,
    deadline: taskLineShowDeadline,
    priority: taskLineShowPriority,
  };
  const taskLinePreview = useMemo(() => {
    const sampleByField: Record<ReminderTaskLineFieldKey, string> = {
      number: "#245",
      title: "Подготовить отчет",
      deadline: "📅 28.02",
      priority: "⚡ high",
    };
    const parts = taskLineFieldsOrder
      .filter((field) => {
        if (field === "number") return taskLineShowNumber;
        if (field === "title") return taskLineShowTitle;
        if (field === "deadline") return taskLineShowDeadline;
        return taskLineShowPriority;
      })
      .map((field) => sampleByField[field]);
    return parts.length > 0 ? parts.join(" · ") : "Подготовить отчет";
  }, [
    taskLineFieldsOrder,
    taskLineShowNumber,
    taskLineShowTitle,
    taskLineShowDeadline,
    taskLineShowPriority,
  ]);

  const toggleDay = (day: number) => {
    setDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort()
    );
  };

  useEffect(() => {
    if (!hasAnyDigestSectionEnabled && isEnabled) {
      setIsEnabled(false);
    }
  }, [hasAnyDigestSectionEnabled, isEnabled]);

  useEffect(() => {
    if (!hasAnyTaskLineFieldEnabled && isEnabled) {
      setIsEnabled(false);
    }
  }, [hasAnyTaskLineFieldEnabled, isEnabled]);

  useEffect(() => {
    setExpandedApplyGroupIds((prev) => {
      const next: Record<string, boolean> = {};
      for (const group of applyMemberGroups) {
        if (group.id in prev) {
          next[group.id] = prev[group.id];
          continue;
        }
        next[group.id] =
          group.members.some((candidate) =>
            selectedApplyMemberIdSet.has(candidate.id)
          ) || applyMemberGroups.length <= 4;
      }
      return next;
    });
  }, [applyMemberGroups, selectedApplyMemberIdSet]);

  const setAllDigestSections = (value: boolean) => {
    setIncludeOverdue(value);
    setIncludeUpcoming(value);
    setIncludeInProgress(value);
    setIncludeNew(value);
    setIsEnabled(value);
  };

  const setAllTaskLineFields = (value: boolean) => {
    setTaskLineShowNumber(value);
    setTaskLineShowTitle(value);
    setTaskLineShowDeadline(value);
    setTaskLineShowPriority(value);
    if (value) {
      setIsEnabled(true);
    }
  };

  const setDigestSectionEnabled = (
    section: ReminderDigestSectionKey,
    value: boolean
  ) => {
    if (section === "overdue") {
      setIncludeOverdue(value);
      return;
    }
    if (section === "upcoming") {
      setIncludeUpcoming(value);
      return;
    }
    if (section === "in_progress") {
      setIncludeInProgress(value);
      return;
    }
    setIncludeNew(value);
  };

  const moveDigestSection = useCallback(
    (section: ReminderDigestSectionKey, direction: -1 | 1) => {
      setDigestSectionsOrder((prev) => {
        const currentIndex = prev.indexOf(section);
        if (currentIndex < 0) return prev;
        const nextIndex = currentIndex + direction;
        if (nextIndex < 0 || nextIndex >= prev.length) return prev;
        const reordered = [...prev];
        reordered.splice(currentIndex, 1);
        reordered.splice(nextIndex, 0, section);
        return reordered;
      });
    },
    []
  );

  const moveDigestSectionBefore = useCallback(
    (
      draggedSection: ReminderDigestSectionKey,
      targetSection: ReminderDigestSectionKey
    ) => {
      if (draggedSection === targetSection) return;
      setDigestSectionsOrder((prev) => {
        const fromIndex = prev.indexOf(draggedSection);
        const toIndex = prev.indexOf(targetSection);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
        const reordered = [...prev];
        reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, draggedSection);
        return reordered;
      });
    },
    []
  );

  const setTaskLineFieldEnabled = (
    field: ReminderTaskLineFieldKey,
    value: boolean
  ) => {
    if (field === "number") {
      setTaskLineShowNumber(value);
      return;
    }
    if (field === "title") {
      setTaskLineShowTitle(value);
      return;
    }
    if (field === "deadline") {
      setTaskLineShowDeadline(value);
      return;
    }
    setTaskLineShowPriority(value);
  };

  const moveTaskLineField = useCallback(
    (field: ReminderTaskLineFieldKey, direction: -1 | 1) => {
      setTaskLineFieldsOrder((prev) => {
        const currentIndex = prev.indexOf(field);
        if (currentIndex < 0) return prev;
        const nextIndex = currentIndex + direction;
        if (nextIndex < 0 || nextIndex >= prev.length) return prev;
        const reordered = [...prev];
        reordered.splice(currentIndex, 1);
        reordered.splice(nextIndex, 0, field);
        return reordered;
      });
    },
    []
  );

  const moveTaskLineFieldBefore = useCallback(
    (
      draggedField: ReminderTaskLineFieldKey,
      targetField: ReminderTaskLineFieldKey
    ) => {
      if (draggedField === targetField) return;
      setTaskLineFieldsOrder((prev) => {
        const fromIndex = prev.indexOf(draggedField);
        const toIndex = prev.indexOf(targetField);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
        const reordered = [...prev];
        reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, draggedField);
        return reordered;
      });
    },
    []
  );

  const toggleApplyMember = (memberId: string) => {
    setSelectedApplyMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const toggleApplyGroup = (groupId: string) => {
    setExpandedApplyGroupIds((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const setAllApplySettings = (value: boolean) => {
    setApplyTimeSettings(value);
    setApplyDaysSettings(value);
    setApplyDigestSettings(value);
    setApplyTaskLineSettings(value);
  };

  const buildReminderPayload = useCallback(
    () => ({
      is_enabled: isEnabled,
      reminder_time: time + ":00",
      days_of_week: days,
      include_overdue: includeOverdue,
      include_upcoming: includeUpcoming,
      upcoming_days: upcomingDays,
      include_in_progress: includeInProgress,
      include_new: includeNew,
      digest_sections_order: digestSectionsOrder,
      task_line_show_number: taskLineShowNumber,
      task_line_show_title: taskLineShowTitle,
      task_line_show_deadline: taskLineShowDeadline,
      task_line_show_priority: taskLineShowPriority,
      task_line_fields_order: taskLineFieldsOrder,
    }),
    [
      isEnabled,
      time,
      days,
      includeOverdue,
      includeUpcoming,
      upcomingDays,
      includeInProgress,
      includeNew,
      digestSectionsOrder,
      taskLineShowNumber,
      taskLineShowTitle,
      taskLineShowDeadline,
      taskLineShowPriority,
      taskLineFieldsOrder,
    ]
  );

  const buildApplyPayload = useCallback(() => {
    const payload: Partial<ReminderSettings> = {};
    if (applyTimeSettings) {
      payload.reminder_time = time + ":00";
    }
    if (applyDaysSettings) {
      payload.days_of_week = days;
    }
    if (applyDigestSettings) {
      payload.include_overdue = includeOverdue;
      payload.include_upcoming = includeUpcoming;
      payload.upcoming_days = upcomingDays;
      payload.include_in_progress = includeInProgress;
      payload.include_new = includeNew;
      payload.digest_sections_order = digestSectionsOrder;
    }
    if (applyTaskLineSettings) {
      payload.task_line_show_number = taskLineShowNumber;
      payload.task_line_show_title = taskLineShowTitle;
      payload.task_line_show_deadline = taskLineShowDeadline;
      payload.task_line_show_priority = taskLineShowPriority;
      payload.task_line_fields_order = taskLineFieldsOrder;
    }
    return payload;
  }, [
    applyTimeSettings,
    applyDaysSettings,
    applyDigestSettings,
    applyTaskLineSettings,
    time,
    days,
    includeOverdue,
    includeUpcoming,
    upcomingDays,
    includeInProgress,
    includeNew,
    digestSectionsOrder,
    taskLineShowNumber,
    taskLineShowTitle,
    taskLineShowDeadline,
    taskLineShowPriority,
    taskLineFieldsOrder,
  ]);

  const applySettingsToMembers = async (targetMemberIds: string[]) => {
    const uniqueIds = Array.from(new Set(targetMemberIds));
    if (uniqueIds.length === 0) {
      setError("Выберите хотя бы одного участника для применения настроек");
      return;
    }
    if (!hasAnyApplySettingSelected) {
      setError("Выберите хотя бы один блок настроек для применения");
      return;
    }
    if (applyTaskLineSettings && !hasAnyTaskLineFieldEnabled) {
      setError("Выберите хотя бы один элемент строки задачи");
      return;
    }

    setApplyingSettings(true);
    setError(null);
    try {
      const payload = buildApplyPayload();
      if (Object.keys(payload).length === 0) {
        setError("Не удалось сформировать данные для применения");
        return;
      }
      const results = await Promise.allSettled(
        uniqueIds.map((memberId) => api.updateReminderSettings(memberId, payload))
      );
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failedCount = uniqueIds.length - successCount;

      if (successCount > 0) {
        onSaved();
      }

      if (failedCount === 0) {
        toastSuccess(`Настройки применены для ${successCount} участн.`);
      } else {
        toastError(
          `Настройки применены: ${successCount}, с ошибками: ${failedCount}`
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка применения настроек";
      setError(msg);
      toastError(msg);
    } finally {
      setApplyingSettings(false);
    }
  };

  const handleReminderEnabledToggle = (value: boolean) => {
    if (value) {
      if (!hasAnyDigestSectionEnabled) {
        setAllDigestSections(true);
      }
      if (!hasAnyTaskLineFieldEnabled) {
        setAllTaskLineFields(true);
      }
    }
    setIsEnabled(value);
  };

  const handleSave = async () => {
    if (!hasAnyTaskLineFieldEnabled) {
      setError("Выберите хотя бы один элемент строки задачи");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateReminderSettings(member.id, buildReminderPayload());
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-heading">
            <UserAvatar name={member.full_name} avatarUrl={member.avatar_url} size="default" />
            <div>
              <span>Напоминания</span>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">
                {member.full_name}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40">
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${isEnabled ? "bg-status-done-fg" : "bg-border"}`}
              />
              <Label className="cursor-pointer font-medium">
                {isEnabled ? "Включено" : "Выключено"}
              </Label>
            </div>
            <Switch checked={isEnabled} onCheckedChange={handleReminderEnabledToggle} />
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Время отправки (МСК)
            </Label>
            <TimePicker
              value={time}
              onChange={setTime}
              className="w-28 rounded-xl"
            />
            <p className="text-2xs text-muted-foreground">
              Время задается по Москве (Europe/Moscow).
            </p>
            {localTimeInfo && (
              <p className="text-2xs text-muted-foreground">
                Локальное время: {localTimeInfo.localTime} ({localTimeInfo.localTimezone},{" "}
                {localTimeInfo.localOffset})
              </p>
            )}
          </div>

          {/* Days */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Дни недели
            </Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <button
                  key={day}
                  className={`
                    h-9 w-9 rounded-lg text-xs font-medium
                    transition-all duration-150
                    ${
                      days.includes(day)
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }
                  `}
                  onClick={() => toggleDay(day)}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border/60" />

          {/* Content toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Что включить в дайджест
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-lg px-3 text-xs"
                onClick={() =>
                  setIsDigestSectionsExpanded((prev) => !prev)
                }
              >
                {isDigestSectionsExpanded ? "Скрыть" : "Настроить"}
                {isDigestSectionsExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 ml-1.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
                )}
              </Button>
            </div>
            {isDigestSectionsExpanded ? (
              <div className="space-y-1">
                <div className="flex w-full flex-col items-stretch gap-1.5 px-3 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:px-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg px-3 text-xs"
                    disabled={saving || applyingSettings}
                    onClick={() => setAllDigestSections(true)}
                  >
                    Включить всё
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg px-3 text-xs"
                    disabled={saving || applyingSettings}
                    onClick={() => setAllDigestSections(false)}
                  >
                    Выключить всё
                  </Button>
                </div>
                {digestSectionsOrder.map((sectionKey, index) => {
                  const sectionMeta = DIGEST_SECTION_META[sectionKey];
                  const Icon = sectionMeta.icon;
                  const isChecked = digestSectionEnabledMap[sectionKey];
                  const isUpcomingSection = sectionKey === "upcoming";
                  const sectionLabel = isUpcomingSection
                    ? upcomingDays === 0
                      ? "Дедлайн истекает сегодня"
                      : `Ближайшие по дедлайну (${upcomingDays} дн.)`
                    : sectionMeta.label;
                  const isFirst = index === 0;
                  const isLast = index === digestSectionsOrder.length - 1;
                  const isDragTarget =
                    dragOverSection === sectionKey && draggingSection !== sectionKey;

                  return (
                    <div
                      key={sectionKey}
                      draggable
                      onDragStart={(event) => {
                        setDraggingSection(sectionKey);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", sectionKey);
                      }}
                      onDragOver={(event) => {
                        if (!draggingSection || draggingSection === sectionKey) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverSection(sectionKey);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const draggedRaw = event.dataTransfer.getData("text/plain");
                        if (
                          !DEFAULT_DIGEST_SECTIONS_ORDER.includes(
                            draggedRaw as ReminderDigestSectionKey
                          )
                        ) {
                          setDraggingSection(null);
                          setDragOverSection(null);
                          return;
                        }
                        const draggedSection = draggedRaw as ReminderDigestSectionKey;
                        moveDigestSectionBefore(draggedSection, sectionKey);
                        setDraggingSection(null);
                        setDragOverSection(null);
                      }}
                      onDragEnd={() => {
                        setDraggingSection(null);
                        setDragOverSection(null);
                      }}
                      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition-colors ${
                        isDragTarget
                          ? "bg-primary/10"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2 pr-1">
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/70 cursor-grab active:cursor-grabbing" />
                        <Icon className={`h-4 w-4 shrink-0 ${sectionMeta.iconClassName}`} />
                        <span className="min-w-0 text-sm leading-snug">{sectionLabel}</span>
                      </div>
                      <div className="ml-1 flex shrink-0 items-center gap-1">
                        {isUpcomingSection ? (
                          <Select
                            value={String(upcomingDays)}
                            onValueChange={(value) =>
                              setUpcomingDays(normalizeUpcomingDays(Number(value)))
                            }
                            disabled={!isChecked || saving || applyingSettings}
                          >
                            <SelectTrigger className="h-7 w-[106px] rounded-lg text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UPCOMING_DAYS_OPTIONS.map((daysOption) => (
                                <SelectItem
                                  key={daysOption}
                                  value={String(daysOption)}
                                >
                                  {daysOption === 0
                                    ? "Сегодня"
                                    : `${daysOption} дн.`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-lg text-muted-foreground"
                            disabled={isFirst || saving || applyingSettings}
                            onClick={() => moveDigestSection(sectionKey, -1)}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-lg text-muted-foreground"
                            disabled={isLast || saving || applyingSettings}
                            onClick={() => moveDigestSection(sectionKey, 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Switch
                          className="ml-1.5 h-[18px] w-[34px] [&>span]:h-[14px] [&>span]:w-[14px] [&>span[data-state=checked]]:translate-x-[14px]"
                          checked={isChecked}
                          onCheckedChange={(value) =>
                            setDigestSectionEnabled(sectionKey, value)
                          }
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="px-3 pt-1 text-2xs text-muted-foreground">
                  Перетаскивайте блоки или используйте стрелки, чтобы задать порядок в сообщении.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5">
                <p className="text-2xs text-muted-foreground">
                  Секция свернута. Нажмите «Настроить», чтобы изменить состав дайджеста.
                </p>
                <p className="mt-1 text-2xs text-muted-foreground">
                  Включено блоков:{" "}
                  <span className="font-mono">
                    {Object.values(digestSectionEnabledMap).filter(Boolean).length} из{" "}
                    {digestSectionsOrder.length}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-border/60" />

          {/* Task line format */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Формат строки задачи
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-lg px-3 text-xs"
                onClick={() =>
                  setIsTaskLineFormatExpanded((prev) => !prev)
                }
              >
                {isTaskLineFormatExpanded ? "Скрыть" : "Настроить"}
                {isTaskLineFormatExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 ml-1.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
                )}
              </Button>
            </div>
            {isTaskLineFormatExpanded ? (
              <div className="space-y-1">
                <div className="flex w-full flex-col items-stretch gap-1.5 px-3 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:px-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg px-3 text-xs"
                    disabled={saving || applyingSettings}
                    onClick={() => setAllTaskLineFields(true)}
                  >
                    Включить всё
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg px-3 text-xs"
                    disabled={saving || applyingSettings}
                    onClick={() => setAllTaskLineFields(false)}
                  >
                    Выключить всё
                  </Button>
                </div>
                {taskLineFieldsOrder.map((fieldKey, index) => {
                  const fieldMeta = TASK_LINE_FIELD_META[fieldKey];
                  const Icon = fieldMeta.icon;
                  const isChecked = taskLineFieldEnabledMap[fieldKey];
                  const isFirst = index === 0;
                  const isLast = index === taskLineFieldsOrder.length - 1;
                  const isDragTarget =
                    dragOverTaskLineField === fieldKey &&
                    draggingTaskLineField !== fieldKey;

                  return (
                    <div
                      key={fieldKey}
                      draggable
                      onDragStart={(event) => {
                        setDraggingTaskLineField(fieldKey);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", fieldKey);
                      }}
                      onDragOver={(event) => {
                        if (!draggingTaskLineField || draggingTaskLineField === fieldKey) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDragOverTaskLineField(fieldKey);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const draggedRaw = event.dataTransfer.getData("text/plain");
                        if (
                          !DEFAULT_TASK_LINE_FIELDS_ORDER.includes(
                            draggedRaw as ReminderTaskLineFieldKey
                          )
                        ) {
                          setDraggingTaskLineField(null);
                          setDragOverTaskLineField(null);
                          return;
                        }
                        const draggedField = draggedRaw as ReminderTaskLineFieldKey;
                        moveTaskLineFieldBefore(draggedField, fieldKey);
                        setDraggingTaskLineField(null);
                        setDragOverTaskLineField(null);
                      }}
                      onDragEnd={() => {
                        setDraggingTaskLineField(null);
                        setDragOverTaskLineField(null);
                      }}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors ${
                        isDragTarget
                          ? "bg-primary/10"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/70 cursor-grab active:cursor-grabbing" />
                        <Icon className={`h-3.5 w-3.5 ${fieldMeta.iconClassName}`} />
                        <span className="text-sm">{fieldMeta.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-muted-foreground"
                          disabled={isFirst || saving || applyingSettings}
                          onClick={() => moveTaskLineField(fieldKey, -1)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-muted-foreground"
                          disabled={isLast || saving || applyingSettings}
                          onClick={() => moveTaskLineField(fieldKey, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Switch
                          checked={isChecked}
                          onCheckedChange={(value) =>
                            setTaskLineFieldEnabled(fieldKey, value)
                          }
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="px-3 pt-1 space-y-1.5">
                  <p className="text-2xs text-muted-foreground">
                    Управляйте составом строки задачи и порядком блоков в каждом разделе дайджеста.
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    Пример: <span className="font-mono">{taskLinePreview}</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5">
                <p className="text-2xs text-muted-foreground">
                  Секция свернута. Нажмите «Настроить», чтобы изменить состав строки задачи.
                </p>
                <p className="mt-1 text-2xs text-muted-foreground">
                  Текущий формат: <span className="font-mono">{taskLinePreview}</span>
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-border/60" />

          {/* Apply my settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Применить мои настройки
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-lg px-3 text-xs"
                onClick={() => setIsApplySettingsExpanded((prev) => !prev)}
              >
                {isApplySettingsExpanded ? "Скрыть" : "Выбрать участников"}
                {isApplySettingsExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 ml-1.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
                )}
              </Button>
            </div>

            {isApplySettingsExpanded ? (
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-2xs text-muted-foreground">
                    Применить текущие параметры этой карточки к другим участникам.
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-lg px-2.5 text-xs"
                      disabled={applyingSettings || saving}
                      onClick={() => setAllApplySettings(true)}
                    >
                      Все блоки
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg px-2.5 text-xs"
                      disabled={applyingSettings || saving}
                      onClick={() => setAllApplySettings(false)}
                    >
                      Очистить блоки
                    </Button>
                  </div>
                </div>

                <div className="space-y-1 rounded-lg border border-border/60 bg-card p-2">
                  <p className="px-1 pb-1 text-2xs text-muted-foreground">
                    Что применить:
                  </p>
                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyTimeSettings}
                      onChange={() => setApplyTimeSettings((prev) => !prev)}
                      className="h-4 w-4 shrink-0 accent-primary"
                      disabled={applyingSettings || saving}
                    />
                    <span className="text-sm">Время отправки</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyDaysSettings}
                      onChange={() => setApplyDaysSettings((prev) => !prev)}
                      className="h-4 w-4 shrink-0 accent-primary"
                      disabled={applyingSettings || saving}
                    />
                    <span className="text-sm">Дни недели</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyDigestSettings}
                      onChange={() => setApplyDigestSettings((prev) => !prev)}
                      className="h-4 w-4 shrink-0 accent-primary"
                      disabled={applyingSettings || saving}
                    />
                    <span className="text-sm">Что включить в дайджест</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyTaskLineSettings}
                      onChange={() => setApplyTaskLineSettings((prev) => !prev)}
                      className="h-4 w-4 shrink-0 accent-primary"
                      disabled={applyingSettings || saving}
                    />
                    <span className="text-sm">Формат строки задачи</span>
                  </label>
                </div>

                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-2xs text-muted-foreground">
                    Кому применить:
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-lg px-2.5 text-xs"
                      disabled={otherMembers.length === 0 || applyingSettings || saving}
                      onClick={() =>
                        setSelectedApplyMemberIds(
                          otherMembers.map((candidate) => candidate.id)
                        )
                      }
                    >
                      Выбрать всех
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg px-2.5 text-xs"
                      disabled={selectedApplyMemberIds.length === 0 || applyingSettings || saving}
                      onClick={() => setSelectedApplyMemberIds([])}
                    >
                      Очистить
                    </Button>
                  </div>
                </div>

                <div className="max-h-44 overflow-y-auto rounded-lg border border-border/60 bg-card p-2">
                  {otherMembers.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-muted-foreground">
                      Нет других участников для применения.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {applyMemberGroups.map((group) => {
                        const expanded =
                          expandedApplyGroupIds[group.id] ?? applyMemberGroups.length <= 4;
                        const selectedCount = group.members.filter((candidate) =>
                          selectedApplyMemberIdSet.has(candidate.id)
                        ).length;

                        return (
                          <div
                            key={group.id}
                            className="overflow-hidden rounded-lg border border-border/60 bg-background/80"
                          >
                            <button
                              type="button"
                              onClick={() => toggleApplyGroup(group.id)}
                              className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-muted/30"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                {expanded ? (
                                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor:
                                      group.color || "hsl(var(--muted-foreground))",
                                  }}
                                />
                                <span className="truncate text-sm font-medium">
                                  {group.name}
                                </span>
                              </span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {selectedCount}/{group.members.length}
                              </span>
                            </button>

                            {expanded ? (
                              <div className="space-y-1 border-t border-border/50 p-1.5">
                                {group.members.map((candidate) => {
                                  const checked = selectedApplyMemberIdSet.has(candidate.id);
                                  return (
                                    <label
                                      key={candidate.id}
                                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleApplyMember(candidate.id)}
                                        className="h-4 w-4 shrink-0 accent-primary"
                                        disabled={applyingSettings || saving}
                                      />
                                      <span className="text-sm">{candidate.full_name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-2xs text-muted-foreground">
                    Выбрано участников: {selectedApplyMemberIds.length}
                  </p>
                  <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg px-3 text-xs"
                      disabled={
                        selectedApplyMemberIds.length === 0 ||
                        !hasAnyApplySettingSelected ||
                        applyingSettings ||
                        saving
                      }
                      onClick={() => applySettingsToMembers(selectedApplyMemberIds)}
                    >
                      {applyingSettings ? "Применяем..." : "Применить выбранным"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-lg px-3 text-xs"
                      disabled={
                        allMembers.length === 0 ||
                        !hasAnyApplySettingSelected ||
                        applyingSettings ||
                        saving
                      }
                      onClick={() =>
                        applySettingsToMembers(
                          allMembers.map((candidate) => candidate.id)
                        )
                      }
                    >
                      {applyingSettings ? "Применяем..." : "Применить всем"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/40 bg-muted/30 px-3 py-2.5">
                <p className="text-2xs text-muted-foreground">
                  Откройте секцию, чтобы применить текущие настройки другим участникам или всем сразу.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full rounded-xl sm:w-auto"
              onClick={onClose}
              disabled={saving || applyingSettings}
            >
              Отмена
            </Button>
            <Button
              className="w-full rounded-xl sm:w-auto"
              onClick={handleSave}
              disabled={saving || applyingSettings}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                "Сохранить"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
