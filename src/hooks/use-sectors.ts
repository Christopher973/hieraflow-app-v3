"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet, apiRequest } from "@/src/lib/api-client";
import type { PaginationMeta } from "@/src/types/api";
import type {
  SectorDto,
  SectorListPayload,
  SectorMutationPayload,
} from "@/src/types/sector";

type UseSectorsFilters = {
  q?: string;
  departmentId?: number;
  page?: number;
  pageSize?: number;
};

type SectorMutationInput = {
  name: string;
  departmentId: number;
};

type UseSectorsResult = {
  items: SectorDto[];
  loading: boolean;
  error: string | null;
  pagination: PaginationMeta | null;
  refresh: () => Promise<void>;
  createSector: (input: SectorMutationInput) => Promise<boolean>;
  updateSector: (id: number, input: SectorMutationInput) => Promise<boolean>;
  deleteSector: (id: number) => Promise<boolean>;
};

const getPaginationMeta = (value: unknown): PaginationMeta | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PaginationMeta>;

  if (
    typeof candidate.page !== "number" ||
    typeof candidate.pageSize !== "number" ||
    typeof candidate.totalItems !== "number" ||
    typeof candidate.totalPages !== "number"
  ) {
    return null;
  }

  return {
    page: candidate.page,
    pageSize: candidate.pageSize,
    totalItems: candidate.totalItems,
    totalPages: candidate.totalPages,
  };
};

export function useSectors(filters?: UseSectorsFilters): UseSectorsResult {
  const [items, setItems] = useState<SectorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  const query = useMemo(
    () => ({
      q: filters?.q,
      departmentId: filters?.departmentId,
      page: filters?.page ?? 1,
      pageSize: filters?.pageSize ?? 10,
    }),
    [filters?.departmentId, filters?.page, filters?.pageSize, filters?.q],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await apiGet<SectorListPayload>("/sectors", query);

    if (result.error) {
      setItems([]);
      setPagination(null);
      setError(result.error.message);
      setLoading(false);
      return;
    }

    setItems(result.response.data?.items ?? []);
    setPagination(getPaginationMeta(result.response.meta?.pagination));
    setLoading(false);
  }, [query]);

  const createSector = useCallback(
    async (input: SectorMutationInput) => {
      setError(null);

      const result = await apiRequest<SectorMutationPayload>("/sectors", {
        method: "POST",
        body: input,
      });

      if (result.error) {
        setError(result.error.message);
        return false;
      }

      await refresh();
      return true;
    },
    [refresh],
  );

  const updateSector = useCallback(
    async (id: number, input: SectorMutationInput) => {
      setError(null);

      const result = await apiRequest<SectorMutationPayload>(`/sectors/${id}`, {
        method: "PATCH",
        body: input,
      });

      if (result.error) {
        setError(result.error.message);
        return false;
      }

      await refresh();
      return true;
    },
    [refresh],
  );

  const deleteSector = useCallback(
    async (id: number) => {
      setError(null);

      const result = await apiRequest<null>(`/sectors/${id}`, {
        method: "DELETE",
      });

      if (result.error) {
        setError(result.error.message);
        return false;
      }

      await refresh();
      return true;
    },
    [refresh],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  return {
    items,
    loading,
    error,
    pagination,
    refresh,
    createSector,
    updateSector,
    deleteSector,
  };
}
