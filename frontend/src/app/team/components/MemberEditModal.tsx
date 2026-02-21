"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AvatarUpload } from "./AvatarUpload";
import { DatePicker } from "@/components/shared/DatePicker";
import { PermissionService } from "@/lib/permissions";
import { api } from "@/lib/api";
import type {
  TeamMember,
  Department,
  MemberRole,
  MemberDeactivationStrategy,
  MemberDeactivationPreviewTaskItem,
  TeamMemberUpdateRequest,
} from "@/lib/types";

interface MemberEditModalProps {
  member: TeamMember | null;
  members: TeamMember[];
  departments: Department[];
  currentUser: TeamMember;
  onSave: () => void;
  onClose: () => void;
}

export function MemberEditModal({
  member,
  members,
  departments,
  currentUser,
  onSave,
  onClose,
}: MemberEditModalProps) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [isActive, setIsActive] = useState(true);
  const [deactivationStrategy, setDeactivationStrategy] =
    useState<MemberDeactivationStrategy>("unassign");
  const [reassignToMemberId, setReassignToMemberId] = useState("__none__");
  const [isTest, setIsTest] = useState(false);
  const [departmentId, setDepartmentId] = useState<string>("__none__");
  const [extraDepartmentIds, setExtraDepartmentIds] = useState<string[]>([]);
  const [newExtraDepartmentId, setNewExtraDepartmentId] = useState<string>("");
  const [telegramId, setTelegramId] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [nameVariants, setNameVariants] = useState<string[]>([]);
  const [newVariant, setNewVariant] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] =
    useState<TeamMemberUpdateRequest | null>(null);
  const [previewTasksCount, setPreviewTasksCount] = useState<number | null>(null);
  const [previewTasks, setPreviewTasks] = useState<
    MemberDeactivationPreviewTaskItem[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const canChangeRole = PermissionService.canManageRoles(currentUser);
  const canManageTestFlag = PermissionService.isAdmin(currentUser);

  useEffect(() => {
    if (member) {
      setFullName(member.full_name);
      setRole(member.role);
      setIsTest(member.is_test);
      setIsActive(member.is_active);
      setDepartmentId(member.department_id || "__none__");
      setExtraDepartmentIds(
        (member.extra_department_ids || []).filter(
          (id) => id !== member.department_id
        )
      );
      setNewExtraDepartmentId("");
      setTelegramId(member.telegram_id != null ? String(member.telegram_id) : "");
      setTelegramUsername(member.telegram_username || "");
      setPosition(member.position || "");
      setEmail(member.email || "");
      setBirthday(member.birthday || "");
      setNameVariants([...member.name_variants]);
      setAvatarUrl(member.avatar_url);
      setError(null);
      setNewVariant("");
      setDeactivationStrategy("unassign");
      setReassignToMemberId("__none__");
      setPreviewLoading(false);
      setConfirmOpen(false);
      setPendingPayload(null);
      setPreviewTasksCount(null);
      setPreviewTasks([]);
    }
  }, [member]);

  const buildPayload = (): TeamMemberUpdateRequest | null => {
    if (!member) return null;
    setError(null);
    const data: TeamMemberUpdateRequest = {
      full_name: fullName,
      is_active: isActive,
      department_id: departmentId === "__none__" ? null : departmentId,
      extra_department_ids: getEffectiveExtraDepartmentIds(),
      position: position || null,
      email: email || null,
      birthday: birthday || null,
      name_variants: nameVariants,
    };

    if (telegramId.trim()) {
      const parsed = parseInt(telegramId.trim(), 10);
      if (isNaN(parsed)) {
        setError("Telegram ID должен быть числом");
        return null;
      }
      data.telegram_id = parsed;
    } else {
      data.telegram_id = null;
    }

    data.telegram_username = telegramUsername.trim().replace(/^@/, "") || null;
    if (canChangeRole) {
      data.role = role;
    }
    if (canManageTestFlag) {
      data.is_test = isTest;
    }

    const isSwitchingToInactive = member.is_active && !isActive;
    if (isSwitchingToInactive) {
      data.deactivation_strategy = deactivationStrategy;
      if (deactivationStrategy === "reassign") {
        if (reassignToMemberId === "__none__") {
          setError("Выберите участника для переназначения задач");
          return null;
        }
        data.reassign_to_member_id = reassignToMemberId;
      } else {
        data.reassign_to_member_id = null;
      }
    }

    return data;
  };

  const submitPayload = async (payload: TeamMemberUpdateRequest) => {
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateTeamMember(member.id, payload);
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!member) return;
    const payload = buildPayload();
    if (!payload) return;

    const isSwitchingToInactive = member.is_active && !isActive;
    if (!isSwitchingToInactive) {
      await submitPayload(payload);
      return;
    }

    setPreviewLoading(true);
    setError(null);
    try {
      const preview = await api.getTeamMemberDeactivationPreview(member.id);
      setPreviewTasksCount(preview.open_tasks_count);
      setPreviewTasks(preview.open_tasks_preview || []);
      setPendingPayload(payload);
      setConfirmOpen(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Не удалось получить данные по задачам для деактивации"
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmDeactivation = async () => {
    if (!pendingPayload) return;
    const payload = pendingPayload;
    setConfirmOpen(false);
    setPendingPayload(null);
    await submitPayload(payload);
  };

  const addVariant = () => {
    const trimmed = newVariant.trim();
    if (trimmed && !nameVariants.includes(trimmed)) {
      setNameVariants((prev) => [...prev, trimmed]);
      setNewVariant("");
    }
  };

  const removeVariant = (index: number) => {
    setNameVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDepartmentChange = (value: string) => {
    setDepartmentId(value);
    if (value !== "__none__") {
      setExtraDepartmentIds((prev) => prev.filter((id) => id !== value));
      if (newExtraDepartmentId === value) {
        setNewExtraDepartmentId("");
      }
    }
  };

  const getEffectiveExtraDepartmentIds = () => {
    const ids = [...extraDepartmentIds];
    if (
      newExtraDepartmentId &&
      newExtraDepartmentId !== departmentId &&
      !ids.includes(newExtraDepartmentId)
    ) {
      ids.push(newExtraDepartmentId);
    }
    return ids;
  };

  const handleExtraDepartmentSelect = (value: string) => {
    setNewExtraDepartmentId(value);
    if (value === departmentId || extraDepartmentIds.includes(value)) {
      setNewExtraDepartmentId("");
      return;
    }
    setExtraDepartmentIds((prev) => [...prev, value]);
    setNewExtraDepartmentId("");
  };

  const removeExtraDepartment = (departmentIdToRemove: string) => {
    setExtraDepartmentIds((prev) =>
      prev.filter((deptId) => deptId !== departmentIdToRemove)
    );
  };

  if (!member) return null;

  const isDeactivationFlow = member.is_active && !isActive;
  const reassignCandidates = members.filter(
    (m) => m.id !== member.id && m.is_active
  );
  const selectedReassignMember = reassignCandidates.find(
    (m) => m.id === reassignToMemberId
  );
  const deactivationResultLabel =
    deactivationStrategy === "reassign"
      ? selectedReassignMember
        ? `будут переназначены на ${selectedReassignMember.full_name}`
        : "будут переназначены на выбранного участника"
      : "станут «Не назначен»";
  const deactivationOutcomeText =
    (previewTasksCount ?? 0) > 0
      ? `После деактивации эти задачи ${deactivationResultLabel}.`
      : "Незавершённых задач нет, перенос не потребуется.";
  const selectedExtraDepartments = extraDepartmentIds
    .map((id) => departments.find((dept) => dept.id === id))
    .filter((dept): dept is Department => Boolean(dept));
  const availableExtraDepartments = departments.filter(
    (dept) =>
      dept.id !== departmentId && !extraDepartmentIds.includes(dept.id)
  );

  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Редактировать участника
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Avatar */}
          <AvatarUpload
            memberId={member.id}
            currentAvatarUrl={avatarUrl}
            memberName={fullName}
            onAvatarChange={setAvatarUrl}
          />

          {/* Name */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Полное имя
            </Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1.5 rounded-xl"
            />
          </div>

          {/* Role + Status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Роль
              </Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as MemberRole)}
                disabled={!canChangeRole}
              >
                <SelectTrigger className="mt-1.5 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="moderator">Модератор</SelectItem>
                  <SelectItem value="member">Участник</SelectItem>
                </SelectContent>
              </Select>
              {!canChangeRole && (
                <p className="text-2xs text-muted-foreground mt-1">
                  Только администратор может менять роли
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Статус
              </Label>
              <Select
                value={isActive ? "active" : "inactive"}
                onValueChange={(v) => setIsActive(v === "active")}
              >
                <SelectTrigger className="mt-1.5 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Активен (доступ открыт)</SelectItem>
                  <SelectItem value="inactive">Деактивирован (доступ закрыт)</SelectItem>
                </SelectContent>
              </Select>
              {isDeactivationFlow && (
                <p className="text-2xs text-muted-foreground mt-1">
                  Участник потеряет доступ к порталу и боту сразу после сохранения.
                </p>
              )}
              {!isActive && !isDeactivationFlow && (
                <p className="text-2xs text-muted-foreground mt-1">
                  Участник уже деактивирован. Включите статус «Активен», чтобы вернуть доступ.
                </p>
              )}
            </div>
          </div>

          {canManageTestFlag && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Тип участника
              </Label>
              <Select
                value={isTest ? "test" : "regular"}
                onValueChange={(value) => setIsTest(value === "test")}
              >
                <SelectTrigger className="mt-1.5 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Обычный участник</SelectItem>
                  <SelectItem value="test">Тестовый участник</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-2xs text-muted-foreground mt-1">
                Тестовый участник скрыт в интерфейсе и не входит в общий счётчик.
              </p>
            </div>
          )}

          {isDeactivationFlow && (
            <div className="rounded-xl border border-amber-300/50 bg-amber-50/50 p-3 space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Что сделать с незавершёнными задачами
                </Label>
                <Select
                  value={deactivationStrategy}
                  onValueChange={(v) => setDeactivationStrategy(v as MemberDeactivationStrategy)}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassign">
                      Снять исполнителя (в «Не назначен»)
                    </SelectItem>
                    <SelectItem
                      value="reassign"
                      disabled={reassignCandidates.length === 0}
                    >
                      Переназначить другому участнику
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {deactivationStrategy === "reassign" && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Новый исполнитель
                  </Label>
                  <Select
                    value={reassignToMemberId}
                    onValueChange={setReassignToMemberId}
                  >
                    <SelectTrigger className="mt-1.5 rounded-xl">
                      <SelectValue placeholder="Выберите участника" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Выберите участника</SelectItem>
                      {reassignCandidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {deactivationStrategy === "unassign" && (
                <p className="text-2xs text-muted-foreground">
                  Все незавершённые задачи участника станут «Не назначен», их можно будет отдельно отфильтровать и переназначить позже.
                </p>
              )}
            </div>
          )}

          {/* Department */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Отдел
            </Label>
            <Select value={departmentId} onValueChange={handleDepartmentChange}>
              <SelectTrigger className="mt-1.5 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Без отдела</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: dept.color || "#6B7280" }}
                      />
                      {dept.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Extra department access */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Дополнительные отделы доступа
            </Label>
            <div className="flex gap-2 mt-1.5">
              <Select
                value={newExtraDepartmentId || undefined}
                onValueChange={handleExtraDepartmentSelect}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Добавить отдел" />
                </SelectTrigger>
                <SelectContent>
                  {availableExtraDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: dept.color || "#6B7280" }}
                        />
                        {dept.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2 min-h-[32px]">
              {selectedExtraDepartments.length > 0 ? (
                selectedExtraDepartments.map((dept) => (
                  <Badge
                    key={dept.id}
                    variant="secondary"
                    className="cursor-pointer rounded-lg gap-1 hover:bg-destructive/10 hover:text-destructive group/chip"
                    onClick={() => removeExtraDepartment(dept.id)}
                  >
                    {dept.name}
                    <X className="h-3 w-3 opacity-50 group-hover/chip:opacity-100" />
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground/60 self-center">
                  Нет дополнительных отделов
                </span>
              )}
            </div>
          </div>

          {/* Telegram ID + Username */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Telegram ID
              </Label>
              <Input
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="123456789"
                className="mt-1.5 rounded-xl"
              />
              <p className="text-2xs text-muted-foreground mt-1">
                Для работы с ботом
              </p>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Telegram Username
              </Label>
              <Input
                value={telegramUsername}
                onChange={(e) => setTelegramUsername(e.target.value)}
                placeholder="@username"
                className="mt-1.5 rounded-xl"
              />
            </div>
          </div>

          {/* Position */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Должность
            </Label>
            <Input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Разработчик, Дизайнер..."
              className="mt-1.5 rounded-xl"
            />
          </div>

          {/* Email + Birthday */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                День рождения
              </Label>
              <DatePicker
                value={birthday}
                onChange={setBirthday}
                placeholder="Не указан"
                clearable
                yearRange={[1930, new Date().getFullYear()]}
                className="w-full mt-1.5 rounded-xl"
              />
            </div>
          </div>

          {/* Name variants */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Варианты имени (для AI-матчинга)
            </Label>
            <div className="flex flex-wrap gap-1.5 mt-2 min-h-[32px]">
              {nameVariants.map((v, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="cursor-pointer rounded-lg gap-1 hover:bg-destructive/10 hover:text-destructive group/chip"
                  onClick={() => removeVariant(i)}
                >
                  {v}
                  <X className="h-3 w-3 opacity-50 group-hover/chip:opacity-100" />
                </Badge>
              ))}
              {nameVariants.length === 0 && (
                <span className="text-xs text-muted-foreground/60 self-center">
                  Нет вариантов
                </span>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                value={newVariant}
                onChange={(e) => setNewVariant(e.target.value)}
                placeholder="Добавить вариант..."
                className="rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addVariant();
                  }
                }}
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 rounded-xl"
                onClick={addVariant}
                disabled={!newVariant.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

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
              onClick={handleSave}
              disabled={saving || previewLoading}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : previewLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Подготовка...
                </>
              ) : (
                "Сохранить"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setPendingPayload(null);
            setPreviewTasksCount(null);
            setPreviewTasks([]);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердить деактивацию?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>
                  У участника <span className="font-medium text-foreground">{previewTasksCount ?? 0}</span>{" "}
                  незавершённых задач.
                </p>
                {previewTasks.length > 0 ? (
                  <div className="rounded-md border border-border/70 bg-muted/30 p-2.5">
                    <p className="text-xs font-medium text-foreground mb-1.5">
                      Задачи:
                    </p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {previewTasks.map((task) => (
                        <li key={task.short_id}>
                          #{task.short_id} · {task.title}
                        </li>
                      ))}
                    </ul>
                    {(previewTasksCount ?? 0) > previewTasks.length && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        и ещё {Math.max(0, (previewTasksCount ?? 0) - previewTasks.length)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p>Незавершённых задач нет.</p>
                )}
                <p>{deactivationOutcomeText}</p>
                <p>
                  Доступ к порталу и Telegram-боту будет отключён.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Отмена</AlertDialogCancel>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeactivation}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Выполняю...
                </>
              ) : (
                "Деактивировать"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
