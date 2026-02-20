import { NextRequest } from "next/server";

import {
  createCollaborator,
  getPrismaErrorCode,
  listCollaborators,
} from "../../../src/lib/admin/collaborators";
import {
  createCollaboratorInputSchema,
  listCollaboratorsQuerySchema,
} from "@/src/lib/admin/collaborators-schemas";
import { requireAdmin, requireSession } from "@/src/lib/auth-guards";
import {
  conflict,
  created,
  forbidden,
  internalError,
  invalidJson,
  ok,
  unauthorized,
  validationError,
} from "@/src/lib/api-response";
import type {
  CollaboratorListPayload,
  CollaboratorMutationPayload,
} from "@/src/types/collaborator";

export async function GET(request: NextRequest) {
  const sessionCheck = await requireSession();

  if (!sessionCheck.ok) {
    return unauthorized(sessionCheck.message);
  }

  const queryParse = listCollaboratorsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    gender: request.nextUrl.searchParams.get("gender") ?? undefined,
    locationId: request.nextUrl.searchParams.get("locationId") ?? undefined,
    departmentId: request.nextUrl.searchParams.get("departmentId") ?? undefined,
    sectorId: request.nextUrl.searchParams.get("sectorId") ?? undefined,
    positionId: request.nextUrl.searchParams.get("positionId") ?? undefined,
    isReferentRH: request.nextUrl.searchParams.get("isReferentRH") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });

  if (!queryParse.success) {
    return validationError(queryParse.error.issues);
  }

  try {
    const result = await listCollaborators(queryParse.data);

    return ok<CollaboratorListPayload>(
      { items: result.items },
      "Collaborateurs récupérés",
      {
        pagination: result.pagination,
      },
    );
  } catch (error) {
    // Log the actual error to help debugging on server
    try {
      console.error(
        "[GET /api/collaborators] Error while listing collaborators:",
        error,
      );
    } catch {}
    return internalError("Impossible de récupérer les collaborateurs.");
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return adminCheck.code === "UNAUTHORIZED"
      ? unauthorized(adminCheck.message)
      : forbidden(adminCheck.message);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return invalidJson();
  }

  const inputParse = createCollaboratorInputSchema.safeParse(payload);

  if (!inputParse.success) {
    return validationError(inputParse.error.issues);
  }

  try {
    const collaborator = await createCollaborator(inputParse.data);

    return created<CollaboratorMutationPayload>(
      { collaborator },
      "Collaborateur créé",
      {
        location: request.nextUrl.pathname,
      },
    );
  } catch (error) {
    const code = getPrismaErrorCode(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (code === "P2002") {
      if (errorMessage.includes("member_sector_unique")) {
        return conflict(
          "Un collaborateur ne peut pas occuper deux postes dans le même secteur.",
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

      return conflict("Un collaborateur avec ces informations existe déjà.");
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

    return internalError("Impossible de créer le collaborateur.");
  }
}
