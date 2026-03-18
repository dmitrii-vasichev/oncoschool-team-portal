"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PermissionService } from "@/lib/permissions";
import type { ContentAccess, ContentSubSection } from "@/lib/types";

interface ContentAccessState {
  /** All content access grants for the current user (direct + department) */
  grants: ContentAccess[];
  /** Whether the initial fetch is still in progress */
  loading: boolean;
  /** Error from fetching access */
  error: string | null;
  /** Check if user has any access to a specific sub-section */
  hasAccess: (subSection: ContentSubSection) => boolean;
  /** Check if user has editor role for a sub-section */
  isEditor: (subSection: ContentSubSection) => boolean;
  /** Check if user has operator or editor role for a sub-section */
  isOperator: (subSection: ContentSubSection) => boolean;
  /** Refresh access grants */
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and expose the current user's content access state.
 *
 * - Admins have implicit editor access to everything.
 * - For other users, access is determined by ContentAccess grants
 *   (direct member_id or via department_id).
 *
 * Since the backend already resolves access per-request via dependencies,
 * this hook fetches the full access list (admin-only endpoint) for admins,
 * or tries the content endpoints to determine if the user has access.
 */
export function useContentAccess(): ContentAccessState {
  const { user } = useCurrentUser();
  const [grants, setGrants] = useState<ContentAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user ? PermissionService.isAdmin(user) : false;

  const fetchAccess = useCallback(async () => {
    if (!user) {
      setGrants([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isAdmin) {
        // Admins can fetch the full access list
        const accessList = await api.getContentAccess();
        setGrants(accessList);
      } else {
        // Non-admins: try to access the channels endpoint to check access
        // If they get 403, they have no access
        try {
          await api.getChannels();
          // If no error, user has at least operator access to telegram_analysis
          setGrants([
            {
              id: "self",
              sub_section: "telegram_analysis",
              member_id: user.id,
              member_name: user.full_name,
              department_id: null,
              department_name: null,
              role: "operator", // Minimum known role
            },
          ]);
        } catch {
          // 403 = no access, which is expected
          setGrants([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch content access");
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  const hasAccess = useCallback(
    (subSection: ContentSubSection): boolean => {
      if (!user) return false;
      // Admins always have access
      if (isAdmin) return true;
      return grants.some((g) => g.sub_section === subSection);
    },
    [user, isAdmin, grants]
  );

  const isEditor = useCallback(
    (subSection: ContentSubSection): boolean => {
      if (!user) return false;
      if (isAdmin) return true;
      return grants.some(
        (g) => g.sub_section === subSection && g.role === "editor"
      );
    },
    [user, isAdmin, grants]
  );

  const isOperator = useCallback(
    (subSection: ContentSubSection): boolean => {
      if (!user) return false;
      if (isAdmin) return true;
      return grants.some(
        (g) =>
          g.sub_section === subSection &&
          (g.role === "operator" || g.role === "editor")
      );
    },
    [user, isAdmin, grants]
  );

  return useMemo(
    () => ({
      grants,
      loading,
      error,
      hasAccess,
      isEditor,
      isOperator,
      refresh: fetchAccess,
    }),
    [grants, loading, error, hasAccess, isEditor, isOperator, fetchAccess]
  );
}
