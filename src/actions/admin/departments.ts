"use server";

import { z } from "zod";

import { buildApiPayload } from "@/src/lib/api-response";
import { requireAdmin, requireSession } from "@/src/lib/auth-guards";
import {
  createDepartment,
  deleteDepartment,
  getPrismaErrorCode,
  listDepartments,
  updateDepartment,
} from "@/src/lib/admin/departments";
import {
  createDepartmentInputSchema,
  departmentIdSchema,
  listDepartmentsQuerySchema,
  updateDepartmentInputSchema,
} from "@/src/lib/admin/departments-schemas";
import type { ApiResponse, PaginationMeta } from "@/src/types/api";
import type {
  DepartmentListPayload,
  DepartmentMutationPayload,
} from "@/src/types/department";

const updateDepartmentActionSchema = z.object({
  id: departmentIdSchema,
  name: updateDepartmentInputSchema.shape.name,
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

export async function listDepartmentsAction(
  payload: unknown,
): Promise<ApiResponse<DepartmentListPayload>> {
  const sessionCheck = await requireSession();

  if (!sessionCheck.ok) {
    return unauthorizedActionResponse<DepartmentListPayload>(
      sessionCheck.message,
      sessionCheck.code,
    );
  }

  const parse = listDepartmentsQuerySchema.safeParse(payload ?? {});

  if (!parse.success) {
    return buildApiPayload<DepartmentListPayload>({
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
    const result = await listDepartments(parse.data);

    return buildApiPayload<DepartmentListPayload>({
      data: { items: result.items },
      message: "Départements récupérés",
      meta: {
        pagination: result.pagination satisfies PaginationMeta,
      },
    });
  } catch {
    return buildApiPayload<DepartmentListPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de récupérer les départements.",
        },
      ],
      message: "Erreur interne",
    });
  }
}

export async function createDepartmentAction(
  payload: unknown,
): Promise<ApiResponse<DepartmentMutationPayload>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return unauthorizedActionResponse<DepartmentMutationPayload>(
      adminCheck.message,
      adminCheck.code,
    );
  }

  const parse = createDepartmentInputSchema.safeParse(payload);

  if (!parse.success) {
    return buildApiPayload<DepartmentMutationPayload>({
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
    const department = await createDepartment(parse.data);

    return buildApiPayload<DepartmentMutationPayload>({
      data: { department },
      message: "Département créé",
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2002") {
      return buildApiPayload<DepartmentMutationPayload>({
        errors: [
          {
            code: "CONFLICT",
            source: "name",
            detail: "Un département avec ce nom existe déjà.",
          },
        ],
        message: "Conflit",
      });
    }

    return buildApiPayload<DepartmentMutationPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de créer le département.",
        },
      ],
      message: "Erreur interne",
    });
  }
}

export async function updateDepartmentAction(
  payload: unknown,
): Promise<ApiResponse<DepartmentMutationPayload>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return unauthorizedActionResponse<DepartmentMutationPayload>(
      adminCheck.message,
      adminCheck.code,
    );
  }

  const parse = updateDepartmentActionSchema.safeParse(payload);

  if (!parse.success) {
    return buildApiPayload<DepartmentMutationPayload>({
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
    const department = await updateDepartment(parse.data.id, {
      name: parse.data.name,
    });

    return buildApiPayload<DepartmentMutationPayload>({
      data: { department },
      message: "Département mis à jour",
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return buildApiPayload<DepartmentMutationPayload>({
        errors: [{ code: "NOT_FOUND", detail: "Département introuvable." }],
        message: "Ressource introuvable",
      });
    }

    if (code === "P2002") {
      return buildApiPayload<DepartmentMutationPayload>({
        errors: [
          {
            code: "CONFLICT",
            source: "name",
            detail: "Un département avec ce nom existe déjà.",
          },
        ],
        message: "Conflit",
      });
    }

    return buildApiPayload<DepartmentMutationPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de mettre à jour le département.",
        },
      ],
      message: "Erreur interne",
    });
  }
}

export async function deleteDepartmentAction(
  payload: unknown,
): Promise<ApiResponse<null>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return unauthorizedActionResponse<null>(
      adminCheck.message,
      adminCheck.code,
    );
  }

  const parse = departmentIdSchema.safeParse(
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
    await deleteDepartment(parse.data);

    return buildApiPayload<null>({
      data: null,
      errors: null,
      message: "Département supprimé",
      meta: null,
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return buildApiPayload<null>({
        errors: [{ code: "NOT_FOUND", detail: "Département introuvable." }],
        message: "Ressource introuvable",
      });
    }

    if (code === "P2003") {
      return buildApiPayload<null>({
        errors: [
          {
            code: "CONFLICT",
            detail:
              "Ce département ne peut pas être supprimé car il est utilisé.",
          },
        ],
        message: "Conflit",
      });
    }

    return buildApiPayload<null>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de supprimer le département.",
        },
      ],
      message: "Erreur interne",
    });
  }
}
