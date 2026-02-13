"use client";

import type { ReactNode } from "react";
import { TelegramProvider } from "@/providers/TelegramProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TelegramProvider>
      <AuthProvider>
        <QueryProvider>{children}</QueryProvider>
      </AuthProvider>
    </TelegramProvider>
  );
}
