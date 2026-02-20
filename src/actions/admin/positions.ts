"use server";

import { requireSession, requireAdmin } from "@/src/lib/auth-guards";
import {
  listPositionsQuerySchema,
  createPositionInputSchema,
  updatePositionInputSchema,
  positionIdSchema,
} from "@/src/lib/admin/positions-schemas";
import {
  listPositions,
  getPositionById,
  createPosition,
  updatePosition,
  deletePosition,
  getPrismaErrorCode,
} from "@/src/lib/admin/positions";
import type { ApiError, ApiResponse } from "@/src/types/api";
import type {
  PositionListQuery,
  PositionListPayload,
  PositionMutationPayload,
  PositionDto,
  PositionMutationInput,
} from "@/src/types/position";

/**
 * Helper pour construire une réponse API standardisée.
 */
function buildApiPayload<T>(
  data: T | null,
  message: string,
  errors?: Array<{ field: string; message: string }>,
): ApiResponse<T> {
  return {
    data: data ?? null,
    errors: errors
      ? errors.map(
          (item): ApiError => ({
            code: "VALIDATION_ERROR",
            source: item.field,
            detail: item.message,
          }),
        )
      : null,
    message,
    meta: null,
  };
}

/**
 * Helper pour réponse non autorisée.
 */
function unauthorizedActionResponse<T>(message: string): ApiResponse<T> {
  return buildApiPayload<T>(null, message, [{ field: "auth", message }]);
}

/**
 * Helper pour extraire le code d'erreur Prisma.
 * @deprecated Utiliser `getPrismaErrorCode` importé depuis le service.
 */

/**
 * Action serveur pour lister les postes.
 * Nécessite une session utilisateur.
 */
export async function listPositionsAction(
  query: PositionListQuery,
): Promise<ApiResponse<PositionListPayload>> {
  // Vérification de la session
  const authCheck = await requireSession();
  if (!authCheck.ok) {
    return unauthorizedActionResponse(authCheck.message);
  }

  try {
    // Validation des paramètres
    const validation = listPositionsQuerySchema.safeParse(query);

    if (!validation.success) {
      return buildApiPayload<PositionListPayload>(
        null,
        "Paramètres de requête invalides.",
        validation.error.issues.map((err) => ({
          field: err.path.map((item) => String(item)).join("."),
          message: err.message,
        })),
      );
    }

    // Récupération des données
    const result = await listPositions(validation.data);

    const payload: PositionListPayload = {
      items: result.positions,
    };

    return buildApiPayload(payload, "Postes récupérés.");
  } catch (error) {
    console.error("[listPositionsAction] Error:", error);
    return buildApiPayload<PositionListPayload>(
      null,
      "Erreur lors de la récupération des postes.",
      [{ field: "server", message: "Erreur interne du serveur." }],
    );
  }
}

/**
 * Action serveur pour récupérer un poste par ID.
 * Nécessite une session utilisateur.
 */
export async function getPositionByIdAction(
  id: number,
): Promise<ApiResponse<{ position: PositionDto | null }>> {
  // Vérification de la session
  const authCheck = await requireSession();
  if (!authCheck.ok) {
    return unauthorizedActionResponse(authCheck.message);
  }

  try {
    // Validation de l'ID
    const validation = positionIdSchema.safeParse(id);

    if (!validation.success) {
      return buildApiPayload<{ position: PositionDto | null }>(
        null,
        "ID de poste invalide.",
        validation.error.issues.map((err: { message: string }) => ({
          field: "id",
          message: err.message,
        })),
      );
    }

    // Récupération du poste
    const position = await getPositionById(validation.data);

    if (!position) {
      return buildApiPayload<{ position: PositionDto | null }>(
        { position: null },
        "Poste introuvable.",
      );
    }

    return buildApiPayload({ position }, "Poste récupéré avec succès.");
  } catch (error) {
    console.error("[getPositionByIdAction] Error:", error);
    return buildApiPayload<{ position: PositionDto | null }>(
      null,
      "Erreur lors de la récupération du poste.",
      [{ field: "server", message: "Erreur interne du serveur." }],
    );
  }
}

/**
 * Action serveur pour créer un poste.
 * Nécessite un utilisateur admin.
 */
