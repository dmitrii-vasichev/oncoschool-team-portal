"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Factory,
  FolderKanban,
  History,
  ListChecks,
  BookOpen,
  Settings2,
  Users,
} from "lucide-react";
import {
  CONTENT_FACTORY_SECTIONS,
  isContentFactorySectionActive,
} from "@/lib/contentFactoryUi";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = {
  "/content-factory/dashboard": Factory,
  "/content-factory/calendar": CalendarDays,
  "/content-factory/bundles": FolderKanban,
  "/content-factory/review": ListChecks,
  "/content-factory/segments": Users,
  "/content-factory/segments/analytics": BarChart3,
  "/content-factory/retros": History,
  "/content-factory/references": Settings2,
  "/content-factory/help": BookOpen,
};

export function ContentFactoryWorkspaceNav() {
  const pathname = usePathname();

  return (
    <section className="mb-4 rounded-lg border border-border/70 bg-card px-3 py-2 shadow-sm">
      <nav
        aria-label="Навигация Контент-фабрики"
        className="flex flex-wrap items-center gap-1 py-1"
      >
        {CONTENT_FACTORY_SECTIONS.map((section) => {
          const Icon = ICONS[section.href] ?? Factory;
          const active = isContentFactorySectionActive(pathname, section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              title={section.description}
              className={cn(
                "inline-flex h-9 max-w-full shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : section.href === "/content-factory/help"
                    ? "text-primary hover:bg-muted hover:text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {section.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
