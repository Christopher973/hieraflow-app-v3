"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet } from "@/src/lib/api-client";
import type { OrganigramPayload } from "@/src/types/organigram";

type UseOrganigramFilters = {
  departmentId?: number;
  sectorIds?: number[];
};

type UseOrganigramResult = {
  data: OrganigramPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useOrganigram(
  filters?: UseOrganigramFilters,
  enabled = true,
): UseOrganigramResult {
  const [data, setData] = useState<OrganigramPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled ? true : true);
  const [error, setError] = useState<string | null>(null);

  const departmentId = filters?.departmentId;
  const sectorIds = filters?.sectorIds;
  const sectorIdsQuery = useMemo(
    () => (sectorIds && sectorIds.length > 0 ? sectorIds.join(",") : undefined),
    [sectorIds],
  );

  const query = useMemo(
    () => ({
      departmentId,
      sectorIds: sectorIdsQuery,
    }),
    [departmentId, sectorIdsQuery],
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    const result = await apiGet<OrganigramPayload>("/organigram", query);

    if (result.error) {
      setData(null);
      setError(result.error.message);
      setLoading(false);
      return;
    }

    setData(result.response.data ?? null);
    setLoading(false);
  }, [query, enabled]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refresh, enabled]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}
