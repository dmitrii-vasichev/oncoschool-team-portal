"use client";

import { use, useState, useCallback } from "react";
import { useTask, useUpdateTask } from "@/hooks/useTasks";
import { useAuth } from "@/providers/AuthProvider";
import { useBackButton } from "@/hooks/useBackButton";
import { UpdateTimeline } from "@/components/UpdateTimeline";
import { AddUpdateSheet } from "@/components/AddUpdateSheet";
import { ReassignSheet } from "@/components/ReassignSheet";
import { BottomNav } from "@/components/BottomNav";
import { Toast } from "@/components/Toast";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import { FullScreenError } from "@/components/FullScreenError";
import { PageTransition } from "@/components/PageTransition";
import type { TaskStatus, TaskPriority } from "@/lib/types";

const STATUS_CONFIG: Record<
  TaskStatus,
  { className: string; label: string }
> = {
  new: { className: "bg-blue-100 text-blue-700", label: "Новая" },
  in_progress: { className: "bg-amber-100 text-amber-700", label: "В работе" },
  review: { className: "bg-purple-100 text-purple-700", label: "Ревью" },
  done: { className: "bg-green-100 text-green-700", label: "Готово" },
  cancelled: { className: "bg-gray-100 text-gray-500", label: "Отменена" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { icon: string; label: string }> = {
  urgent: { icon: "🔴", label: "Срочный" },
  high: { icon: "⚡", label: "Высокий" },
  medium: { icon: "🔵", label: "Средний" },
  low: { icon: "⚪", label: "Низкий" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function isOverdue(deadline: string, status: TaskStatus): boolean {
  if (status === "done" || status === "cancelled") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const shortId = parseInt(id, 10);
  const { role } = useAuth();
  const { data: task, isLoading, error, refetch } = useTask(shortId);
  const updateMutation = useUpdateTask();

  useBackButton();

  const [isUpdateSheetOpen, setIsUpdateSheetOpen] = useState(false);
  const [isReassignSheetOpen, setIsReassignSheetOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"error" | "success">("error");

  const isModerator = role === "admin" || role === "moderator";

  const changeStatus = useCallback(
    (newStatus: TaskStatus) => {
      updateMutation.mutate(
        { shortId, data: { status: newStatus } },
        {
          onSuccess: () => {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(
              "success"
            );
          },
          onError: (err) => {
            setToastType("error");
            setToastMsg(err.message || "Ошибка смены статуса");
          },
        }
      );
    },
    [shortId, updateMutation]
  );

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (error || !task) {
    return (
      <FullScreenError
        message={error ? "Ошибка загрузки задачи" : "Задача не найдена"}
        onRetry={() => refetch()}
      />
    );
  }

  const statusCfg = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const deadlineOverdue =
    task.deadline && isOverdue(task.deadline, task.status);
  const isTerminal = task.status === "done" || task.status === "cancelled";

  // Status action buttons
  const statusActions: { label: string; status: TaskStatus }[] = [];
  if (task.status === "new") {
    statusActions.push({ label: "▶️ В работу", status: "in_progress" });
  } else if (task.status === "in_progress") {
    statusActions.push({ label: "👀 На ревью", status: "review" });
    statusActions.push({ label: "✅ Готово", status: "done" });
  } else if (task.status === "review") {
    statusActions.push({ label: "✅ Готово", status: "done" });
  }

  const metaRows = [
    {
      label: "Статус",
      value: (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}
        >
          {statusCfg.label}
        </span>
      ),
    },
    {
      label: "Приоритет",
      value: (
        <span className="text-sm">
          {priorityCfg.icon} {priorityCfg.label}
        </span>
      ),
    },
    {
      label: "👤 Исполнитель",
      value: (
        <span className="text-sm text-tg-text">
          {task.assignee?.full_name || "—"}
        </span>
      ),
    },
    {
      label: "📝 Создатель",
      value: (
        <span className="text-sm text-tg-text">
          {task.created_by?.full_name || "—"}
        </span>
      ),
    },
    {
      label: "📅 Дедлайн",
      value: (
        <span
          className={`text-sm ${
            deadlineOverdue ? "text-tg-destructive font-medium" : "text-tg-text"
          }`}
        >
          {task.deadline ? formatDate(task.deadline) : "—"}
        </span>
      ),
    },
    {
      label: "📆 Создана",
      value: (
        <span className="text-sm text-tg-text">
          {formatDateTime(task.created_at)}
        </span>
      ),
    },
  ];

  return (
    <PageTransition>
    <div className="min-h-screen bg-tg-bg pb-20">
      {/* Task info */}
      <div className="px-4 pt-4">
        <h1 className="text-lg font-bold text-tg-text mb-3">
          #{task.short_id} {task.title}
        </h1>

        {/* Metadata */}
        <div>
          {metaRows.map((row, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 py-1.5 ${
                i < metaRows.length - 1
                  ? "border-b border-tg-separator"
                  : ""
              }`}
            >
              <span className="text-tg-hint text-sm w-28 flex-shrink-0">
                {row.label}
              </span>
              {row.value}
            </div>
          ))}
        </div>

        {/* Description */}
        {task.description && (
          <div className="mt-3 text-sm text-tg-text bg-tg-secondary-bg rounded-xl p-3">
            {task.description}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className={`flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide ${updateMutation.isPending ? "opacity-50 pointer-events-none" : ""}`}>
        {statusActions.map((action) => (
          <button
            key={action.status}
            onClick={() => changeStatus(action.status)}
            disabled={updateMutation.isPending}
            className="rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 bg-tg-secondary-bg text-tg-text active:scale-95"
          >
            {action.label}
          </button>
        ))}

        {!isTerminal && (
          <button
            onClick={() => setIsUpdateSheetOpen(true)}
            disabled={updateMutation.isPending}
            className="rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 bg-tg-secondary-bg text-tg-text active:scale-95"
          >
            📝 Апдейт
          </button>
        )}

        {isModerator && !isTerminal && (
          <>
            <button
              onClick={() => changeStatus("cancelled")}
              disabled={updateMutation.isPending}
              className="rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 bg-tg-secondary-bg text-tg-text active:scale-95"
            >
              ❌ Отменить
            </button>
            <button
              onClick={() => setIsReassignSheetOpen(true)}
              disabled={updateMutation.isPending}
              className="rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 bg-tg-secondary-bg text-tg-text active:scale-95"
            >
              🔄 Переназначить
            </button>
          </>
        )}
      </div>

      {/* Timeline */}
      <UpdateTimeline shortId={shortId} />

      {/* Bottom Nav */}
      <BottomNav />

      {/* Bottom Sheets */}
      <AddUpdateSheet
        isOpen={isUpdateSheetOpen}
        onClose={() => setIsUpdateSheetOpen(false)}
        shortId={shortId}
        onError={(msg) => {
          setToastType("error");
          setToastMsg(msg);
        }}
      />
      <ReassignSheet
        isOpen={isReassignSheetOpen}
        onClose={() => setIsReassignSheetOpen(false)}
        taskShortId={shortId}
        currentAssigneeId={task.assignee_id}
        onError={(msg) => {
          setToastType("error");
          setToastMsg(msg);
        }}
      />

      {/* Toast */}
      <Toast
        message={toastMsg}
        type={toastType}
        onClose={() => setToastMsg(null)}
      />
    </div>
    </PageTransition>
  );
}