export async function createPositionAction(
  data: PositionMutationInput,
): Promise<ApiResponse<PositionMutationPayload>> {
  // Vérification admin
  const authCheck = await requireAdmin();
  if (!authCheck.ok) {
    return unauthorizedActionResponse(authCheck.message);
  }

  try {
    // Validation des données
    const validation = createPositionInputSchema.safeParse(data);

    if (!validation.success) {
      return buildApiPayload<PositionMutationPayload>(
        null,
        "Données de création invalides.",
        validation.error.issues.map((err) => ({
          field: err.path.map((item) => String(item)).join("."),
          message: err.message,
        })),
      );
    }

    // Création du poste
    const position = await createPosition(validation.data);

    return buildApiPayload({ position }, "Poste créé avec succès.");
  } catch (error) {
    console.error("[createPositionAction] Error:", error);

    const prismaCode = getPrismaErrorCode(error);

    if (prismaCode === "P2002") {
      const rawErrorMessage = error instanceof Error ? error.message : "";

      if (rawErrorMessage.includes("department_director_unique")) {
        return buildApiPayload<PositionMutationPayload>(
          null,
          "Un département ne peut avoir qu'un seul directeur.",
          [
            {
              field: "departmentId",
              message: "Ce département a déjà un directeur.",
            },
          ],
        );
      }

      return buildApiPayload<PositionMutationPayload>(
        null,
        "Un poste avec ce nom existe déjà dans ce secteur.",
        [{ field: "name", message: "Ce nom est déjà utilisé." }],
      );
    }

    if (prismaCode === "P2003") {
      const rawErrorMessage = error instanceof Error ? error.message : "";

      if (rawErrorMessage.includes("member_sector_unique")) {
        return buildApiPayload<PositionMutationPayload>(
          null,
          "Conflit lors de la mise à jour du poste.",
          [
            {
              field: "sectorId",
              message:
                "Le membre occupant ce poste a déjà un poste dans le secteur cible.",
            },
          ],
        );
      }

      const errorMessage = rawErrorMessage.includes("sectorId")
        ? "Le secteur sélectionné est introuvable."
        : rawErrorMessage.includes("departmentId")
          ? "Le département sélectionné est introuvable."
          : rawErrorMessage.includes("parentPositionId")
            ? "Le poste parent sélectionné est introuvable."
            : "Contrainte de clé étrangère violée.";

      const field = rawErrorMessage.includes("sectorId")
        ? "sectorId"
        : rawErrorMessage.includes("departmentId")
          ? "departmentId"
          : "parentPositionId";

      return buildApiPayload<PositionMutationPayload>(null, errorMessage, [
        { field, message: errorMessage },
      ]);
    }

    return buildApiPayload<PositionMutationPayload>(
      null,
      "Erreur lors de la création du poste.",
      [{ field: "server", message: "Erreur interne du serveur." }],
    );
  }
}

/**
 * Schéma pour valider l'input de updatePositionAction.
 */
const updatePositionActionSchema = updatePositionInputSchema.extend({
  id: positionIdSchema,
});

/**
 * Action serveur pour mettre à jour un poste.
 * Nécessite un utilisateur admin.
 */
