import { NextRequest } from "next/server";

import {
  deleteDepartment,
  getPrismaErrorCode,
  updateDepartment,
} from "@/src/lib/admin/departments";
import {
  departmentIdSchema,
  updateDepartmentInputSchema,
} from "@/src/lib/admin/departments-schemas";
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
import type { DepartmentMutationPayload } from "@/src/types/department";

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

  const idParse = departmentIdSchema.safeParse(id);

  if (!idParse.success) {
    return validationError(idParse.error.issues);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return invalidJson();
  }

  const inputParse = updateDepartmentInputSchema.safeParse(payload);

  if (!inputParse.success) {
    return validationError(inputParse.error.issues);
  }

  try {
    const department = await updateDepartment(idParse.data, inputParse.data);

    return ok<DepartmentMutationPayload>(
      { department },
      "Département mis à jour",
    );
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return notFound("Département introuvable.");
    }

    if (code === "P2002") {
      return conflict("Un département avec ce nom existe déjà.", "name");
    }

    return internalError("Impossible de mettre à jour le département.");
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

  const idParse = departmentIdSchema.safeParse(id);

  if (!idParse.success) {
    return validationError(idParse.error.issues);
  }

  try {
    await deleteDepartment(idParse.data);

    return noContent("Département supprimé");
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return notFound("Département introuvable.");
    }

    if (code === "P2003") {
      return conflict(
        "Ce département ne peut pas être supprimé car il réfère des secteurs.",
      );
    }

    return internalError("Impossible de supprimer le département.");
  }
}
