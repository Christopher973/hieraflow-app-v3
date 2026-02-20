"use server";

import { z } from "zod";

import { buildApiPayload } from "@/src/lib/api-response";
import { requireAdmin, requireSession } from "@/src/lib/auth-guards";
import {
  createCollaborator,
  deleteCollaborator,
  getPrismaErrorCode,
  listCollaborators,
  updateCollaborator,
} from "@/src/lib/admin/collaborators";
import {
  collaboratorIdSchema,
  createCollaboratorInputSchema,
  listCollaboratorsQuerySchema,
  updateCollaboratorInputSchema,
} from "@/src/lib/admin/collaborators-schemas";
import type { ApiResponse, PaginationMeta } from "@/src/types/api";
import type {
  CollaboratorListPayload,
  CollaboratorMutationPayload,
} from "@/src/types/collaborator";

const updateCollaboratorActionSchema = z.object({
  id: collaboratorIdSchema,
  ...updateCollaboratorInputSchema.shape,
});

function unauthorizedActionResponse<T>(
  detail: string,
  code: "UNAUTHORIZED" | "FORBIDDEN",
): ApiResponse<T> {
  return buildApiPayload<T>({
    errors: [{ code, detail }],
    message: code === "UNAUTHORIZED" ? "Accès non autorisé" : "Accès interdit",
  });
}

// ─── LIST ───────────────────────────────────────────────────────────────────────

export async function listCollaboratorsAction(
  payload: unknown,
): Promise<ApiResponse<CollaboratorListPayload>> {
  const sessionCheck = await requireSession();

  if (!sessionCheck.ok) {
    return unauthorizedActionResponse<CollaboratorListPayload>(
      sessionCheck.message,
      sessionCheck.code,
    );
  }

  const parse = listCollaboratorsQuerySchema.safeParse(payload ?? {});

  if (!parse.success) {
    return buildApiPayload<CollaboratorListPayload>({
      errors: parse.error.issues.map((issue) => ({
        code: "VALIDATION_ERROR",
        source:
          issue.path.map((value) => String(value)).join(".") ||
          "corps de requête",
        detail: issue.message,
      })),
      message: "Erreur de validation",
    });
  }

  try {
    const result = await listCollaborators(parse.data);

    return buildApiPayload<CollaboratorListPayload>({
      data: { items: result.items },
      message: "Collaborateurs récupérés",
      meta: {
        pagination: result.pagination satisfies PaginationMeta,
      },
    });
  } catch {
    return buildApiPayload<CollaboratorListPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de récupérer les collaborateurs.",
        },
      ],
      message: "Erreur interne",
    });
  }
}

// ─── CREATE ─────────────────────────────────────────────────────────────────────

export async function createCollaboratorAction(
  payload: unknown,
): Promise<ApiResponse<CollaboratorMutationPayload>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return unauthorizedActionResponse<CollaboratorMutationPayload>(
      adminCheck.message,
      adminCheck.code,
    );
  }

  const parse = createCollaboratorInputSchema.safeParse(payload);

  if (!parse.success) {
    return buildApiPayload<CollaboratorMutationPayload>({
      errors: parse.error.issues.map((issue) => ({
        code: "VALIDATION_ERROR",
        source:
          issue.path.map((value) => String(value)).join(".") ||
          "corps de requête",
        detail: issue.message,
      })),
      message: "Erreur de validation",
    });
  }

  try {
    const collaborator = await createCollaborator(parse.data);

    return buildApiPayload<CollaboratorMutationPayload>({
      data: { collaborator },
      message: "Collaborateur créé",
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (code === "P2002") {
      if (errorMessage.includes("member_sector_unique")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "positionIds",
              detail:
                "Un collaborateur ne peut pas occuper deux postes dans le même secteur.",
            },
          ],
          message: "Conflit",
        });
      }

      if (errorMessage.includes("serviceCode")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "serviceCode",
              detail: "Un collaborateur avec ce matricule existe déjà.",
            },
          ],
          message: "Conflit",
        });
      }

      if (errorMessage.includes("professionalEmail")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "professionalEmail",
              detail:
                "Un collaborateur avec cet email professionnel existe déjà.",
            },
          ],
          message: "Conflit",
        });
      }

      if (errorMessage.includes("positionId")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "positionId",
              detail: "Ce poste est déjà occupé par un autre collaborateur.",
            },
          ],
          message: "Conflit",
        });
      }

      return buildApiPayload<CollaboratorMutationPayload>({
        errors: [
          {
            code: "CONFLICT",
            detail: "Un collaborateur avec ces informations existe déjà.",
          },
        ],
        message: "Conflit",
      });
    }

    if (code === "P2003") {
      if (errorMessage.includes("primaryPositionId")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "primaryPositionId",
              detail:
                "Le poste principal doit faire partie des postes affectés.",
            },
          ],
          message: "Conflit",
        });
      }

      if (errorMessage.includes("locationId")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "locationId",
              detail: "La localisation sélectionnée est introuvable.",
            },
          ],
          message: "Conflit",
        });
      }

      if (errorMessage.includes("positionId")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "positionId",
              detail: "Le poste sélectionné est introuvable.",
            },
          ],
          message: "Conflit",
        });
      }

      return buildApiPayload<CollaboratorMutationPayload>({
        errors: [
          {
            code: "CONFLICT",
            detail: "Contrainte de clé étrangère violée.",
          },
        ],
        message: "Conflit",
      });
    }

    return buildApiPayload<CollaboratorMutationPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de créer le collaborateur.",
        },
      ],
      message: "Erreur interne",
    });
  }
}

