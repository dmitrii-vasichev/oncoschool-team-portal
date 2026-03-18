"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AtSign,
  Database,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/shared/Toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { api } from "@/lib/api";
import type { TelegramChannel, ChannelContentStats } from "@/lib/types";

interface ChannelsTabProps {
  isEditor: boolean;
}

export function ChannelsTab({ isEditor }: ChannelsTabProps) {
  const { toastSuccess, toastError } = useToast();
  const [channels, setChannels] = useState<ChannelContentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editChannel, setEditChannel] = useState<TelegramChannel | null>(null);
  const [deleteChannel, setDeleteChannel] = useState<TelegramChannel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDataInventory();
      setChannels(data.channels);
    } catch {
      // Try basic list
      try {
        const basic = await api.getChannels();
        setChannels(
          basic.map((ch) => ({
            ...ch,
            total_count: 0,
            post_count: 0,
            comment_count: 0,
            earliest_date: null,
            latest_date: null,
          }))
        );
      } catch {
        toastError("Не удалось загрузить каналы");
      }
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const handleDelete = async () => {
    if (!deleteChannel) return;
    setDeleting(true);
    try {
      await api.deleteChannel(deleteChannel.id);
      setChannels((prev) => prev.filter((c) => c.id !== deleteChannel.id));
      toastSuccess("Канал удалён");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
      setDeleteChannel(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {channels.length} {channels.length === 1 ? "канал" : "каналов"}
        </p>
        {isEditor && (
          <Button
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить канал
          </Button>
        )}
      </div>

      {/* Channel list */}
      {channels.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Database className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Каналы не добавлены</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Канал
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Посты
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Комментарии
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Период
                </th>
                {isEditor && <th className="px-4 py-3 w-20" />}
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr
                  key={ch.id}
                  className="border-b border-border/40 last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium">{ch.display_name}</span>
                      <span className="text-muted-foreground ml-2 text-xs flex items-center gap-1 inline-flex">
                        <AtSign className="h-3 w-3" />
                        {ch.username}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {ch.post_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {ch.comment_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {ch.earliest_date && ch.latest_date ? (
                      <span className="flex items-center gap-1 justify-end">
                        <Calendar className="h-3 w-3" />
                        {new Date(ch.earliest_date).toLocaleDateString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}
                        {" — "}
                        {new Date(ch.latest_date).toLocaleDateString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  {isEditor && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditChannel(ch)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteChannel(ch)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit dialog */}
      <ChannelFormDialog
        open={showAdd || !!editChannel}
        onOpenChange={(open) => {
          if (!open) {
            setShowAdd(false);
            setEditChannel(null);
          }
        }}
        channel={editChannel}
        onSaved={() => {
          setShowAdd(false);
          setEditChannel(null);
          fetchChannels();
        }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteChannel}
        onOpenChange={(open) => !open && setDeleteChannel(null)}
        title="Удалить канал?"
        description={`Канал @${deleteChannel?.username} будет удалён. Загруженный контент останется в базе.`}
        confirmLabel="Удалить"
        variant="destructive"
        onConfirm={handleDelete}
        confirmDisabled={deleting}
      />
    </div>
  );
}

/* ── Channel Form Dialog ── */

function ChannelFormDialog({
  open,
  onOpenChange,
  channel,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: TelegramChannel | null;
  onSaved: () => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = !!channel;

  useEffect(() => {
    if (open && channel) {
      setUsername(channel.username);
      setDisplayName(channel.display_name);
    } else if (open) {
      setUsername("");
      setDisplayName("");
    }
  }, [open, channel]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEdit && channel) {
        await api.updateChannel(channel.id, { display_name: displayName.trim() });
        toastSuccess("Канал обновлён");
      } else {
        await api.createChannel({
          username: username.trim().replace(/^@/, ""),
          display_name: displayName.trim(),
        });
        toastSuccess("Канал добавлен");
      }
      onSaved();
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
          <DialogTitle>
            {isEdit ? "Редактировать канал" : "Добавить канал"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Username</Label>
            <Input
              placeholder="channel_name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-xl"
              disabled={isEdit}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Название</Label>
            <Input
              placeholder="Отображаемое название"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-xl"
              autoFocus
            />
          </div>
          <Button
            className="w-full rounded-xl"
            onClick={handleSave}
            disabled={saving || !displayName.trim() || (!isEdit && !username.trim())}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit ? (
              "Сохранить"
            ) : (
              "Добавить"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
