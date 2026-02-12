"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Bell,
  Clock,
  Loader2,
  Save,
  Users,
  Settings,
  Info,
} from "lucide-react";
import { ModeratorGuard } from "@/components/shared/ModeratorGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import { api } from "@/lib/api";
import { useTeam } from "@/hooks/useTeam";
import type { AISettingsResponse, ReminderSettings, TeamMember } from "@/lib/types";

export default function SettingsPage() {
  return (
    <ModeratorGuard>
      <div className="max-w-3xl space-y-6">
        <AIModelSection />
        <NotificationsSection />
        <RemindersSection />
      </div>
    </ModeratorGuard>
  );
}

// ============================================
// AI Model Section
// ============================================

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
};

function AIModelSection() {
  const [settings, setSettings] = useState<AISettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await api.updateAiSettings({
        provider: selectedProvider,
        model: selectedModel,
      });
      setSettings(result);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
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
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  const allProviders = ["anthropic", "openai", "gemini"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI-модель для парсинга
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider selection */}
        <div>
          <Label>Провайдер</Label>
          <div className="flex gap-2 mt-2">
            {allProviders.map((provider) => {
              const isAvailable = settings?.available_providers?.[provider];
              const isSelected = selectedProvider === provider;
              return (
                <Button
                  key={provider}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  disabled={!isAvailable}
                  onClick={() => handleProviderChange(provider)}
                  className="flex-1"
                >
                  {PROVIDER_LABELS[provider] || provider}
                  {!isAvailable && (
                    <span className="ml-1 text-xs opacity-60">
                      (нет ключа)
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Model selection */}
        <div>
          <Label>Модель</Label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="mt-1">
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

        {/* Info note */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Whisper (распознавание голоса) всегда использует OpenAI независимо
            от выбранного провайдера.
          </span>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && (
          <p className="text-sm text-green-600">Настройки сохранены</p>
        )}

        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="w-full"
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
      </CardContent>
    </Card>
  );
}

// ============================================
// Notifications Section
// ============================================

const EVENT_TYPE_LABELS: Record<string, string> = {
  task_created: "Создание задачи",
  task_status_changed: "Изменение статуса задачи",
  task_completed: "Завершение задачи",
  task_overdue: "Просроченная задача",
  task_update_added: "Новое обновление задачи",
  meeting_created: "Создание встречи",
};

function NotificationsSection() {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Подписки на уведомления
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Получайте уведомления в Telegram при наступлении событий
        </p>

        <div className="space-y-3">
          {Object.entries(EVENT_TYPE_LABELS).map(([eventType, label]) => (
            <div
              key={eventType}
              className="flex items-center justify-between"
            >
              <Label
                htmlFor={`notify-${eventType}`}
                className="cursor-pointer"
              >
                {label}
              </Label>
              <Switch
                id={`notify-${eventType}`}
                checked={subscriptions[eventType] || false}
                onCheckedChange={() => handleToggle(eventType)}
              />
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full"
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
      </CardContent>
    </Card>
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

function RemindersSection() {
  const { members, loading: membersLoading } = useTeam();
  const [reminders, setReminders] = useState<Record<string, ReminderSettings | null>>({});
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBulkSaving(false);
    }
  };

  const loading = membersLoading || loadingReminders;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  const editMember = members.find((m) => m.id === editMemberId);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Напоминания команды
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bulk actions */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm flex-1">Массовые действия:</span>
            <Input
              type="time"
              value={bulkTime}
              onChange={(e) => setBulkTime(e.target.value)}
              className="w-28"
            />
            <Button
              size="sm"
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
              onClick={handleBulkDisable}
              disabled={bulkSaving}
            >
              Выключить
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Separator />

          {/* Members list */}
          <div className="space-y-2">
            {members.map((member) => {
              const reminder = reminders[member.id];
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 border rounded-md"
                >
                  <UserAvatar name={member.full_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.full_name}
                    </p>
                    {reminder?.is_enabled ? (
                      <p className="text-xs text-muted-foreground">
                        {reminder.reminder_time?.slice(0, 5)} |{" "}
                        {reminder.days_of_week
                          ?.map((d) => DAY_LABELS[d])
                          .join(", ")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Выключено</p>
                    )}
                  </div>
                  <Badge variant={reminder?.is_enabled ? "default" : "secondary"}>
                    {reminder?.is_enabled ? "Вкл" : "Выкл"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditMemberId(member.id)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
  const [time, setTime] = useState(reminder?.reminder_time?.slice(0, 5) ?? "09:00");
  const [days, setDays] = useState<number[]>(reminder?.days_of_week ?? [1, 2, 3, 4, 5]);
  const [includeOverdue, setIncludeOverdue] = useState(
    reminder?.include_overdue ?? true
  );
  const [includeUpcoming, setIncludeUpcoming] = useState(
    reminder?.include_upcoming ?? true
  );
  const [includeInProgress, setIncludeInProgress] = useState(
    reminder?.include_in_progress ?? true
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: number) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserAvatar name={member.full_name} size="sm" />
            Напоминания — {member.full_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Включено</Label>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <Separator />

          <div>
            <Label>Время отправки</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-32"
            />
          </div>

          <div>
            <Label>Дни недели</Label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <Button
                  key={day}
                  variant={days.includes(day) ? "default" : "outline"}
                  size="sm"
                  className="w-10 px-0"
                  onClick={() => toggleDay(day)}
                >
                  {DAY_LABELS[day]}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Что включить в дайджест</Label>
            <div className="flex items-center justify-between">
              <span className="text-sm">Просроченные задачи</span>
              <Switch
                checked={includeOverdue}
                onCheckedChange={setIncludeOverdue}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Ближайшие задачи (3 дня)</span>
              <Switch
                checked={includeUpcoming}
                onCheckedChange={setIncludeUpcoming}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Задачи в работе</span>
              <Switch
                checked={includeInProgress}
                onCheckedChange={setIncludeInProgress}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
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
