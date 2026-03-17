"use client";

import { Search } from "lucide-react";

export default function TelegramAnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Telegram-анализ</h1>
        <p className="text-muted-foreground mt-1">
          Анализ контента из Telegram-каналов с помощью AI
        </p>
      </div>

      <div className="rounded-xl border bg-card p-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Search className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold mb-2">
          Скоро здесь появится анализ
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Управление каналами, библиотека промптов, запуск анализа с
          отслеживанием прогресса в реальном времени и история результатов.
        </p>
      </div>
    </div>
  );
}