export async function updatePositionAction(data: {
  id: number;
  name?: PositionMutationInput["name"];
  type?: PositionMutationInput["type"];
  isPrimary?: PositionMutationInput["isPrimary"];
  jobDetails?: PositionMutationInput["jobDetails"];
  sectorId?: PositionMutationInput["sectorId"];
  departmentId?: PositionMutationInput["departmentId"];
  parentPositionId?: PositionMutationInput["parentPositionId"];
}): Promise<ApiResponse<PositionMutationPayload>> {
  // Vérification admin
  const authCheck = await requireAdmin();
  if (!authCheck.ok) {
    return unauthorizedActionResponse(authCheck.message);
  }

  try {
    // Validation des données
    const validation = updatePositionActionSchema.safeParse(data);

    if (!validation.success) {
      return buildApiPayload<PositionMutationPayload>(
        null,
        "Données de mise à jour invalides.",
        validation.error.issues.map((err) => ({
          field: err.path.map((item) => String(item)).join("."),
          message: err.message,
        })),
      );
    }

    const { id, ...updateData } = validation.data;

    // Mise à jour du poste
    const position = await updatePosition(id, updateData);

    return buildApiPayload({ position }, "Poste mis à jour avec succès.");
  } catch (error) {
    console.error("[updatePositionAction] Error:", error);

    const prismaCode = getPrismaErrorCode(error);

    if (prismaCode === "P2025") {
      return buildApiPayload<PositionMutationPayload>(
        null,
        "Poste introuvable.",
        [{ field: "id", message: "Ce poste n'existe pas." }],
      );
    }

    if (prismaCode === "P2002") {
      const rawErrorMessage = error instanceof Error ? error.message : "";

      if (rawErrorMessage.includes("department_director_unique")) {
        return buildApiPayload<PositionMutationPayload>(
          null,
          "Un département ne peut avoir qu'un seul directeur.",
          [
            {
              field: "departmentId",
              message: "Ce département a déjà un directeur.",
            },
          ],
        );
      }

      return buildApiPayload<PositionMutationPayload>(
        null,
        "Un poste avec ce nom existe déjà dans ce secteur.",
        [{ field: "name", message: "Ce nom est déjà utilisé." }],
      );
    }

    if (prismaCode === "P2003") {
      const errorMessage =
        error instanceof Error && error.message.includes("sectorId")
          ? "Le secteur sélectionné est introuvable."
          : error instanceof Error && error.message.includes("departmentId")
            ? "Le département sélectionné est introuvable."
            : error instanceof Error &&
                error.message.includes("parentPositionId")
              ? "Le poste parent sélectionné est introuvable."
              : error instanceof Error &&
                  error.message.includes("director_position_assigned")
                ? "Impossible de convertir ce poste en directeur car il est déjà assigné à un collaborateur."
                : error instanceof Error && error.message.includes("own parent")
                  ? "Un poste ne peut pas être son propre parent."
                  : "Contrainte de clé étrangère violée.";

      const field =
        error instanceof Error && error.message.includes("sectorId")
          ? "sectorId"
          : error instanceof Error && error.message.includes("departmentId")
            ? "departmentId"
            : "parentPositionId";

      return buildApiPayload<PositionMutationPayload>(null, errorMessage, [
        { field, message: errorMessage },
      ]);
    }

    return buildApiPayload<PositionMutationPayload>(
      null,
      "Erreur lors de la mise à jour du poste.",
      [{ field: "server", message: "Erreur interne du serveur." }],
    );
  }
}

/**
 * Action serveur pour supprimer un poste.
 * Nécessite un utilisateur admin.
 */
export async function deletePositionAction(
  id: number,
): Promise<ApiResponse<{ success: boolean }>> {
  // Vérification admin
  const authCheck = await requireAdmin();
  if (!authCheck.ok) {
    return unauthorizedActionResponse(authCheck.message);
  }

  try {
    // Validation de l'ID
    const validation = positionIdSchema.safeParse(id);

    if (!validation.success) {
      return buildApiPayload<{ success: boolean }>(
        null,
        "ID de poste invalide.",
        validation.error.issues.map((err: { message: string }) => ({
          field: "id",
          message: err.message,
        })),
      );
    }

    // Suppression du poste
    await deletePosition(validation.data);

    return buildApiPayload({ success: true }, "Poste supprimé avec succès.");
  } catch (error) {
    console.error("[deletePositionAction] Error:", error);

    const prismaCode = getPrismaErrorCode(error);

    if (prismaCode === "P2025") {
      return buildApiPayload<{ success: boolean }>(null, "Poste introuvable.", [
        { field: "id", message: "Ce poste n'existe pas." },
      ]);
    }

    if (prismaCode === "P2003") {
      return buildApiPayload<{ success: boolean }>(
        null,
        "Impossible de supprimer ce poste car il est occupé par un membre.",
        [
          {
            field: "id",
            message: "Ce poste est occupé par un membre.",
          },
        ],
      );
    }

    return buildApiPayload<{ success: boolean }>(
      null,
      "Erreur lors de la suppression du poste.",
      [{ field: "server", message: "Erreur interne du serveur." }],
    );
  }
}
