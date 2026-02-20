import { NextRequest } from "next/server";

import {
  deleteSector,
  getPrismaErrorCode,
  updateSector,
} from "@/src/lib/admin/sectors";
import {
  sectorIdSchema,
  updateSectorInputSchema,
} from "@/src/lib/admin/sectors-schemas";
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
import type { SectorMutationPayload } from "@/src/types/sector";

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

  const idParse = sectorIdSchema.safeParse(id);

  if (!idParse.success) {
    return validationError(idParse.error.issues);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return invalidJson();
  }

  const inputParse = updateSectorInputSchema.safeParse(payload);

  if (!inputParse.success) {
    return validationError(inputParse.error.issues);
  }

  try {
    const sector = await updateSector(idParse.data, inputParse.data);

    return ok<SectorMutationPayload>({ sector }, "Secteur mis à jour");
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return notFound("Secteur introuvable.");
    }

    if (code === "P2002") {
      return conflict(
        "Un secteur avec ce nom existe déjà dans ce département.",
        "name",
      );
    }

    if (code === "P2003") {
      return conflict(
        "Le département sélectionné est introuvable.",
        "departmentId",
      );
    }

    return internalError("Impossible de mettre à jour le secteur.");
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

  const idParse = sectorIdSchema.safeParse(id);

  if (!idParse.success) {
    return validationError(idParse.error.issues);
  }

  try {
    await deleteSector(idParse.data);

    return noContent("Secteur supprimé");
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return notFound("Secteur introuvable.");
    }

    if (code === "P2003") {
      return conflict(
        "Ce secteur ne peut pas être supprimé car il réfère des collaborateurs.",
      );
    }

    return internalError("Impossible de supprimer le secteur.");
  }
}
