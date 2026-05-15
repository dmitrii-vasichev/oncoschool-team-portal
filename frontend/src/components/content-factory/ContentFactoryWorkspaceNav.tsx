"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Factory,
  FolderKanban,
  History,
  ListChecks,
  Settings2,
  TrendingUp,
  UserRoundPlus,
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
  "/content-factory/guests": UserRoundPlus,
  "/content-factory/review": ListChecks,
  "/content-factory/effectiveness": TrendingUp,
  "/content-factory/segments": Users,
  "/content-factory/segments/analytics": BarChart3,
  "/content-factory/retros": History,
  "/content-factory/references": Settings2,
  "/content-factory/help": BookOpen,
};

const SCROLL_STEP_PX = 280;

export function ContentFactoryWorkspaceNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    const maxScrollLeft = nav.scrollWidth - nav.clientWidth;
    setCanScrollLeft(nav.scrollLeft > 1);
    setCanScrollRight(nav.scrollLeft < maxScrollLeft - 1);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    updateScrollState();
    nav.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateScrollState);
    resizeObserver?.observe(nav);

    return () => {
      nav.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [updateScrollState]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    const activeLink = nav.querySelector<HTMLAnchorElement>(
      'a[aria-current="page"]',
    );
    activeLink?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });

    const frame = window.requestAnimationFrame(updateScrollState);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, updateScrollState]);

  const scrollNavigation = (direction: "left" | "right") => {
    navRef.current?.scrollBy({
      behavior: "smooth",
      left: direction === "left" ? -SCROLL_STEP_PX : SCROLL_STEP_PX,
    });
  };

  const showScrollControls = canScrollLeft || canScrollRight;

  return (
    <section className="mb-4 rounded-lg border border-border/70 bg-card px-3 py-2 shadow-sm">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Прокрутить навигацию влево"
          disabled={!canScrollLeft}
          onClick={() => scrollNavigation("left")}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-35 disabled:hover:bg-background disabled:hover:text-muted-foreground",
            !showScrollControls && "hidden",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="relative min-w-0 flex-1">
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-1 left-0 z-10 w-8 bg-gradient-to-r from-card to-transparent transition-opacity",
              canScrollLeft ? "opacity-100" : "opacity-0",
            )}
          />
          <nav
            ref={navRef}
            aria-label="Навигация Контент-фабрики"
            className="flex min-w-0 gap-1 overflow-x-auto scroll-smooth py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {CONTENT_FACTORY_SECTIONS.map((section) => {
              const Icon = ICONS[section.href] ?? Factory;
              const active = isContentFactorySectionActive(
                pathname,
                section.href,
              );
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  title={section.description}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors",
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
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-1 right-0 z-10 w-8 bg-gradient-to-l from-card to-transparent transition-opacity",
              canScrollRight ? "opacity-100" : "opacity-0",
            )}
          />
        </div>

        <button
          type="button"
          aria-label="Прокрутить навигацию вправо"
          disabled={!canScrollRight}
          onClick={() => scrollNavigation("right")}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-35 disabled:hover:bg-background disabled:hover:text-muted-foreground",
            !showScrollControls && "hidden",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
