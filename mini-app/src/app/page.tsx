"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { DevLogin } from "@/components/DevLogin";

export default function HomePage() {
  const { member, isLoading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && member) {
      router.replace("/tasks");
    }
  }, [isLoading, member, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tg-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-tg-button border-t-transparent mx-auto mb-3" />
          <p className="text-tg-hint text-sm">Авторизация...</p>
        </div>
      </div>
    );
  }

  if (error === "dev_login_needed") {
    return <DevLogin />;
  }

  if (error === "not_in_telegram") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tg-bg px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">📱</div>
          <h1 className="text-xl font-semibold text-tg-text mb-2">
            Откройте в Telegram
          </h1>
          <p className="text-tg-hint text-sm">
            Это приложение работает только внутри Telegram Mini App
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tg-bg px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-tg-text mb-2">Ошибка</h1>
          <p className="text-tg-hint text-sm mb-4">{error}</p>
        </div>
      </div>
    );
  }

  // Authenticated — will redirect via useEffect
  return (
    <div className="flex items-center justify-center min-h-screen bg-tg-bg">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-tg-button border-t-transparent" />
    </div>
  );
}
