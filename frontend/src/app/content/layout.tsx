"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useContentAccess } from "@/hooks/useContentAccess";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { hasAccess, loading } = useContentAccess();

  useEffect(() => {
    if (!loading && user && !hasAccess("telegram_analysis")) {
      router.replace("/");
    }
  }, [loading, user, hasAccess, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !hasAccess("telegram_analysis")) {
    return null;
  }

  return <>{children}</>;
}
