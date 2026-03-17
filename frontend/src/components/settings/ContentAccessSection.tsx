"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Loader2,
  Plus,
  Trash2,
  Users,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useToast } from "@/components/shared/Toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { api } from "@/lib/api";
import { useTeam } from "@/hooks/useTeam";
import { useDepartments } from "@/hooks/useDepartments";
import type {
  ContentAccess,
  ContentRole,
  ContentSubSection,
} from "@/lib/types";

const SUB_SECTION_LABELS: Record<string, string> = {
  telegram_analysis: "Telegram-анализ",
};

const ROLE_LABELS: Record<string, string> = {
  operator: "Оператор",
  editor: "Редактор",
};

const ROLE_COLORS: Record<string, string> = {
  operator: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  editor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

/**
 * Content access management section for admin settings.
 * Shows a table of access grants and allows adding/removing access.
 */
export function ContentAccessSection() {
  const { toastSuccess, toastError } = useToast();
  const { members } = useTeam();
  const { departments } = useDepartments();
  const [grants, setGrants] = useState<ContentAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteGrant, setDeleteGrant] = useState<ContentAccess | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchGrants = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getContentAccess();
      setGrants(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGrants();
  }, [fetchGrants]);

  const handleDelete = async () => {
    if (!deleteGrant) return;
    setDeleting(true);
    try {
      await api.revokeContentAccess(deleteGrant.id);
      setGrants((prev) => prev.filter((g) => g.id !== deleteGrant.id));
      toastSuccess("Доступ отозван");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
      setDeleteGrant(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up stagger-3 rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-6 pb-0">
        <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-violet-500" />
        </div>
        <div className="flex-1">
          <h2 className="font-heading font-semibold text-base">
            Доступ к контенту
          </h2>
          <p className="text-xs text-muted-foreground">
            Управление доступом пользователей и отделов к модулю контента
          </p>
        </div>
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить
        </Button>
      </div>

      <div className="p-6">
        {grants.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Доступ никому не выдан</p>
            <p className="text-xs mt-1">
              Администраторы имеют полный доступ по умолчанию
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Раздел
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Кому
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Роль
                  </th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {grants.map((grant) => (
                  <tr
                    key={grant.id}
                    className="border-b border-border/40 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm">
                        {SUB_SECTION_LABELS[grant.sub_section] ||
                          grant.sub_section}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {grant.member_id ? (
                          <>
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{grant.member_name || "—"}</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{grant.department_name || "—"}</span>
                            <Badge
                              variant="outline"
                              className="text-2xs px-1.5 py-0"
                            >
                              отдел
                            </Badge>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`${ROLE_COLORS[grant.role] || ""} text-xs`}
                      >
                        {ROLE_LABELS[grant.role] || grant.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteGrant(grant)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add dialog */}
      <AddAccessDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        members={members}
        departments={departments}
        onGranted={(grant) => {
          setGrants((prev) => [...prev, grant]);
          setShowAddDialog(false);
        }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteGrant}
        onOpenChange={(open) => !open && setDeleteGrant(null)}
        title="Отозвать доступ?"
        description={`${deleteGrant?.member_name || deleteGrant?.department_name || ""} потеряет доступ к разделу "${SUB_SECTION_LABELS[deleteGrant?.sub_section || ""] || ""}".`}
        confirmLabel="Отозвать"
        variant="destructive"
        onConfirm={handleDelete}
        confirmDisabled={deleting}
      />
    </div>
  );
}

/* ── Add Access Dialog ── */

function AddAccessDialog({
  open,
  onOpenChange,
  members,
  departments,
  onGranted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: { id: string; full_name: string; avatar_url: string | null }[];
  departments: { id: string; name: string }[];
  onGranted: (grant: ContentAccess) => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [subSection, setSubSection] = useState<ContentSubSection>("telegram_analysis");
  const [targetType, setTargetType] = useState<"member" | "department">("member");
  const [targetId, setTargetId] = useState("");
  const [role, setRole] = useState<ContentRole>("operator");
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSubSection("telegram_analysis");
      setTargetType("member");
      setTargetId("");
      setRole("operator");
    }
  }, [open]);

  const handleSave = async () => {
    if (!targetId) {
      toastError("Выберите пользователя или отдел");
      return;
    }
    setSaving(true);
    try {
      const grant = await api.grantContentAccess({
        sub_section: subSection,
        member_id: targetType === "member" ? targetId : null,
        department_id: targetType === "department" ? targetId : null,
        role,
      });
      onGranted(grant);
      toastSuccess("Доступ выдан");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Выдать доступ</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Sub-section */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Раздел</Label>
            <Select
              value={subSection}
              onValueChange={(v) => setSubSection(v as ContentSubSection)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telegram_analysis">
                  Telegram-анализ
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Target type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Кому</Label>
            <div className="flex gap-2">
              <Button
                variant={targetType === "member" ? "default" : "outline"}
                size="sm"
                className="rounded-xl flex-1 gap-1.5"
                onClick={() => {
                  setTargetType("member");
                  setTargetId("");
                }}
              >
                <Users className="h-3.5 w-3.5" />
                Пользователь
              </Button>
              <Button
                variant={targetType === "department" ? "default" : "outline"}
                size="sm"
                className="rounded-xl flex-1 gap-1.5"
                onClick={() => {
                  setTargetType("department");
                  setTargetId("");
                }}
              >
                <Building2 className="h-3.5 w-3.5" />
                Отдел
              </Button>
            </div>
          </div>

          {/* Target select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {targetType === "member" ? "Пользователь" : "Отдел"}
            </Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue
                  placeholder={
                    targetType === "member"
                      ? "Выберите пользователя"
                      : "Выберите отдел"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {targetType === "member"
                  ? members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          <UserAvatar
                            name={m.full_name}
                            avatarUrl={m.avatar_url}
                            size="sm"
                          />
                          {m.full_name}
                        </span>
                      </SelectItem>
                    ))
                  : departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Роль</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as ContentRole)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operator">
                  <div>
                    <span className="font-medium">Оператор</span>
                    <span className="text-muted-foreground text-xs ml-2">
                      — просмотр и запуск анализа
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="editor">
                  <div>
                    <span className="font-medium">Редактор</span>
                    <span className="text-muted-foreground text-xs ml-2">
                      — + управление каналами и промптами
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full rounded-xl"
            onClick={handleSave}
            disabled={saving || !targetId}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Выдать доступ
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
