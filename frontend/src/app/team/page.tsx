"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Building2, Search, Settings2, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { TeamTree } from "./components/TeamTree";
import { MemberDetailModal } from "./components/MemberDetailModal";
import { MemberEditModal } from "./components/MemberEditModal";
import { MemberCreateModal } from "./components/MemberCreateModal";
import { DepartmentManager } from "./components/DepartmentManager";
import { MemberCard } from "./components/MemberCard";
import { UpcomingBirthdays } from "./components/UpcomingBirthdays";
import { useTeamTree } from "@/hooks/useTeamTree";
import { useDepartments } from "@/hooks/useDepartments";
import { useTeam } from "@/hooks/useTeam";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PermissionService } from "@/lib/permissions";
import { api } from "@/lib/api";
import type { TeamMember, MemberStats } from "@/lib/types";

export default function TeamPage() {
  const { user } = useCurrentUser();
  const includeTestForAdmin = user ? PermissionService.isAdmin(user) : false;
  const { tree, loading: treeLoading, refetch: refetchTree } = useTeamTree({
    includeInactive: true,
    includeTest: includeTestForAdmin,
  });
  const { departments, refetch: refetchDepts } = useDepartments();
  const { members, refetch: refetchMembers } = useTeam({
    includeInactive: true,
    includeTest: includeTestForAdmin,
  });
  const [memberStats, setMemberStats] = useState<Record<string, MemberStats>>({});
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [showDeptManager, setShowDeptManager] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const canEdit = user ? PermissionService.isModerator(user) : false;
  const canAdd = user ? PermissionService.canAddMember(user) : false;

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getMembersAnalytics();
      const map: Record<string, MemberStats> = {};
      data.members.forEach((m) => {
        map[m.id] = m;
      });
      setMemberStats(map);
    } catch {
      // stats are optional
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = () => {
    refetchTree();
    refetchDepts();
    refetchMembers();
    fetchStats();
  };

  // Flat search across all members
  const allMembers = tree
    ? [...tree.departments.flatMap((d) => d.members), ...tree.unassigned]
    : members;

  const filteredMembers = search.trim()
    ? allMembers.filter((m) => {
        const q = search.toLowerCase();
        return (
          m.full_name.toLowerCase().includes(q) ||
          m.telegram_username?.toLowerCase().includes(q) ||
          m.position?.toLowerCase().includes(q) ||
          m.name_variants.some((v) => v.toLowerCase().includes(q))
        );
      })
    : [];

  const isSearching = search.trim().length > 0;
  const regularMembers = allMembers.filter((m) => !m.is_test);
  const testMembers = allMembers.filter((m) => m.is_test);
  const totalMembers = regularMembers.length;
  const activeMembers = regularMembers.filter((m) => m.is_active).length;
  const inactiveMembers = totalMembers - activeMembers;
  const activeOnlyMembers = regularMembers.filter((m) => m.is_active);
  const totalDepts = departments.length;

  if (treeLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-10 w-72 rounded-xl" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="animate-fade-in-up stagger-1 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <span>
              <span className="font-heading font-bold text-foreground text-lg">
                {totalMembers}
              </span>{" "}
              участников
            </span>
          </div>
          <div className="h-4 w-px bg-border/60" />
          <span className="text-xs text-muted-foreground">
            Активных: {activeMembers}
          </span>
          {inactiveMembers > 0 && (
            <>
              <div className="h-4 w-px bg-border/60" />
              <span className="text-xs text-muted-foreground">
                Неактивных: {inactiveMembers}
              </span>
            </>
          )}
          {includeTestForAdmin && testMembers.length > 0 && (
            <>
              <div className="h-4 w-px bg-border/60" />
              <span className="text-xs text-muted-foreground">
                Тестовых: {testMembers.length}
              </span>
            </>
          )}
          <div className="h-4 w-px bg-border/60" />
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            Отделов: {totalDepts}
          </span>
        </div>

        {(canAdd || canEdit) && (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {canAdd && (
              <Button
                size="sm"
                className="w-full rounded-xl gap-1.5 sm:w-auto"
                onClick={() => setShowCreateModal(true)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Добавить
              </Button>
            )}

            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl gap-1.5 sm:w-auto"
                onClick={() => setShowDeptManager(true)}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Управление отделами
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Upcoming Birthdays */}
      <UpcomingBirthdays
        members={activeOnlyMembers}
        onMemberClick={setSelectedMember}
      />

      {/* Search */}
      <div className="relative max-w-sm animate-fade-in-up stagger-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени, должности, username..."
          className="pl-9 h-10 rounded-xl bg-card border-border/60"
        />
      </div>

      {/* Content: search results or tree */}
      {isSearching ? (
        filteredMembers.length === 0 ? (
          <EmptyState
            variant="team"
            title="Никто не найден"
            description="Попробуйте изменить поисковый запрос"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in-up stagger-3">
            {filteredMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                onClick={() => setSelectedMember(member)}
                onEdit={canEdit ? () => setEditMember(member) : undefined}
              />
            ))}
          </div>
        )
      ) : tree ? (
        <div className="animate-fade-in-up stagger-3">
          <TeamTree
            tree={tree}
            onMemberClick={setSelectedMember}
            onMemberEdit={canEdit ? setEditMember : undefined}
            canEdit={canEdit}
          />
        </div>
      ) : (
        <EmptyState
          variant="team"
          title="В команде пока нет участников"
          description="Добавьте участников через кнопку выше"
        />
      )}

      {/* Detail modal */}
      <MemberDetailModal
        member={selectedMember}
        stats={selectedMember ? memberStats[selectedMember.id] : undefined}
        departments={departments}
        onClose={() => setSelectedMember(null)}
      />

      {/* Edit modal */}
      {user && (
        <MemberEditModal
          member={editMember}
          members={allMembers}
          departments={departments}
          currentUser={user}
          onSave={handleRefresh}
          onClose={() => setEditMember(null)}
        />
      )}

      {/* Create member modal */}
      {user && (
        <MemberCreateModal
          open={showCreateModal}
          departments={departments}
          currentUser={user}
          onCreated={handleRefresh}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Department manager */}
      <DepartmentManager
        open={showDeptManager}
        departments={departments}
        members={activeOnlyMembers}
        onUpdate={() => {
          refetchDepts();
          refetchTree();
        }}
        onClose={() => setShowDeptManager(false)}
      />
    </div>
  );
}
