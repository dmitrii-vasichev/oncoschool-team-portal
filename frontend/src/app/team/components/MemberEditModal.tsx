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
import { AvatarUpload } from "./AvatarUpload";
import { DatePicker } from "@/components/shared/DatePicker";
import { PermissionService } from "@/lib/permissions";
import { api } from "@/lib/api";
import type { TeamMember, Department, MemberRole } from "@/lib/types";

interface MemberEditModalProps {
  member: TeamMember | null;
  departments: Department[];
  currentUser: TeamMember;
  onSave: () => void;
  onClose: () => void;
}

export function MemberEditModal({ member, departments, currentUser, onSave, onClose }: MemberEditModalProps) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [isActive, setIsActive] = useState(true);
  const [departmentId, setDepartmentId] = useState<string>("__none__");
  const [telegramId, setTelegramId] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [nameVariants, setNameVariants] = useState<string[]>([]);
  const [newVariant, setNewVariant] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canChangeRole = PermissionService.canManageRoles(currentUser);

  useEffect(() => {
    if (member) {
      setFullName(member.full_name);
      setRole(member.role);
      setIsActive(member.is_active);
      setDepartmentId(member.department_id || "__none__");
      setTelegramId(member.telegram_id != null ? String(member.telegram_id) : "");
      setTelegramUsername(member.telegram_username || "");
      setPosition(member.position || "");
      setEmail(member.email || "");
      setBirthday(member.birthday || "");
      setNameVariants([...member.name_variants]);
      setAvatarUrl(member.avatar_url);
      setError(null);
      setNewVariant("");
    }
  }, [member]);

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      const data: Record<string, unknown> = {
        full_name: fullName,
        is_active: isActive,
        department_id: departmentId === "__none__" ? null : departmentId,
        position: position || null,
        email: email || null,
        birthday: birthday || null,
        name_variants: nameVariants,
      };
      if (telegramId.trim()) {
        const parsed = parseInt(telegramId.trim(), 10);
        if (isNaN(parsed)) {
          setError("Telegram ID должен быть числом");
          setSaving(false);
          return;
        }
        data.telegram_id = parsed;
      } else {
        data.telegram_id = null;
      }
      data.telegram_username = telegramUsername.trim().replace(/^@/, "") || null;
      if (canChangeRole) {
        data.role = role;
      }
      await api.updateTeamMember(member.id, data as Partial<TeamMember>);
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
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

  if (!member) return null;

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
          <div className="grid grid-cols-2 gap-4">
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
                  <SelectItem value="active">Активен</SelectItem>
                  <SelectItem value="inactive">Неактивен</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Department */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Отдел
            </Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
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

          {/* Telegram ID + Username */}
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
