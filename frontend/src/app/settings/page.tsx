"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bot,
  Bell,
  Clock,
  Loader2,
  Save,
  Users,
  Settings,
  Info,
  Sparkles,
  Zap,
  BrainCircuit,
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
import { api } from "@/lib/api";
import { useTeam } from "@/hooks/useTeam";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PermissionService } from "@/lib/permissions";
import type {
  AISettingsResponse,
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
        {isAdmin && <AIModelSection />}
        <NotificationsSection />
        {isAdmin && <TelegramTargetsSection />}
        {canConfigureReminders && <RemindersSection />}
      </div>
    </ModeratorGuard>
  );
}

// ============================================
// AI Model Section
// ============================================

const PROVIDER_CONFIG: Record<
  string,
  { label: string; icon: typeof Sparkles; color: string; gradient: string }
> = {
  anthropic: {
    label: "Anthropic",
    icon: BrainCircuit,
    color: "hsl(24, 70%, 50%)",
    gradient: "from-amber-500/10 to-orange-500/10",
  },
  openai: {
    label: "OpenAI",
    icon: Sparkles,
    color: "hsl(152, 55%, 38%)",
    gradient: "from-emerald-500/10 to-teal-500/10",
  },
  gemini: {
    label: "Gemini",
    icon: Zap,
    color: "hsl(220, 65%, 55%)",
    gradient: "from-blue-500/10 to-indigo-500/10",
  },
};

