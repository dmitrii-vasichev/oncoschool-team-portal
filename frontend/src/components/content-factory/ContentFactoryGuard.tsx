"use client";

import { type ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PermissionService } from "@/lib/permissions";

export function ContentFactoryGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  const canAccess = user ? PermissionService.canAccessContentFactory(user) : false;

  useEffect(() => {
    if (!loading && (!user || !canAccess)) {
      router.replace("/");
    }
  }, [canAccess, loading, router, user]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm">Загрузка…</span>
      </div>
    );
  }

  if (!user || !canAccess) {
    return null;
  }

  return <>{children}</>;
}
