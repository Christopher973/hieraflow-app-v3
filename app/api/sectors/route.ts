import { NextRequest } from "next/server";

import {
  createSector,
  getPrismaErrorCode,
  listSectors,
} from "@/src/lib/admin/sectors";
import {
  createSectorInputSchema,
  listSectorsQuerySchema,
} from "@/src/lib/admin/sectors-schemas";
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
  SectorListPayload,
  SectorMutationPayload,
} from "@/src/types/sector";

export async function GET(request: NextRequest) {
  const sessionCheck = await requireSession();

  if (!sessionCheck.ok) {
    return unauthorized(sessionCheck.message);
  }

  const queryParse = listSectorsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    departmentId: request.nextUrl.searchParams.get("departmentId") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });

  if (!queryParse.success) {
    return validationError(queryParse.error.issues);
  }

  try {
    const result = await listSectors(queryParse.data);

    return ok<SectorListPayload>(
      { items: result.items },
      "Secteurs récupérés",
      {
        pagination: result.pagination,
      },
    );
  } catch {
    return internalError("Impossible de récupérer les secteurs.");
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

  const inputParse = createSectorInputSchema.safeParse(payload);

  if (!inputParse.success) {
    return validationError(inputParse.error.issues);
  }

  try {
    const sector = await createSector(inputParse.data);

    return created<SectorMutationPayload>({ sector }, "Secteur créé", {
      location: request.nextUrl.pathname,
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);

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

    return internalError("Impossible de créer le secteur.");
  }
}
