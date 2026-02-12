"use client";

import { useState } from "react";
import { Pencil, Loader2, X, Plus } from "lucide-react";
import { ModeratorGuard } from "@/components/shared/ModeratorGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { RoleBadge } from "@/components/shared/RoleBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useTeam } from "@/hooks/useTeam";
import { api } from "@/lib/api";
import type { TeamMember, MemberRole } from "@/lib/types";

export default function TeamPage() {
  return (
    <ModeratorGuard>
      <TeamContent />
    </ModeratorGuard>
  );
}

function TeamContent() {
  const { members, loading, refetch } = useTeam();
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<MemberRole>("member");
  const [editNameVariants, setEditNameVariants] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newVariant, setNewVariant] = useState("");

  const openEdit = (member: TeamMember) => {
    setEditMember(member);
    setEditFullName(member.full_name);
    setEditRole(member.role);
    setEditNameVariants([...member.name_variants]);
    setEditActive(member.is_active);
    setError(null);
    setNewVariant("");
  };

  const handleSave = async () => {
    if (!editMember) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateTeamMember(editMember.id, {
        full_name: editFullName,
        role: editRole,
        name_variants: editNameVariants,
        is_active: editActive,
      });
      setEditMember(null);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const addVariant = () => {
    const trimmed = newVariant.trim();
    if (trimmed && !editNameVariants.includes(trimmed)) {
      setEditNameVariants((prev) => [...prev, trimmed]);
      setNewVariant("");
    }
  };

  const removeVariant = (index: number) => {
    setEditNameVariants((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {members.length} участников
      </p>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-4 p-4"
              >
                <UserAvatar name={member.full_name} size="lg" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {member.full_name}
                    {!member.is_active && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (неактивен)
                      </span>
                    )}
                  </p>
                  {member.telegram_username && (
                    <p className="text-sm text-muted-foreground">
                      @{member.telegram_username}
                    </p>
                  )}
                  {member.name_variants.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Варианты: {member.name_variants.join(", ")}
                    </p>
                  )}
                </div>
                <RoleBadge role={member.role} />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(member)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!editMember}
        onOpenChange={(open) => !open && setEditMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать участника</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Полное имя</Label>
              <Input
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Роль</Label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as MemberRole)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moderator">Модератор</SelectItem>
                  <SelectItem value="member">Участник</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Варианты имени (для AI-матчинга)</Label>
              <div className="flex flex-wrap gap-1 mt-2">
                {editNameVariants.map((v, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeVariant(i)}
                  >
                    {v}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newVariant}
                  onChange={(e) => setNewVariant(e.target.value)}
                  placeholder="Добавить вариант..."
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
                  onClick={addVariant}
                  disabled={!newVariant.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>Статус</Label>
              <Select
                value={editActive ? "active" : "inactive"}
                onValueChange={(v) => setEditActive(v === "active")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Активен</SelectItem>
                  <SelectItem value="inactive">Неактивен</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditMember(null)}
                disabled={saving}
              >
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
    </div>
  );
}
