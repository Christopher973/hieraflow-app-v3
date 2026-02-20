import { NextRequest } from "next/server";

import {
  createLocation,
  getPrismaErrorCode,
  listLocations,
} from "@/src/lib/admin/locations";
import {
  createLocationInputSchema,
  listLocationsQuerySchema,
} from "@/src/lib/admin/locations-schemas";
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
  LocationListPayload,
  LocationMutationPayload,
} from "@/src/types/location";

export async function GET(request: NextRequest) {
  const sessionCheck = await requireSession();

  if (!sessionCheck.ok) {
    return unauthorized(sessionCheck.message);
  }

  const queryParse = listLocationsQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
  });

  if (!queryParse.success) {
    return validationError(queryParse.error.issues);
  }

  try {
    const result = await listLocations(queryParse.data);

    return ok<LocationListPayload>(
      { items: result.items },
      "Localisations récupérées",
      {
        pagination: result.pagination,
      },
    );
  } catch {
    return internalError("Impossible de récupérer les localisations.");
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

  const inputParse = createLocationInputSchema.safeParse(payload);

  if (!inputParse.success) {
    return validationError(inputParse.error.issues);
  }

  try {
    const location = await createLocation(inputParse.data);

    return created<LocationMutationPayload>(
      { location },
      "Localisation créée",
      {
        location: request.nextUrl.pathname,
      },
    );
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2002") {
      return conflict("Une localisation avec ce nom existe déjà.", "name");
    }

    return internalError("Impossible de créer la localisation.");
  }
}
