"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PermissionService } from "@/lib/permissions";

export function ModeratorGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !PermissionService.isModerator(user)) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || !user || !PermissionService.isModerator(user)) {
    return null;
  }

  return <>{children}</>;
}
