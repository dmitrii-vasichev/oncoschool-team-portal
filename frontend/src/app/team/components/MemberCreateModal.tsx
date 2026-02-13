"use client";

import { useState } from "react";
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
import { DatePicker } from "@/components/shared/DatePicker";
import { PermissionService } from "@/lib/permissions";
import { api } from "@/lib/api";
import type { TeamMember, Department, MemberRole } from "@/lib/types";

interface MemberCreateModalProps {
  open: boolean;
  departments: Department[];
  currentUser: TeamMember;
  onCreated: () => void;
  onClose: () => void;
}

export function MemberCreateModal({ open, departments, currentUser, onCreated, onClose }: MemberCreateModalProps) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [telegramId, setTelegramId] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("__none__");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [nameVariants, setNameVariants] = useState<string[]>([]);
  const [newVariant, setNewVariant] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = PermissionService.isAdmin(currentUser);

  const resetForm = () => {
    setFullName("");
    setRole("member");
    setTelegramId("");
    setTelegramUsername("");
    setDepartmentId("__none__");
    setPosition("");
    setEmail("");
    setBirthday("");
    setNameVariants([]);
    setNewVariant("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!fullName.trim()) {
      setError("Укажите имя участника");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data: Record<string, unknown> = {
        full_name: fullName.trim(),
        role,
        department_id: departmentId === "__none__" ? null : departmentId,
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
      }
      if (telegramUsername.trim()) {
        data.telegram_username = telegramUsername.trim().replace(/^@/, "");
      }
      if (position.trim()) data.position = position.trim();
      if (email.trim()) data.email = email.trim();
      if (birthday) data.birthday = birthday;

      await api.createTeamMember(data as Parameters<typeof api.createTeamMember>[0]);
      resetForm();
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания");
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

  // Available roles based on current user
  const availableRoles: { value: MemberRole; label: string }[] = isAdmin
    ? [
        { value: "admin", label: "Администратор" },
        { value: "moderator", label: "Модератор" },
        { value: "member", label: "Участник" },
      ]
    : [
        { value: "moderator", label: "Модератор" },
        { value: "member", label: "Участник" },
      ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Добавить участника
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Name */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Полное имя <span className="text-destructive">*</span>
            </Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иванов Иван Иванович"
              className="mt-1.5 rounded-xl"
            />
          </div>

          {/* Role + Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Роль
              </Label>
              <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                <SelectTrigger className="mt-1.5 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              onClick={handleClose}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleCreate}
              disabled={saving || !fullName.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Создание...
                </>
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
