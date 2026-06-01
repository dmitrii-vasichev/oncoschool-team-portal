"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";
import type { TeamMember } from "@/lib/types";

const MAX = 280;

export function KudosDialog({
  open, onOpenChange, currentUserId, members, onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  members: TeamMember[];
  onSent: () => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [recipientId, setRecipientId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setRecipientId("");
    setMessage("");
  }

  const candidates = members.filter((m) => m.is_active && m.id !== currentUserId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientId || !message.trim()) {
      toastError("Выберите коллегу и напишите сообщение");
      return;
    }
    setSaving(true);
    try {
      await api.giveKudos(recipientId, message.trim());
      reset();
      onOpenChange(false);
      onSent();
      toastSuccess("Спасибо отправлено!");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Поблагодарить коллегу</DialogTitle>
          <DialogDescription>Спасибо появится в Пульсе команды</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Кого</Label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger><SelectValue placeholder="Выберите коллегу" /></SelectTrigger>
              <SelectContent>
                {candidates.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
                      <UserAvatar name={m.full_name} avatarUrl={m.avatar_url} size="sm" />
                      <span className="truncate">{m.full_name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kudos-msg">За что</Label>
            <Textarea
              id="kudos-msg"
              value={message}
              maxLength={MAX}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Спасибо за помощь с…"
              rows={3}
            />
            <p className="text-right text-xs text-muted-foreground">{message.length}/{MAX}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button type="submit" disabled={saving || !recipientId || !message.trim()} className="min-w-[120px]">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Отправка…</> : "Отправить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