// ─── UPDATE ─────────────────────────────────────────────────────────────────────

export async function updateCollaboratorAction(
  payload: unknown,
): Promise<ApiResponse<CollaboratorMutationPayload>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return unauthorizedActionResponse<CollaboratorMutationPayload>(
      adminCheck.message,
      adminCheck.code,
    );
  }

  const parse = updateCollaboratorActionSchema.safeParse(payload);

  if (!parse.success) {
    return buildApiPayload<CollaboratorMutationPayload>({
      errors: parse.error.issues.map((issue) => ({
        code: "VALIDATION_ERROR",
        source:
          issue.path.map((value) => String(value)).join(".") ||
          "corps de requête",
        detail: issue.message,
      })),
      message: "Erreur de validation",
    });
  }

  const { id, ...updateData } = parse.data;

  try {
    const collaborator = await updateCollaborator(id, updateData);

    return buildApiPayload<CollaboratorMutationPayload>({
      data: { collaborator },
      message: "Collaborateur mis à jour",
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (code === "P2025") {
      return buildApiPayload<CollaboratorMutationPayload>({
        errors: [{ code: "NOT_FOUND", detail: "Collaborateur introuvable." }],
        message: "Ressource introuvable",
      });
    }

    if (code === "P2002") {
      if (errorMessage.includes("member_sector_unique")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "positionIds",
              detail:
                "Un collaborateur ne peut pas occuper deux postes dans le même secteur.",
            },
          ],
          message: "Conflit",
        });
      }

      if (errorMessage.includes("serviceCode")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "serviceCode",
              detail: "Un collaborateur avec ce matricule existe déjà.",
            },
          ],
          message: "Conflit",
        });
      }

      if (errorMessage.includes("professionalEmail")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "professionalEmail",
              detail:
                "Un collaborateur avec cet email professionnel existe déjà.",
            },
          ],
          message: "Conflit",
        });
      }

      if (errorMessage.includes("positionId")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "positionId",
              detail: "Ce poste est déjà occupé par un autre collaborateur.",
            },
          ],
          message: "Conflit",
        });
      }

      return buildApiPayload<CollaboratorMutationPayload>({
        errors: [
          {
            code: "CONFLICT",
            detail: "Un collaborateur avec ces informations existe déjà.",
          },
        ],
        message: "Conflit",
      });
    }

    if (code === "P2003") {
      if (errorMessage.includes("primaryPositionId")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "primaryPositionId",
              detail:
                "Le poste principal doit faire partie des postes affectés.",
            },
          ],
          message: "Conflit",
        });
      }

      if (errorMessage.includes("locationId")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "locationId",
              detail: "La localisation sélectionnée est introuvable.",
            },
          ],
          message: "Conflit",
        });
      }

      if (errorMessage.includes("positionId")) {
        return buildApiPayload<CollaboratorMutationPayload>({
          errors: [
            {
              code: "CONFLICT",
              source: "positionId",
              detail: "Le poste sélectionné est introuvable.",
            },
          ],
          message: "Conflit",
        });
      }

      return buildApiPayload<CollaboratorMutationPayload>({
        errors: [
          {
            code: "CONFLICT",
            detail: "Contrainte de clé étrangère violée.",
          },
        ],
        message: "Conflit",
      });
    }

    return buildApiPayload<CollaboratorMutationPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de mettre à jour le collaborateur.",
        },
      ],
      message: "Erreur interne",
    });
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────────────

export async function deleteCollaboratorAction(
  payload: unknown,
): Promise<ApiResponse<null>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return unauthorizedActionResponse<null>(
      adminCheck.message,
      adminCheck.code,
    );
  }

  const parse = collaboratorIdSchema.safeParse(
    typeof payload === "object" && payload !== null && "id" in payload
      ? (payload as { id: unknown }).id
      : payload,
  );

  if (!parse.success) {
    return buildApiPayload<null>({
      errors: parse.error.issues.map((issue) => ({
        code: "VALIDATION_ERROR",
        source:
          issue.path.map((value) => String(value)).join(".") ||
          "corps de requête",
        detail: issue.message,
      })),
      message: "Erreur de validation",
    });
  }

  try {
    await deleteCollaborator(parse.data);

    return buildApiPayload<null>({
      data: null,
      errors: null,
      message: "Collaborateur supprimé",
      meta: null,
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return buildApiPayload<null>({
        errors: [{ code: "NOT_FOUND", detail: "Collaborateur introuvable." }],
        message: "Ressource introuvable",
      });
    }

    return buildApiPayload<null>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de supprimer le collaborateur.",
        },
      ],
      message: "Erreur interne",
    });
  }
}
