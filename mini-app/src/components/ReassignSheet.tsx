"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUpdateTask } from "@/hooks/useTasks";
import type { TeamMember } from "@/lib/types";

interface ReassignSheetProps {
  isOpen: boolean;
  onClose: () => void;
  taskShortId: number;
  currentAssigneeId: string | null;
  onError?: (msg: string) => void;
}

export function ReassignSheet({
  isOpen,
  onClose,
  taskShortId,
  currentAssigneeId,
  onError,
}: ReassignSheetProps) {
  const [search, setSearch] = useState("");

  const { data: team } = useQuery<TeamMember[]>({
    queryKey: ["team"],
    queryFn: () => api.getTeam(),
    enabled: isOpen,
  });

  const mutation = useUpdateTask();

  const filtered = (team || []).filter(
    (m) =>
      m.is_active &&
      m.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = useCallback(
    (memberId: string) => {
      mutation.mutate(
        { shortId: taskShortId, data: { assignee_id: memberId } },
        {
          onSuccess: () => {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(
              "success"
            );
            onClose();
            setSearch("");
          },
          onError: (err) => {
            onError?.(err.message || "Ошибка переназначения");
          },
        }
      );
    },
    [taskShortId, mutation, onClose, onError]
  );

  const handleClose = useCallback(() => {
    onClose();
    setSearch("");
  }, [onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-tg-bg rounded-t-2xl transition-transform duration-300 pb-[env(safe-area-inset-bottom)] ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-tg-separator rounded-full mx-auto mt-2 mb-4" />

        <div className="px-4 pb-4">
          <h3 className="text-base font-semibold text-tg-text mb-3">
            Переназначить задачу
          </h3>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени..."
            className="w-full bg-tg-secondary-bg rounded-xl px-3 py-2.5 text-sm text-tg-text mb-3 border-0 outline-none placeholder:text-tg-hint"
          />

          {/* Members list */}
          <div className="max-h-[50vh] overflow-y-auto">
            {filtered.map((member) => (
              <div
                key={member.id}
                onClick={() => handleSelect(member.id)}
                className="flex items-center gap-3 py-3 border-b border-tg-separator last:border-0 cursor-pointer active:bg-tg-secondary-bg transition-colors rounded-lg px-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-tg-text font-medium">
                    {member.full_name}
                  </div>
                  <div className="text-xs text-tg-hint">{member.role}</div>
                </div>
                {member.id === currentAssigneeId && (
                  <span className="ml-auto text-tg-button">✅</span>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-tg-hint text-sm py-4 text-center">
                Никого не найдено
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
