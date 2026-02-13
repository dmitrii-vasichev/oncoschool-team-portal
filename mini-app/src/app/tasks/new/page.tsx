"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useCreateTask } from "@/hooks/useTasks";
import { useBackButton } from "@/hooks/useBackButton";
import { useMainButton } from "@/hooks/useMainButton";
import { BottomNav } from "@/components/BottomNav";
import { Toast } from "@/components/Toast";
import { PageTransition } from "@/components/PageTransition";
import type { TaskPriority, TaskCreateRequest, TeamMember } from "@/lib/types";

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "⚪ Low" },
  { value: "medium", label: "🔵 Med" },
  { value: "high", label: "⚡ High" },
  { value: "urgent", label: "🔴 Urg" },
];

export default function NewTaskPage() {
  const router = useRouter();
  const { role } = useAuth();
  const mutation = useCreateTask();

  useBackButton();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [deadline, setDeadline] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isModerator = role === "admin" || role === "moderator";

  const { data: team } = useQuery<TeamMember[]>({
    queryKey: ["team"],
    queryFn: () => api.getTeam(),
    enabled: isModerator,
  });

  const handleCreate = useCallback(() => {
    if (!title.trim()) return;

    const data: TaskCreateRequest = {
      title: title.trim(),
      priority,
      source: "web",
      description: description.trim() || undefined,
      deadline: deadline || undefined,
      assignee_id: assigneeId || undefined,
    };

    mutation.mutate(data, {
      onSuccess: () => {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(
          "success"
        );
        router.replace("/tasks");
      },
      onError: (err) => {
        setToastMsg(err.message || "Ошибка создания задачи");
      },
    });
  }, [title, description, priority, deadline, assigneeId, mutation, router]);

  useMainButton({
    text: "Создать задачу",
    onClick: handleCreate,
    isVisible: title.trim().length > 0,
    isLoading: mutation.isPending,
  });

  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDescription(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  return (
    <PageTransition>
    <div className="min-h-screen bg-tg-bg px-4 pt-4 pb-20">
      <h1 className="text-lg font-bold text-tg-text mb-4">Новая задача</h1>

      {/* Title */}
      <div>
        <label className="text-sm text-tg-hint mb-1 block">Заголовок</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Что нужно сделать?"
          className="w-full bg-tg-secondary-bg rounded-xl px-3 py-2.5 text-sm text-tg-text border-0 outline-none placeholder:text-tg-hint"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-sm text-tg-hint mb-1 mt-4 block">
          Описание
        </label>
        <textarea
          value={description}
          onChange={handleDescriptionChange}
          placeholder="Подробности (необязательно)"
          className="w-full bg-tg-secondary-bg rounded-xl p-3 text-sm text-tg-text resize-none min-h-[60px] border-0 outline-none placeholder:text-tg-hint"
        />
      </div>

      {/* Priority */}
      <div>
        <label className="text-sm text-tg-hint mb-2 mt-4 block">
          Приоритет
        </label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              onClick={() => {
                setPriority(p.value);
                window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
              }}
              className={`flex-1 py-2 rounded-xl text-center text-sm font-medium transition-colors ${
                priority === p.value
                  ? "bg-tg-button text-tg-button-text"
                  : "bg-tg-secondary-bg text-tg-hint"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deadline */}
      <div>
        <label className="text-sm text-tg-hint mb-1 mt-4 block">
          Дедлайн
        </label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full bg-tg-secondary-bg rounded-xl px-3 py-2.5 text-sm text-tg-text border-0 outline-none"
        />
      </div>

      {/* Assignee (moderator/admin only) */}
      {isModerator && (
        <div>
          <label className="text-sm text-tg-hint mb-1 mt-4 block">
            Назначить
          </label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full bg-tg-secondary-bg rounded-xl px-3 py-2.5 text-sm text-tg-text border-0 outline-none appearance-none"
          >
            <option value="">Себе</option>
            {(team || [])
              .filter((m) => m.is_active)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
          </select>
        </div>
      )}

      <BottomNav />

      <Toast
        message={toastMsg}
        type="error"
        onClose={() => setToastMsg(null)}
      />
    </div>
    </PageTransition>
  );
}
