"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { ContentSubSection } from "@/lib/types";

interface ResolvedGrant {
  sub_section: string;
  role: string; // "operator" | "editor"
}

interface ContentAccessState {
  /** Resolved access grants for the current user */
  grants: ResolvedGrant[];
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
 * Calls GET /api/content/my-access which returns the user's resolved roles
 * (including implicit admin→editor promotion) for each content sub-section.
 */
export function useContentAccess(): ContentAccessState {
  const { user } = useCurrentUser();
  const [grants, setGrants] = useState<ResolvedGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccess = useCallback(async () => {
    if (!user) {
      setGrants([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const myAccess = await api.getMyContentAccess();
      setGrants(myAccess);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch content access");
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  const hasAccess = useCallback(
    (subSection: ContentSubSection): boolean => {
      if (!user) return false;
      return grants.some((g) => g.sub_section === subSection);
    },
    [user, grants]
  );

  const isEditor = useCallback(
    (subSection: ContentSubSection): boolean => {
      if (!user) return false;
      return grants.some(
        (g) => g.sub_section === subSection && g.role === "editor"
      );
    },
    [user, grants]
  );

  const isOperator = useCallback(
    (subSection: ContentSubSection): boolean => {
      if (!user) return false;
      return grants.some(
        (g) =>
          g.sub_section === subSection &&
          (g.role === "operator" || g.role === "editor")
      );
    },
    [user, grants]
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
