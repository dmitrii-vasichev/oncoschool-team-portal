"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import type { Department, TeamMember } from "@/lib/types";

const COLOR_OPTIONS = [
  "#4F46E5", "#0891B2", "#059669", "#D97706", "#DC2626",
  "#7C3AED", "#DB2777", "#2563EB", "#65A30D", "#EA580C",
];

interface DepartmentManagerProps {
  open: boolean;
  departments: Department[];
  members: TeamMember[];
  onUpdate: () => void;
  onClose: () => void;
}

interface DeptForm {
  name: string;
  description: string;
  color: string;
  head_id: string;
  sort_order: number;
}

const emptyForm: DeptForm = {
  name: "",
  description: "",
  color: COLOR_OPTIONS[0],
  head_id: "__none__",
  sort_order: 0,
};

export function DepartmentManager({ open, departments, members, onUpdate, onClose }: DepartmentManagerProps) {
  const { toastSuccess, toastError } = useToast();
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<DeptForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const showForm = creating || editingDept !== null;

  const membersInDept = (deptId: string) =>
    members.filter((m) => m.department_id === deptId).length;

  const startCreate = () => {
    setEditingDept(null);
    setCreating(true);
    setForm(emptyForm);
  };

  const startEdit = (dept: Department) => {
    setCreating(false);
    setEditingDept(dept);
    setForm({
      name: dept.name,
      description: dept.description || "",
      color: dept.color || COLOR_OPTIONS[0],
      head_id: dept.head_id || "__none__",
      sort_order: dept.sort_order,
    });
  };

  const cancelForm = () => {
    setCreating(false);
    setEditingDept(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        color: form.color,
        head_id: form.head_id === "__none__" ? null : form.head_id,
        sort_order: form.sort_order,
      };
      if (editingDept) {
        await api.updateDepartment(editingDept.id, data);
        toastSuccess("Отдел обновлён");
      } else {
        await api.createDepartment(data);
        toastSuccess("Отдел создан");
      }
      cancelForm();
      onUpdate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept: Department) => {
    const count = membersInDept(dept.id);
    if (count > 0) {
      toastError(`Нельзя удалить: в отделе ${count} участников. Сначала переместите их.`);
      return;
    }
    setDeleting(dept.id);
    try {
      await api.deleteDepartment(dept.id);
      toastSuccess("Отдел удалён");
      onUpdate();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Управление отделами</DialogTitle>
        </DialogHeader>

        {/* Department list */}
        {!showForm && (
          <div className="space-y-2">
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Нет отделов
              </p>
            ) : (
              departments.map((dept) => (
                <div
                  key={dept.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
                >
                  <span
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: dept.color || "#6B7280" }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-heading font-semibold truncate block">
                      {dept.name}
                    </span>
                    <span className="text-2xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {membersInDept(dept.id)} чел.
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    onClick={() => startEdit(dept)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-destructive hover:text-destructive"
                    onClick={() => handleDelete(dept)}
                    disabled={deleting === dept.id}
                  >
                    {deleting === dept.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ))
            )}

            <Button
              variant="outline"
              className="w-full rounded-xl gap-2 mt-2"
              onClick={startCreate}
            >
              <Plus className="h-4 w-4" />
              Добавить отдел
            </Button>
          </div>
        )}

        {/* Create / Edit form */}
        {showForm && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Название *
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Разработка"
                className="mt-1.5 rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Описание
              </Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Описание отдела..."
                className="mt-1.5 rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Цвет
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    className={`h-7 w-7 rounded-full transition-all ${
                      form.color === c
                        ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    type="button"
                  />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Руководитель
              </Label>
              <Select
                value={form.head_id}
                onValueChange={(v) => setForm((f) => ({ ...f, head_id: v }))}
              >
                <SelectTrigger className="mt-1.5 rounded-xl">
                  <SelectValue placeholder="Выберите..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Не назначен</SelectItem>
                  {members
                    .filter((m) => m.is_active)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Порядок сортировки
              </Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                className="mt-1.5 rounded-xl w-24"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={cancelForm}
                disabled={saving}
              >
                Назад
              </Button>
              <Button
                className="rounded-xl"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : editingDept ? (
                  "Обновить"
                ) : (
                  "Создать"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
