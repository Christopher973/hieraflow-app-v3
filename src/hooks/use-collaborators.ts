"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet, apiRequest } from "@/src/lib/api-client";
import type { PaginationMeta } from "@/src/types/api";
import type {
  CollaboratorDto,
  CollaboratorListPayload,
  CollaboratorMutationPayload,
} from "@/src/types/collaborator";

// ─── Types ──────────────────────────────────────────────────────────────────────

type UseCollaboratorsFilters = {
  q?: string;
  status?: "ACTIF" | "INACTIF" | "SUSPENDU";
  gender?: "HOMME" | "FEMME" | "AUTRE";
  locationId?: number;
  departmentId?: number;
  sectorId?: number;
  positionId?: number;
  isReferentRH?: boolean;
  page?: number;
  pageSize?: number;
};

type CollaboratorCreateInput = {
  serviceCode: string;
  firstname: string;
  lastname: string;
  birthday?: string | null;
  gender?: "HOMME" | "FEMME" | "AUTRE";
  avatarKey?: string | null;
  avatarUrl?: string | null;
  professionalEmail: string;
  phone?: string | null;
  startDate: string;
  endDate?: string | null;
  status?: "ACTIF" | "INACTIF" | "SUSPENDU";
  isReferentRH?: boolean;
  locationId?: number | null;
  positionId?: number | null;
  positionIds?: number[];
  primaryPositionId?: number | null;
};

type CollaboratorUpdateInput = Partial<CollaboratorCreateInput>;

type UseCollaboratorsResult = {
  items: CollaboratorDto[];
  loading: boolean;
  error: string | null;
  pagination: PaginationMeta | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<boolean>;
  createCollaborator: (
    input: CollaboratorCreateInput,
  ) => Promise<CollaboratorDto | null>;
  updateCollaborator: (
    id: number,
    input: CollaboratorUpdateInput,
  ) => Promise<boolean>;
  deleteCollaborator: (id: number) => Promise<boolean>;
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

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

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useCollaborators(
  filters?: UseCollaboratorsFilters,
): UseCollaboratorsResult {
  const [items, setItems] = useState<CollaboratorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState<number>(filters?.page ?? 1);

  const query = useMemo(
    () => ({
      q: filters?.q,
      status: filters?.status,
      gender: filters?.gender,
      locationId: filters?.locationId,
      departmentId: filters?.departmentId,
      sectorId: filters?.sectorId,
      positionId: filters?.positionId,
      isReferentRH:
        filters?.isReferentRH !== undefined
          ? String(filters.isReferentRH)
          : undefined,
      page: filters?.page ?? 1,
      pageSize: filters?.pageSize ?? 10,
    }),
    [
      filters?.q,
      filters?.status,
      filters?.gender,
      filters?.locationId,
      filters?.departmentId,
      filters?.sectorId,
      filters?.positionId,
      filters?.isReferentRH,
      filters?.page,
      filters?.pageSize,
    ],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await apiGet<CollaboratorListPayload>("/collaborators", {
      ...query,
      page: 1,
    });

    if (result.error) {
      setItems([]);
      setPagination(null);
      setError(result.error.message);
      setLoading(false);
      return;
    }

    setItems(result.response.data?.items ?? []);
    setPagination(getPaginationMeta(result.response.meta?.pagination));
    setPage(1);
    setLoading(false);
  }, [query]);

  const loadMore = useCallback(async (): Promise<boolean> => {
    if (loading) return false;
    if (!pagination) return false;
    if (page >= pagination.totalPages) return false;

    const nextPage = page + 1;
    setLoading(true);
    setError(null);

    const result = await apiGet<CollaboratorListPayload>("/collaborators", {
      ...query,
      page: nextPage,
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return false;
    }

    const newItems = result.response.data?.items ?? [];
    setItems((prev) => [...prev, ...newItems]);
    setPagination(getPaginationMeta(result.response.meta?.pagination));
    setPage(nextPage);
    setLoading(false);
    return true;
  }, [loading, pagination, page, query]);

  const createCollaborator = useCallback(
    async (input: CollaboratorCreateInput) => {
      setError(null);

      const result = await apiRequest<CollaboratorMutationPayload>(
        "/collaborators",
        {
          method: "POST",
          body: input,
        },
      );

      if (result.error) {
        setError(result.error.message);
        return null;
      }

      const collaborator = result.response.data?.collaborator ?? null;
      await refresh();
      return collaborator;
    },
    [refresh],
  );

  const updateCollaborator = useCallback(
    async (id: number, input: CollaboratorUpdateInput) => {
      setError(null);

      const result = await apiRequest<CollaboratorMutationPayload>(
        `/collaborators/${id}`,
        {
          method: "PATCH",
          body: input,
        },
      );

      if (result.error) {
        setError(result.error.message);
        return false;
      }

      await refresh();
      return true;
    },
    [refresh],
  );

  const deleteCollaborator = useCallback(
    async (id: number) => {
      setError(null);

      const result = await apiRequest<null>(`/collaborators/${id}`, {
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
    loadMore,
    createCollaborator,
    updateCollaborator,
    deleteCollaborator,
  };
}
