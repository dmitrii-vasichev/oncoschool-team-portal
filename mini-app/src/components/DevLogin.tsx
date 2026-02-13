"use client";

import React, { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";

export function DevLogin() {
  const [telegramId, setTelegramId] = useState("");
  const [loginError, setLoginError] = useState("");
  const { retry } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(telegramId, 10);
    if (!id || isNaN(id)) {
      setLoginError("Введите корректный Telegram ID");
      return;
    }
    sessionStorage.setItem("dev_telegram_id", String(id));
    setLoginError("");
    retry();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-tg-bg px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🛠️</div>
          <h1 className="text-xl font-semibold text-tg-text">Dev Mode</h1>
          <p className="text-tg-hint text-sm mt-1">
            Введите Telegram ID для входа
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            placeholder="Telegram ID"
            className="w-full px-4 py-3 rounded-xl bg-tg-secondary-bg text-tg-text placeholder:text-tg-hint border-0 outline-none focus:ring-2 focus:ring-tg-button"
          />
          {loginError && (
            <p className="text-tg-destructive text-sm">{loginError}</p>
          )}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-tg-button text-tg-button-text font-medium active:opacity-80 transition-opacity"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
