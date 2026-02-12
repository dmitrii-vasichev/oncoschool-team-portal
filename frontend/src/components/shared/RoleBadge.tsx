import { Badge } from "@/components/ui/badge";
import type { MemberRole } from "@/lib/types";

export function RoleBadge({ role }: { role: MemberRole }) {
  if (role === "moderator") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        Модератор
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-100">
      Участник
    </Badge>
  );
}
