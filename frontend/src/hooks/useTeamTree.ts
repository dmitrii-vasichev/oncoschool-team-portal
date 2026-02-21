"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { TeamTreeResponse } from "@/lib/types";

export function useTeamTree(options?: { includeInactive?: boolean; includeTest?: boolean }) {
  const includeInactive = options?.includeInactive ?? false;
  const includeTest = options?.includeTest ?? false;
  const [tree, setTree] = useState<TeamTreeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getTeamTree({ includeInactive, includeTest });
      setTree(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [includeInactive, includeTest]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { tree, loading, error, refetch: fetch };
}
