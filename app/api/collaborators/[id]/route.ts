import { NextRequest } from "next/server";

import {
  deleteCollaborator,
  getCollaboratorDetailById,
  getPrismaErrorCode,
  updateCollaborator,
} from "../../../../src/lib/admin/collaborators";
import {
  collaboratorIdSchema,
  updateCollaboratorInputSchema,
} from "@/src/lib/admin/collaborators-schemas";
import { requireAdmin, requireSession } from "@/src/lib/auth-guards";
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
import type {
  CollaboratorDetailPayload,
  CollaboratorMutationPayload,
} from "@/src/types/collaborator";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteParams) {
  const sessionCheck = await requireSession();

  if (!sessionCheck.ok) {
    return unauthorized(sessionCheck.message);
  }

  const { id } = await context.params;

  const idParse = collaboratorIdSchema.safeParse(id);

  if (!idParse.success) {
    return validationError(idParse.error.issues);
  }

  try {
    const collaborator = await getCollaboratorDetailById(idParse.data);

    if (!collaborator) {
      return notFound("Collaborateur introuvable.");
    }

    return ok<CollaboratorDetailPayload>(
      { collaborator },
      "Collaborateur récupéré",
    );
  } catch {
    return internalError("Impossible de récupérer le collaborateur.");
  }
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return adminCheck.code === "UNAUTHORIZED"
      ? unauthorized(adminCheck.message)
      : forbidden(adminCheck.message);
  }

  const { id } = await context.params;

  const idParse = collaboratorIdSchema.safeParse(id);

  if (!idParse.success) {
    return validationError(idParse.error.issues);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return invalidJson();
  }

  const inputParse = updateCollaboratorInputSchema.safeParse(payload);

  if (!inputParse.success) {
    return validationError(inputParse.error.issues);
  }

  try {
    const collaborator = await updateCollaborator(
      idParse.data,
      inputParse.data,
    );

    return ok<CollaboratorMutationPayload>(
      { collaborator },
      "Collaborateur mis à jour",
    );
  } catch (error) {
    const code = getPrismaErrorCode(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (code === "P2025") {
      if (
        errorMessage.includes("location") ||
        errorMessage.includes("locationId")
      ) {
        return conflict(
          "La localisation sélectionnée est introuvable.",
          "locationId",
        );
      }

      if (
        errorMessage.includes("position") ||
        errorMessage.includes("positionId")
      ) {
        return conflict("Le poste sélectionné est introuvable.", "positionId");
      }

      return notFound("Collaborateur introuvable.");
    }

    if (code === "P2002") {
      if (errorMessage.includes("member_sector_unique")) {
        return conflict(
          "Un collaborateur ne peut pas occuper deux postes dans le même secteur.",
          "positionIds",
        );
      }

      if (
        errorMessage.includes("memberId_sectorId") ||
        errorMessage.includes("memberId,sectorId")
      ) {
        return conflict(
          "Un collaborateur ne peut pas occuper deux postes dans le même secteur.",
          "positionIds",
        );
      }

      if (
        errorMessage.includes("memberId_positionId") ||
        errorMessage.includes("memberId,positionId")
      ) {
        return conflict(
          "Le collaborateur est déjà assigné à ce poste.",
          "positionIds",
        );
      }

      if (errorMessage.includes("serviceCode")) {
        return conflict(
          "Un collaborateur avec ce matricule existe déjà.",
          "serviceCode",
        );
      }

      if (errorMessage.includes("professionalEmail")) {
        return conflict(
          "Un collaborateur avec cet email professionnel existe déjà.",
          "professionalEmail",
        );
      }

      if (errorMessage.includes("positionId")) {
        return conflict(
          "Ce poste est déjà occupé par un autre collaborateur.",
          "positionId",
        );
      }

      return conflict(
        "Conflit d'assignation du collaborateur sur ce poste. Vérifiez le secteur et les affectations existantes.",
        "positionIds",
      );
    }

    if (code === "P2003") {
      if (errorMessage.includes("primaryPositionId")) {
        return conflict(
          "Le poste principal doit faire partie des postes affectés.",
          "primaryPositionId",
        );
      }

      if (errorMessage.includes("locationId")) {
        return conflict(
          "La localisation sélectionnée est introuvable.",
          "locationId",
        );
      }

      if (errorMessage.includes("positionId")) {
        return conflict("Le poste sélectionné est introuvable.", "positionId");
      }

      return conflict("Contrainte de clé étrangère violée.");
    }

    return internalError("Impossible de mettre à jour le collaborateur.");
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

  const idParse = collaboratorIdSchema.safeParse(id);

  if (!idParse.success) {
    return validationError(idParse.error.issues);
  }

  try {
    await deleteCollaborator(idParse.data);

    return noContent("Collaborateur supprimé");
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return notFound("Collaborateur introuvable.");
    }

    return internalError("Impossible de supprimer le collaborateur.");
  }
}
