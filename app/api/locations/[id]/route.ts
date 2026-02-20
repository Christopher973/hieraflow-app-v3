import { NextRequest } from "next/server";

import {
  deleteLocation,
  getPrismaErrorCode,
  updateLocation,
} from "@/src/lib/admin/locations";
import {
  locationIdSchema,
  updateLocationInputSchema,
} from "@/src/lib/admin/locations-schemas";
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
import type { LocationMutationPayload } from "@/src/types/location";

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

  const idParse = locationIdSchema.safeParse(id);

  if (!idParse.success) {
    return validationError(idParse.error.issues);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return invalidJson();
  }

  const inputParse = updateLocationInputSchema.safeParse(payload);

  if (!inputParse.success) {
    return validationError(inputParse.error.issues);
  }

  try {
    const location = await updateLocation(idParse.data, inputParse.data);

    return ok<LocationMutationPayload>(
      { location },
      "Localisation mise à jour",
    );
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return notFound("Localisation introuvable.");
    }

    if (code === "P2002") {
      return conflict("Une localisation avec ce nom existe déjà.", "name");
    }

    return internalError("Impossible de mettre à jour la localisation.");
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

  const idParse = locationIdSchema.safeParse(id);

  if (!idParse.success) {
    return validationError(idParse.error.issues);
  }

  try {
    await deleteLocation(idParse.data);

    return noContent("Localisation supprimée");
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return notFound("Localisation introuvable.");
    }

    if (code === "P2003") {
      return conflict(
        "Cette localisation ne peut pas être supprimée car elle réfère des collaborateurs.",
      );
    }

    return internalError("Impossible de supprimer la localisation.");
  }
}
