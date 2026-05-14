import {
  CF_BUNDLE_STATUS_LABELS,
  CF_PUBLICATION_STATUS_LABELS,
} from "@/lib/contentFactoryUtils";
import { cn } from "@/lib/utils";

type ContentFactoryStatusBadgeProps = {
  kind: "bundle" | "publication";
  status: string;
};

const STATUS_CLASSES: Record<string, string> = {
  planning: "border-sky-500/25 bg-sky-500/10 text-sky-700",
  production: "border-amber-500/25 bg-amber-500/10 text-amber-700",
  live: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
  retrospective: "border-violet-500/25 bg-violet-500/10 text-violet-700",
  archived: "border-slate-500/25 bg-slate-500/10 text-slate-600",
  draft: "border-slate-500/25 bg-slate-500/10 text-slate-600",
  needs_copy: "border-orange-500/25 bg-orange-500/10 text-orange-700",
  needs_design: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700",
  factcheck: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700",
  doctor_review: "border-blue-500/25 bg-blue-500/10 text-blue-700",
  approved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
  scheduled: "border-indigo-500/25 bg-indigo-500/10 text-indigo-700",
  published: "border-green-500/25 bg-green-500/10 text-green-700",
  failed: "border-red-500/25 bg-red-500/10 text-red-700",
  cancelled: "border-zinc-500/25 bg-zinc-500/10 text-zinc-600",
};

export function ContentFactoryStatusBadge({
  kind,
  status,
}: ContentFactoryStatusBadgeProps) {
  const labels =
    kind === "bundle" ? CF_BUNDLE_STATUS_LABELS : CF_PUBLICATION_STATUS_LABELS;
  const label = labels[status as keyof typeof labels] ?? status;

  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center rounded-md border px-2 text-xs font-medium leading-none",
        STATUS_CLASSES[status] ?? "border-border bg-muted text-muted-foreground",
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
