"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string | null;
  type?: "error" | "success";
  onClose: () => void;
}

export function Toast({ message, type = "error", onClose }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => onClose(), 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div
      className={`fixed bottom-24 left-4 right-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg animate-fadeInUp flex items-center ${
        type === "error"
          ? "bg-tg-destructive text-tg-button-text"
          : "bg-tg-button text-tg-button-text"
      }`}
    >
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="ml-auto pl-2 opacity-80">
        ✕
      </button>
    </div>
  );
}
