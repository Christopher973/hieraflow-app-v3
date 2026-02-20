import { NextRequest } from "next/server";

import {
  deletePosition,
  getPrismaErrorCode,
  updatePosition,
} from "@/src/lib/admin/positions";
import {
  positionIdSchema,
  updatePositionInputSchema,
} from "@/src/lib/admin/positions-schemas";
import { requireAdmin } from "@/src/lib/auth-guards";
import {
  conflict,
  forbidden,
  internalError,
  invalidJson,
  noContent,
  notFound,
  ok,
  unauthorized,
  validationError,
} from "@/src/lib/api-response";
import type { PositionMutationPayload } from "@/src/types/position";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteParams) {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return adminCheck.code === "UNAUTHORIZED"
      ? unauthorized(adminCheck.message)
      : forbidden(adminCheck.message);
  }

  const { id } = await context.params;

  const idParse = positionIdSchema.safeParse(id);

  if (!idParse.success) {
    return validationError(idParse.error.issues);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return invalidJson();
  }

  const inputParse = updatePositionInputSchema.safeParse(payload);

  if (!inputParse.success) {
    return validationError(inputParse.error.issues);
  }

  try {
    const position = await updatePosition(idParse.data, inputParse.data);

    return ok<PositionMutationPayload>({ position }, "Poste mis à jour");
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      const errorMessage = error instanceof Error ? error.message : "";

      if (
        errorMessage.includes("Sector") ||
        errorMessage.includes("sector") ||
        errorMessage.includes("sectorId")
      ) {
        return conflict("Le secteur sélectionné est introuvable.", "sectorId");
      }

      if (
        errorMessage.includes("parentPosition") ||
        errorMessage.includes("parentPositionId")
      ) {
        return conflict(
          "Le poste parent sélectionné est introuvable.",
          "parentPositionId",
        );
      }

      return notFound("Poste introuvable.");
    }

    if (code === "P2002") {
      const errorMessage = error instanceof Error ? error.message : "";

      if (errorMessage.includes("member_sector_unique")) {
        return conflict(
          "Le membre occupant ce poste a déjà un poste dans le secteur cible.",
          "sectorId",
        );
      }

      if (errorMessage.includes("department_director_unique")) {
        return conflict(
          "Un département ne peut avoir qu'un seul directeur.",
          "departmentId",
        );
      }

      return conflict(
        "Un poste avec ce nom existe déjà dans ce secteur.",
        "name",
      );
    }

    if (code === "P2003") {
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

      return conflict(errorMessage);
    }

    return internalError("Impossible de mettre à jour le poste.");
  }
}

export async function DELETE(_request: NextRequest, context: RouteParams) {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return adminCheck.code === "UNAUTHORIZED"
      ? unauthorized(adminCheck.message)
      : forbidden(adminCheck.message);
  }

  const { id } = await context.params;

  const idParse = positionIdSchema.safeParse(id);

  if (!idParse.success) {
    return validationError(idParse.error.issues);
  }

  try {
    await deletePosition(idParse.data);

    return noContent("Poste supprimé");
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return notFound("Poste introuvable.");
    }

    if (code === "P2003") {
      return conflict(
        "Ce poste ne peut pas être supprimé car il est occupé par un membre.",
      );
    }

    return internalError("Impossible de supprimer le poste.");
  }
}
