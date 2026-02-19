"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BellDot,
  CircleAlert,
  ClipboardList,
  SearchX,
  Users,
  Video,
} from "lucide-react";

/* ============================================
   Inline SVG illustrations for empty states
   ============================================ */

function TasksIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-32 h-28", className)}
    >
      {/* Clipboard */}
      <rect
        x="30"
        y="12"
        width="60"
        height="76"
        rx="8"
        className="fill-muted/60 stroke-border"
        strokeWidth="1.5"
      />
      {/* Clipboard top clip */}
      <rect
        x="44"
        y="6"
        width="32"
        height="14"
        rx="4"
        className="fill-card stroke-border"
        strokeWidth="1.5"
      />
      <circle cx="60" cy="13" r="3" className="fill-primary/40" />
      {/* Check lines */}
      <rect x="42" y="34" width="8" height="8" rx="2" className="fill-status-done-bg stroke-status-done-fg/30" strokeWidth="1" />
      <path d="M44 38.5L46.5 41L50 36" className="stroke-status-done-fg" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="55" y="35" width="24" height="3" rx="1.5" className="fill-border" />
      <rect x="55" y="40" width="16" height="2" rx="1" className="fill-border/60" />

      <rect x="42" y="50" width="8" height="8" rx="2" className="fill-status-done-bg stroke-status-done-fg/30" strokeWidth="1" />
      <path d="M44 54.5L46.5 57L50 52" className="stroke-status-done-fg" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="55" y="51" width="20" height="3" rx="1.5" className="fill-border" />
      <rect x="55" y="56" width="12" height="2" rx="1" className="fill-border/60" />

      {/* Empty checkbox */}
      <rect x="42" y="66" width="8" height="8" rx="2" className="fill-card stroke-border" strokeWidth="1.5" strokeDasharray="3 2" />
      <rect x="55" y="67" width="18" height="3" rx="1.5" className="fill-border/40" />
      <rect x="55" y="72" width="10" height="2" rx="1" className="fill-border/30" />

      {/* Decorative sparkle */}
      <circle cx="96" cy="20" r="2" className="fill-accent/40" />
      <circle cx="22" cy="45" r="1.5" className="fill-primary/30" />
      <circle cx="100" cy="60" r="1.5" className="fill-accent/25" />
    </svg>
  );
}

function MeetingsIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-32 h-28", className)}
    >
      {/* Video screen */}
      <rect
        x="20"
        y="16"
        width="80"
        height="52"
        rx="8"
        className="fill-muted/60 stroke-border"
        strokeWidth="1.5"
      />
      {/* Screen inner */}
      <rect
        x="26"
        y="22"
        width="68"
        height="40"
        rx="4"
        className="fill-card"
      />
      {/* Play button */}
      <circle cx="60" cy="42" r="12" className="fill-primary/10" />
      <path d="M56 36L68 42L56 48Z" className="fill-primary/50" />

      {/* Participant dots */}
      <circle cx="38" cy="32" r="4" className="fill-status-progress-bg stroke-status-progress-fg/30" strokeWidth="1" />
      <circle cx="82" cy="32" r="4" className="fill-status-review-bg stroke-status-review-fg/30" strokeWidth="1" />
      <circle cx="38" cy="52" r="4" className="fill-accent/15 stroke-accent/30" strokeWidth="1" />
      <circle cx="82" cy="52" r="4" className="fill-status-done-bg stroke-status-done-fg/30" strokeWidth="1" />

      {/* Stand */}
      <rect x="52" y="68" width="16" height="4" rx="2" className="fill-border" />
      <rect x="46" y="72" width="28" height="3" rx="1.5" className="fill-border/60" />

      {/* Decorative */}
      <circle cx="14" cy="28" r="1.5" className="fill-primary/25" />
      <circle cx="108" cy="36" r="2" className="fill-accent/30" />
    </svg>
  );
}

function TeamIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-32 h-28", className)}
    >
      {/* Center person */}
      <circle cx="60" cy="32" r="12" className="fill-primary/15 stroke-primary/30" strokeWidth="1.5" />
      <circle cx="60" cy="28" r="5" className="fill-primary/30" />
      <path d="M50 42C50 38 54 35 60 35C66 35 70 38 70 42" className="stroke-primary/30" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Left person */}
      <circle cx="30" cy="46" r="9" className="fill-accent/10 stroke-accent/25" strokeWidth="1" />
      <circle cx="30" cy="43" r="3.5" className="fill-accent/25" />
      <path d="M23 52C23 49 26 47 30 47C34 47 37 49 37 52" className="stroke-accent/25" strokeWidth="1" strokeLinecap="round" fill="none" />

      {/* Right person */}
      <circle cx="90" cy="46" r="9" className="fill-status-done-bg stroke-status-done-fg/25" strokeWidth="1" />
      <circle cx="90" cy="43" r="3.5" className="fill-status-done-fg/25" />
      <path d="M83 52C83 49 86 47 90 47C94 47 97 49 97 52" className="stroke-status-done-fg/25" strokeWidth="1" strokeLinecap="round" fill="none" />

      {/* Connection lines */}
      <line x1="48" y1="38" x2="39" y2="42" className="stroke-border" strokeWidth="1" strokeDasharray="3 2" />
      <line x1="72" y1="38" x2="81" y2="42" className="stroke-border" strokeWidth="1" strokeDasharray="3 2" />

      {/* Bottom row dots (more team members) */}
      <circle cx="40" cy="72" r="5" className="fill-muted/80 stroke-border/60" strokeWidth="1" />
      <circle cx="55" cy="72" r="5" className="fill-muted/80 stroke-border/60" strokeWidth="1" />
      <circle cx="70" cy="72" r="5" className="fill-muted/80 stroke-border/60" strokeWidth="1" />
      <circle cx="85" cy="72" r="3" className="fill-border/40" />
      <text x="85" y="74" textAnchor="middle" className="fill-muted-foreground/40" fontSize="5" fontWeight="600">+</text>

      {/* Decorative */}
      <circle cx="14" cy="22" r="1.5" className="fill-primary/20" />
      <circle cx="106" cy="28" r="1.5" className="fill-accent/25" />
    </svg>
  );
}

function UpdatesIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-32 h-28", className)}
    >
      {/* Timeline line */}
      <line x1="36" y1="16" x2="36" y2="84" className="stroke-border" strokeWidth="2" strokeDasharray="4 3" />

      {/* Timeline dot 1 */}
      <circle cx="36" cy="26" r="5" className="fill-status-done-bg stroke-status-done-fg/40" strokeWidth="1.5" />
      <path d="M34 26L35.5 27.5L38 25" className="stroke-status-done-fg" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Card 1 */}
      <rect x="48" y="18" width="52" height="16" rx="4" className="fill-card stroke-border/60" strokeWidth="1" />
      <rect x="54" y="23" width="24" height="2.5" rx="1.25" className="fill-border" />
      <rect x="54" y="28" width="16" height="2" rx="1" className="fill-border/50" />

      {/* Timeline dot 2 */}
      <circle cx="36" cy="48" r="5" className="fill-status-progress-bg stroke-status-progress-fg/40" strokeWidth="1.5" />
      <rect x="34" y="46" width="4" height="4" rx="1" className="fill-status-progress-fg/50" />
      {/* Card 2 */}
      <rect x="48" y="40" width="52" height="16" rx="4" className="fill-card stroke-border/60" strokeWidth="1" />
      <rect x="54" y="44" width="32" height="2.5" rx="1.25" className="fill-border" />
      <rect x="54" y="49" width="20" height="2" rx="1" className="fill-border/50" />

      {/* Timeline dot 3 (empty / pending) */}
      <circle cx="36" cy="70" r="5" className="fill-card stroke-border" strokeWidth="1.5" strokeDasharray="3 2" />
      {/* Empty card placeholder */}
      <rect x="48" y="62" width="52" height="16" rx="4" className="fill-muted/30 stroke-border/30" strokeWidth="1" strokeDasharray="4 3" />
      <rect x="54" y="67" width="20" height="2.5" rx="1.25" className="fill-border/30" />
      <rect x="54" y="72" width="14" height="2" rx="1" className="fill-border/20" />

      {/* Decorative */}
      <circle cx="16" cy="30" r="1.5" className="fill-primary/25" />
      <circle cx="108" cy="70" r="2" className="fill-accent/20" />
    </svg>
  );
}

function NotFoundIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-48 h-36", className)}
    >
      {/* Page with fold */}
      <rect x="40" y="14" width="80" height="92" rx="8" className="fill-muted/60 stroke-border" strokeWidth="1.5" />
      <path d="M96 14H112C116.4 14 120 17.6 120 22V14L96 14Z" className="fill-border/30" />
      <path d="M96 14V30C96 34.4 99.6 38 104 38H120" className="stroke-border" strokeWidth="1.5" fill="none" />

      {/* Big 404 text */}
      <text x="80" y="68" textAnchor="middle" className="fill-primary/20" fontSize="28" fontWeight="800" fontFamily="var(--font-heading)">404</text>

      {/* Question mark */}
      <circle cx="80" cy="86" r="8" className="fill-accent/10 stroke-accent/30" strokeWidth="1" />
      <text x="80" y="90" textAnchor="middle" className="fill-accent/50" fontSize="12" fontWeight="700">?</text>

      {/* Decorative */}
      <circle cx="28" cy="30" r="2" className="fill-primary/25" />
      <circle cx="134" cy="50" r="2.5" className="fill-accent/20" />
      <circle cx="32" cy="80" r="1.5" className="fill-status-progress-fg/20" />
      <circle cx="130" cy="90" r="1.5" className="fill-accent/15" />

      {/* Scattered dots (confusion) */}
      <circle cx="50" cy="48" r="1" className="fill-border" />
      <circle cx="110" cy="56" r="1" className="fill-border" />
      <circle cx="56" cy="90" r="1" className="fill-border" />
    </svg>
  );
}

/* ============================================
   EmptyState Component
   ============================================ */

export type EmptyStateVariant =
  | "tasks"
  | "meetings"
  | "team"
  | "updates"
  | "notFound"
  | "generic";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
  compact?: boolean;
}

const ILLUSTRATIONS: Record<string, React.FC<{ className?: string }>> = {
  tasks: TasksIllustration,
  meetings: MeetingsIllustration,
  team: TeamIllustration,
  updates: UpdatesIllustration,
  notFound: NotFoundIllustration,
};

const COMPACT_ICONS: Partial<Record<EmptyStateVariant, React.ElementType>> = {
  tasks: ClipboardList,
  meetings: Video,
  team: Users,
  updates: BellDot,
  notFound: SearchX,
  generic: CircleAlert,
};

export function EmptyState({
  variant = "generic",
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
  compact = false,
}: EmptyStateProps) {
  const Illustration = ILLUSTRATIONS[variant];
  const CompactIcon = COMPACT_ICONS[variant] ?? CircleAlert;

  return (
    <div
      className={cn(
        "animate-fade-in-up",
        compact
          ? "flex items-start gap-3 rounded-xl bg-muted/20 px-3 py-3 text-left"
          : "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      {compact ? (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground">
          <CompactIcon className="h-4 w-4" />
        </div>
      ) : Illustration ? (
        <Illustration className="mb-4 opacity-80" />
      ) : (
        <div className="h-16 w-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )}

      <div className={cn(compact ? "min-w-0 flex-1" : undefined)}>
        <h3
          className={cn(
            "font-heading font-semibold text-foreground",
            compact ? "mb-0.5 text-sm" : "mb-1 text-sm"
          )}
        >
          {title}
        </h3>

        {description && (
          <p
            className={cn(
              compact
                ? "text-xs text-muted-foreground leading-relaxed"
                : "text-sm text-muted-foreground max-w-xs leading-relaxed"
            )}
          >
            {description}
          </p>
        )}

        {actionLabel && (onAction || actionHref) && (
          <div className={cn(compact ? "mt-2" : "mt-4")}>
            {actionHref ? (
              <a href={actionHref}>
                <Button size="sm" className="rounded-xl gap-1.5">
                  {actionLabel}
                </Button>
              </a>
            ) : (
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={onAction}
              >
                {actionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
