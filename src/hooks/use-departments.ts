"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet, apiRequest } from "@/src/lib/api-client";
import type { PaginationMeta } from "@/src/types/api";
import type {
  DepartmentDto,
  DepartmentListPayload,
  DepartmentMutationPayload,
} from "@/src/types/department";

type UseDepartmentsFilters = {
  q?: string;
  page?: number;
  pageSize?: number;
};

type DepartmentMutationInput = {
  name: string;
};

type UseDepartmentsResult = {
  items: DepartmentDto[];
  loading: boolean;
  error: string | null;
  pagination: PaginationMeta | null;
  refresh: () => Promise<void>;
  createDepartment: (input: DepartmentMutationInput) => Promise<boolean>;
  updateDepartment: (
    id: number,
    input: DepartmentMutationInput,
  ) => Promise<boolean>;
  deleteDepartment: (id: number) => Promise<boolean>;
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

export function useDepartments(
  filters?: UseDepartmentsFilters,
): UseDepartmentsResult {
  const [items, setItems] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  const query = useMemo(
    () => ({
      q: filters?.q,
      page: filters?.page ?? 1,
      pageSize: filters?.pageSize ?? 10,
    }),
    [filters?.page, filters?.pageSize, filters?.q],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await apiGet<DepartmentListPayload>("/departments", query);

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

  const createDepartment = useCallback(
    async (input: DepartmentMutationInput) => {
      setError(null);

      const result = await apiRequest<DepartmentMutationPayload>(
        "/departments",
        {
          method: "POST",
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

  const updateDepartment = useCallback(
    async (id: number, input: DepartmentMutationInput) => {
      setError(null);

      const result = await apiRequest<DepartmentMutationPayload>(
        `/departments/${id}`,
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

  const deleteDepartment = useCallback(
    async (id: number) => {
      setError(null);

      const result = await apiRequest<null>(`/departments/${id}`, {
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
    createDepartment,
    updateDepartment,
    deleteDepartment,
  };
}
