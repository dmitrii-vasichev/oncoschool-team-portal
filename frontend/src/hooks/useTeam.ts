"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { TeamMember } from "@/lib/types";

export function useTeam(options?: { includeInactive?: boolean; includeTest?: boolean }) {
  const includeInactive = options?.includeInactive ?? false;
  const includeTest = options?.includeTest ?? false;
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getTeam({ includeInactive, includeTest });
      setMembers(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [includeInactive, includeTest]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { members, loading, error, refetch: fetch };
}
