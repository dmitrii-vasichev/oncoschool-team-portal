"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useCreateTaskUpdate } from "@/hooks/useTasks";
import { useMainButton } from "@/hooks/useMainButton";
import type { UpdateType } from "@/lib/types";

interface AddUpdateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  shortId: number;
  onError?: (msg: string) => void;
}

type SheetUpdateType = "comment" | "progress" | "blocker";

const TYPE_OPTIONS: { value: SheetUpdateType; label: string }[] = [
  { value: "comment", label: "📝 Комментарий" },
  { value: "progress", label: "📊 Прогресс" },
  { value: "blocker", label: "🚫 Блокер" },
];

export function AddUpdateSheet({
  isOpen,
  onClose,
  shortId,
  onError,
}: AddUpdateSheetProps) {
  const [type, setType] = useState<SheetUpdateType>("comment");
  const [text, setText] = useState("");
  const [progress, setProgress] = useState(50);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mutation = useCreateTaskUpdate(shortId);

  const resetForm = useCallback(() => {
    setText("");
    setType("comment");
    setProgress(50);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    resetForm();
  }, [onClose, resetForm]);

  const handleSubmit = useCallback(() => {
    if (!text.trim()) return;

    mutation.mutate(
      {
        content: text.trim(),
        update_type: type as UpdateType,
        progress_percent: type === "progress" ? progress : undefined,
      },
      {
        onSuccess: () => {
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(
            "success"
          );
          handleClose();
        },
        onError: (err) => {
          onError?.(err.message || "Ошибка при отправке");
        },
      }
    );
  }, [text, type, progress, mutation, handleClose, onError]);

  useMainButton({
    text: "Отправить",
    onClick: handleSubmit,
    isVisible: isOpen && text.trim().length > 0,
    isLoading: mutation.isPending,
  });

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  // Focus textarea when sheet opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isOpen]);

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
          {/* Type selector */}
          <div className="flex gap-1 bg-tg-secondary-bg rounded-xl p-1 mb-4">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setType(opt.value);
                  window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
                }}
                className={`flex-1 py-2 text-center text-sm rounded-lg transition-colors ${
                  type === opt.value
                    ? "bg-tg-bg text-tg-text font-medium shadow-sm"
                    : "text-tg-hint"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Progress slider */}
          {type === "progress" && (
            <div className="mb-4">
              <label className="text-sm text-tg-hint mb-1 block">
                Прогресс: {progress}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full accent-[var(--tg-theme-button-color,#2481cc)]"
              />
            </div>
          )}

          {/* Text */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            placeholder="Напишите обновление..."
            className="w-full bg-tg-secondary-bg rounded-xl p-3 text-sm text-tg-text resize-none min-h-[80px] border-0 outline-none placeholder:text-tg-hint"
          />
        </div>
      </div>
    </>
  );
}
