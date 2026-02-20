import { NextRequest } from "next/server";

import {
  createPosition,
  getPrismaErrorCode,
  listPositions,
} from "@/src/lib/admin/positions";
import {
  createPositionInputSchema,
  listPositionsQuerySchema,
} from "@/src/lib/admin/positions-schemas";
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
  PositionListPayload,
  PositionMutationPayload,
} from "@/src/types/position";

export async function GET(request: NextRequest) {
  const sessionCheck = await requireSession();

  if (!sessionCheck.ok) {
    return unauthorized(sessionCheck.message);
  }

  const queryParse = listPositionsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    sectorId: request.nextUrl.searchParams.get("sectorId") ?? undefined,
    departmentId: request.nextUrl.searchParams.get("departmentId") ?? undefined,
    type: request.nextUrl.searchParams.get("type") ?? undefined,
    vacantOnly: request.nextUrl.searchParams.get("vacantOnly") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });

  if (!queryParse.success) {
    return validationError(queryParse.error.issues);
  }

  try {
    const result = await listPositions(queryParse.data);

    return ok<PositionListPayload>(
      { items: result.positions },
      "Postes récupérés",
      {
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          totalItems: result.total,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      },
    );
  } catch {
    return internalError("Impossible de récupérer les postes.");
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

  const inputParse = createPositionInputSchema.safeParse(payload);

  if (!inputParse.success) {
    return validationError(inputParse.error.issues);
  }

  try {
    const position = await createPosition(inputParse.data);

    return created<PositionMutationPayload>({ position }, "Poste créé", {
      location: request.nextUrl.pathname,
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2002") {
      const message = error instanceof Error ? error.message : "";

      if (message.includes("department_director_unique")) {
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
              : "Contrainte de clé étrangère violée.";

      return conflict(errorMessage);
    }

    if (code === "P2025") {
      const errorMessage =
        error instanceof Error && error.message.includes("parentPosition")
          ? "Le poste parent sélectionné est introuvable."
          : "Le secteur sélectionné est introuvable.";

      return conflict(errorMessage);
    }

    return internalError("Impossible de créer le poste.");
  }
}
