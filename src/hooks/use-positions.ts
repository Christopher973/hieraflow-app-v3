import { useState, useEffect, useMemo, useCallback } from "react";
import { apiGet, apiRequest } from "@/src/lib/api-client";
import type {
  PositionDto,
  PositionListPayload,
  PositionListQuery,
  PositionMutationInput,
} from "@/src/types/position";
import type { PaginationMeta } from "@/src/types/api";

/**
 * Helper pour extraire les métadonnées de pagination depuis la réponse API.
 */
function getPaginationMeta(value: unknown): PaginationMeta {
  if (!value || typeof value !== "object") {
    return {
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    };
  }

  const candidate = value as Partial<PaginationMeta>;

  if (
    typeof candidate.page !== "number" ||
    typeof candidate.pageSize !== "number" ||
    typeof candidate.totalItems !== "number" ||
    typeof candidate.totalPages !== "number"
  ) {
    return {
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    };
  }

  return {
    page: candidate.page,
    pageSize: candidate.pageSize,
    totalItems: candidate.totalItems,
    totalPages: candidate.totalPages,
  };
}

/**
 * Hook personnalisé pour gérer les postes.
 *
 * @param initialQuery - Paramètres de requête initiaux (filtres, pagination)
 * @returns État et fonctions de gestion des postes
 */
export function usePositions(initialQuery: PositionListQuery = {}) {
  const [items, setItems] = useState<PositionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  });

  // Mémoïser la query pour éviter les boucles infinies
  const query = useMemo(
    () => ({
      q: initialQuery.q,
      sectorId: initialQuery.sectorId,
      departmentId: initialQuery.departmentId,
      type: initialQuery.type,
      vacantOnly: initialQuery.vacantOnly,
      page: initialQuery.page,
      pageSize: initialQuery.pageSize,
    }),
    [
      initialQuery.q,
      initialQuery.sectorId,
      initialQuery.departmentId,
      initialQuery.type,
      initialQuery.vacantOnly,
      initialQuery.page,
      initialQuery.pageSize,
    ],
  );

  /**
   * Charge la liste des postes depuis l'API.
   */
  const fetchPositions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiGet<PositionListPayload>("/positions", query);

      if (result.error) {
        setItems([]);
        setPagination({
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        });
        setError(result.error.message);
      } else {
        setItems(result.response.data?.items ?? []);
        setPagination(getPaginationMeta(result.response.meta?.pagination));
      }
    } catch (err) {
      console.error("[usePositions] Fetch error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors du chargement des postes.",
      );
    } finally {
      setLoading(false);
    }
  }, [query]);

  /**
   * Rafraîchit la liste des postes.
   */
  const refresh = useCallback(() => {
    void fetchPositions();
  }, [fetchPositions]);

  /**
   * Crée un nouveau poste.
   */
  const createPosition = useCallback(
    async (data: PositionMutationInput) => {
      try {
        const result = await apiRequest<{ position: PositionDto }>(
          "/positions",
          {
            method: "POST",
            body: data,
          },
        );

        if (!result.error && result.response.data) {
          // Rafraîchir la liste après création
          void fetchPositions();
          return { success: true, data: result.response.data.position };
        } else {
          return {
            success: false,
            error:
              result.error?.message ?? "Erreur lors de la création du poste.",
          };
        }
      } catch (err) {
        console.error("[usePositions] Create error:", err);
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : "Erreur lors de la création du poste.",
        };
      }
    },
    [fetchPositions],
  );

  /**
   * Met à jour un poste existant.
   */
  const updatePosition = useCallback(
    async (id: number, data: Partial<PositionMutationInput>) => {
      try {
        const result = await apiRequest<{ position: PositionDto }>(
          `/positions/${id}`,
          {
            method: "PATCH",
            body: data,
          },
        );

        if (!result.error && result.response.data) {
          // Mise à jour optimiste de l'état local
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? result.response.data!.position : item,
            ),
          );
          return { success: true, data: result.response.data.position };
        } else {
          return {
            success: false,
            error:
              result.error?.message ??
              "Erreur lors de la mise à jour du poste.",
          };
        }
      } catch (err) {
        console.error("[usePositions] Update error:", err);
        return {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : "Erreur lors de la mise à jour du poste.",
        };
      }
    },
    [],
  );

  /**
   * Supprime un poste.
   */
  const deletePosition = useCallback(async (id: number) => {
    try {
      const result = await apiRequest<void>(`/positions/${id}`, {
        method: "DELETE",
      });

      if (!result.error) {
        // Mise à jour optimiste de l'état local
        setItems((prev) => prev.filter((item) => item.id !== id));
        return { success: true };
      } else {
        return {
          success: false,
          error:
            result.error?.message ?? "Erreur lors de la suppression du poste.",
        };
      }
    } catch (err) {
      console.error("[usePositions] Delete error:", err);
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Erreur lors de la suppression du poste.",
      };
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isMounted) {
        await fetchPositions();
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [fetchPositions]);

  return {
    /** Liste des postes */
    items,
    /** Indique si le chargement est en cours */
    loading,
    /** Message d'erreur éventuel */
    error,
    /** Métadonnées de pagination */
    pagination,
    /** Rafraîchit la liste */
    refresh,
    /** Crée un nouveau poste */
    createPosition,
    /** Met à jour un poste existant */
    updatePosition,
    /** Supprime un poste */
    deletePosition,
  };
}
