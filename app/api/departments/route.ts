import { NextRequest } from "next/server";

import {
  createDepartment,
  getPrismaErrorCode,
  listDepartments,
} from "@/src/lib/admin/departments";
import {
  createDepartmentInputSchema,
  listDepartmentsQuerySchema,
} from "@/src/lib/admin/departments-schemas";
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
  DepartmentListPayload,
  DepartmentMutationPayload,
} from "@/src/types/department";

export async function GET(request: NextRequest) {
  const sessionCheck = await requireSession();

  if (!sessionCheck.ok) {
    return unauthorized(sessionCheck.message);
  }

  const queryParse = listDepartmentsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });

  if (!queryParse.success) {
    return validationError(queryParse.error.issues);
  }

  try {
    const result = await listDepartments(queryParse.data);

    return ok<DepartmentListPayload>(
      { items: result.items },
      "Départements récupérés",
      {
        pagination: result.pagination,
      },
    );
  } catch {
    return internalError("Impossible de récupérer les départements.");
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

  const inputParse = createDepartmentInputSchema.safeParse(payload);

  if (!inputParse.success) {
    return validationError(inputParse.error.issues);
  }

  try {
    const department = await createDepartment(inputParse.data);

    return created<DepartmentMutationPayload>(
      { department },
      "Département créé",
      {
        location: request.nextUrl.pathname,
      },
    );
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2002") {
      return conflict("Un département avec ce nom existe déjà.", "name");
    }

    return internalError("Impossible de créer le département.");
  }
}