function AIModelSection() {
  const { toastSuccess, toastError } = useToast();
  const [settings, setSettings] = useState<AISettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAiSettings()
      .then((data) => {
        setSettings(data);
        setSelectedProvider(data.current_provider);
        setSelectedModel(data.current_model);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const modelsForProvider = (provider: string): string[] => {
    if (!settings?.providers_config) return [];
    return settings.providers_config[provider]?.models || [];
  };

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    if (settings?.providers_config) {
      const config = settings.providers_config[provider];
      setSelectedModel(config?.default || config?.models?.[0] || "");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await api.updateAiSettings({
        provider: selectedProvider,
        model: selectedModel,
      });
      setSettings(result);
      toastSuccess("AI-модель сохранена");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка сохранения";
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    settings &&
    (selectedProvider !== settings.current_provider ||
      selectedModel !== settings.current_model);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }

  const allProviders = ["anthropic", "openai", "gemini"];

  return (
    <div className="animate-fade-in-up stagger-1 rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 p-6 pb-0">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-heading font-semibold text-base">
            AI-модель для парсинга
          </h2>
          <p className="text-xs text-muted-foreground">
            Выберите провайдера и модель для обработки summary
          </p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Provider cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {allProviders.map((provider) => {
            const config = PROVIDER_CONFIG[provider];
            const isAvailable = settings?.available_providers?.[provider];
            const isSelected = selectedProvider === provider;
            const Icon = config.icon;

            return (
              <button
                key={provider}
                disabled={!isAvailable}
                onClick={() => handleProviderChange(provider)}
                className={`
                  relative overflow-hidden rounded-xl border-2 p-4 text-left
                  transition-all duration-200
                  ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : isAvailable
                        ? "border-border/60 bg-card hover:border-border hover:shadow-sm"
                        : "border-border/30 bg-muted/30 opacity-50 cursor-not-allowed"
                  }
                `}
              >
                {/* Decorative gradient */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 ${isSelected ? "opacity-100" : ""}`}
                />

                <div className="relative">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center mb-2"
                    style={{ backgroundColor: `${config.color}18` }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: config.color }}
                    />
                  </div>
                  <p className="font-heading font-semibold text-sm">
                    {config.label}
                  </p>
                  {!isAvailable && (
                    <p className="text-2xs text-muted-foreground mt-1">
                      Нет API-ключа
                    </p>
                  )}
                  {isSelected && isAvailable && (
                    <div className="absolute top-0 right-0">
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Model selection */}
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Модель
          </Label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="mt-1.5 rounded-xl">
              <SelectValue placeholder="Выберите модель" />
            </SelectTrigger>
            <SelectContent>
              {modelsForProvider(selectedProvider).map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Whisper note */}
        <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/40 p-3.5 rounded-xl border border-border/40">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
          <span>
            Whisper (распознавание голоса) всегда использует OpenAI независимо от
            выбранного провайдера.
          </span>
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
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
              Сохранить
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Telegram Targets Section
// ============================================

function TelegramTargetsSection() {
  const { toastSuccess, toastError } = useToast();
  const [targets, setTargets] = useState<TelegramNotificationTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<TelegramNotificationTarget | null>(null);
  const [showForm, setShowForm] = useState(false);
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
              Группы для отправки напоминаний о встречах
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

        <div className="p-6 space-y-3">
          {targets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
              <MessageCircle className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Нет настроенных групп</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Добавьте Telegram-группы для отправки напоминаний
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {targets.map((target) => (
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
                    <p className="text-sm font-medium truncate">
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
            </span>
          </div>
        </div>
      </div>

      {/* Telegram target form dialog */}
      {showForm && (
        <TelegramTargetFormDialog
          target={editTarget}
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
  onClose,
  onSaved,
}: {
  target: TelegramNotificationTarget | null;
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
      const data = {
        chat_id: chatIdNum,
        thread_id: threadId ? Number(threadId) : null,
        label: label.trim() || null,
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

function NotificationsSection() {
  const { toastSuccess, toastError } = useToast();
  const [subscriptions, setSubscriptions] = useState<Record<string, boolean>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getNotificationSubscriptions()
      .then((data) => setSubscriptions(data.subscriptions))
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
      const result = await api.updateNotificationSubscriptions(subscriptions);
      setSubscriptions(result.subscriptions);
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
                    <p className="text-sm font-medium truncate">
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
                    className="shrink-0 rounded-lg text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
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
  reminder,
  onClose,
  onSaved,
}: {
  member: TeamMember;
  reminder: ReminderSettings | null;
  onClose: () => void;
  onSaved: () => void;
}) {
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
  const [includeInProgress, setIncludeInProgress] = useState(
    reminder?.include_in_progress ?? true
  );
  const [includeNew, setIncludeNew] = useState(
    reminder?.include_new ?? true
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localTimeInfo = useMemo(() => getLocalTimeFromMoscow(time), [time]);
  const hasAnyDigestSectionEnabled =
    includeOverdue || includeUpcoming || includeInProgress || includeNew;

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

  const setAllDigestSections = (value: boolean) => {
    setIncludeOverdue(value);
    setIncludeUpcoming(value);
    setIncludeInProgress(value);
    setIncludeNew(value);
    setIsEnabled(value);
  };

  const handleReminderEnabledToggle = (value: boolean) => {
    if (value && !hasAnyDigestSectionEnabled) {
      setAllDigestSections(true);
      return;
    }
    setIsEnabled(value);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateReminderSettings(member.id, {
        is_enabled: isEnabled,
        reminder_time: time + ":00",
        days_of_week: days,
        include_overdue: includeOverdue,
        include_upcoming: includeUpcoming,
        include_in_progress: includeInProgress,
        include_new: includeNew,
      });
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
      <DialogContent className="sm:max-w-md">
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
            <div className="flex gap-1.5 mt-2">
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
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-lg px-2 text-xs"
                  disabled={saving}
                  onClick={() => setAllDigestSections(true)}
                >
                  Включить всё
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-lg px-2 text-xs"
                  disabled={saving}
                  onClick={() => setAllDigestSections(false)}
                >
                  Выключить всё
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-sm">Просроченные задачи</span>
                </div>
                <Switch
                  checked={includeOverdue}
                  onCheckedChange={setIncludeOverdue}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">Ближайшие по дедлайну (3 дня)</span>
                </div>
                <Switch
                  checked={includeUpcoming}
                  onCheckedChange={setIncludeUpcoming}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm">Задачи в работе</span>
                </div>
                <Switch
                  checked={includeInProgress}
                  onCheckedChange={setIncludeInProgress}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/40">
                <div className="flex items-center gap-2">
                  <CalendarPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">Новые задачи</span>
                </div>
                <Switch
                  checked={includeNew}
                  onCheckedChange={setIncludeNew}
                />
              </div>
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
            <Button
              className="rounded-xl"
              onClick={handleSave}
              disabled={saving}
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
