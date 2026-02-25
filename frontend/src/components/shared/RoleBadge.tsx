import type { MemberRole } from "@/lib/types";
import { Crown, Shield, User, CircleHelp } from "lucide-react";

const ROLE_CONFIG: Record<
  MemberRole,
  { label: string; icon: typeof Shield; className: string }
> = {
  admin: {
    label: "Администратор",
    icon: Crown,
    className:
      "bg-role-admin-bg text-role-admin-fg ring-1 ring-inset ring-role-admin-ring",
  },
  moderator: {
    label: "Модератор",
    icon: Shield,
    className:
      "bg-role-moderator-bg text-role-moderator-fg ring-1 ring-inset ring-role-moderator-ring",
  },
  member: {
    label: "Участник",
    icon: User,
    className:
      "bg-role-member-bg text-role-member-fg ring-1 ring-inset ring-role-member-ring",
  },
};

const UNKNOWN_ROLE_CONFIG = {
  label: "Неизвестная роль",
  icon: CircleHelp,
  className: "bg-muted text-muted-foreground ring-1 ring-inset ring-border/70",
};

function resolveRole(role: MemberRole | string | null | undefined): MemberRole | null {
  if (!role) return null;
  return Object.prototype.hasOwnProperty.call(ROLE_CONFIG, role)
    ? (role as MemberRole)
    : null;
}

export function RoleBadge({ role }: { role: MemberRole | string | null | undefined }) {
  const resolvedRole = resolveRole(role);
  const { label, icon: Icon, className } = resolvedRole
    ? ROLE_CONFIG[resolvedRole]
    : UNKNOWN_ROLE_CONFIG;

  return (
    <span
      className={`badge-animated inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}
