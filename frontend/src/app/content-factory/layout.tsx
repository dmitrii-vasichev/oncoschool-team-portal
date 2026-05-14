"use client";

import { type ReactNode } from "react";
import { ContentFactoryGuard } from "@/components/content-factory/ContentFactoryGuard";

export default function ContentFactoryLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ContentFactoryGuard>{children}</ContentFactoryGuard>;
}
