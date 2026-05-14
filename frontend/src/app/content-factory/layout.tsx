"use client";

import { type ReactNode } from "react";
import { ContentFactoryGuard } from "@/components/content-factory/ContentFactoryGuard";
import { ContentFactoryWorkspaceNav } from "@/components/content-factory/ContentFactoryWorkspaceNav";

export default function ContentFactoryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ContentFactoryGuard>
      <ContentFactoryWorkspaceNav />
      {children}
    </ContentFactoryGuard>
  );
}
