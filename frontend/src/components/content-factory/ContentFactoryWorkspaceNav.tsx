"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Factory,
  FolderKanban,
  HelpCircle,
  History,
  ListChecks,
  Settings2,
  Users,
} from "lucide-react";
import {
  CONTENT_FACTORY_SECTIONS,
  CONTENT_FACTORY_TITLE,
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
  "/content-factory/help": HelpCircle,
};

export function ContentFactoryWorkspaceNav() {
  const pathname = usePathname();

  return (
    <section className="mb-4 rounded-lg border border-border/70 bg-card px-3 py-3 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {CONTENT_FACTORY_TITLE}
          </p>
          <p className="text-sm text-muted-foreground">
            Единое рабочее пространство для кампаний, публикаций и выводов.
          </p>
        </div>
        <Link
          href="/content-factory/help"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <BookOpen className="h-4 w-4" />
          Справка
        </Link>
      </div>

      <nav className="flex gap-1 overflow-x-auto pb-1">
        {CONTENT_FACTORY_SECTIONS.map((section) => {
          const Icon = ICONS[section.href] ?? Factory;
          const active = isContentFactorySectionActive(pathname, section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              title={section.description}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
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
