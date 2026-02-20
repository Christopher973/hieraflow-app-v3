"use client";

import { useCallback, useEffect, useState } from "react";

import { apiGet } from "@/src/lib/api-client";
import type {
  CollaboratorDetailPayload,
  CollaboratorDetailDto,
} from "@/src/types/collaborator";

type UseCollaboratorResult = {
  collaborator: CollaboratorDetailDto | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useCollaborator(
  memberId: number | null,
): UseCollaboratorResult {
  const [collaborator, setCollaborator] =
    useState<CollaboratorDetailDto | null>(null);
  const [loading, setLoading] = useState<boolean>(memberId !== null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (memberId === null) {
      setCollaborator(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await apiGet<CollaboratorDetailPayload>(
      `/collaborators/${memberId}`,
    );

    if (result.error) {
      setCollaborator(null);
      setError(result.error.message);
      setLoading(false);
      return;
    }

    setCollaborator(result.response.data?.collaborator ?? null);
    setLoading(false);
  }, [memberId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  return {
    collaborator,
    loading,
    error,
    refresh,
  };
}
