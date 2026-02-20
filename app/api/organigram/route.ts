import { NextRequest } from "next/server";
import { z } from "zod";

import { getOrganigramData } from "@/src/lib/organigram";
import { requireSession } from "@/src/lib/auth-guards";
import {
  internalError,
  ok,
  unauthorized,
  validationError,
} from "@/src/lib/api-response";
import type { OrganigramPayload } from "@/src/types/organigram";

const listOrganigramQuerySchema = z.object({
  departmentId: z.coerce.number().int().positive().optional(),
  sectorIds: z.string().trim().optional(),
});

const parseSectorIds = (rawValue?: string) => {
  if (!rawValue) {
    return { ok: true as const, ids: undefined };
  }

  const ids = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value));

  if (ids.length === 0) {
    return { ok: true as const, ids: undefined };
  }

  const isValid = ids.every((id) => Number.isInteger(id) && id > 0);

  if (!isValid) {
    return { ok: false as const, ids: undefined };
  }

  return { ok: true as const, ids: Array.from(new Set(ids)) };
};

export async function GET(request: NextRequest) {
  const sessionCheck = await requireSession();

  if (!sessionCheck.ok) {
    return unauthorized(sessionCheck.message);
  }

  const queryParse = listOrganigramQuerySchema.safeParse({
    departmentId: request.nextUrl.searchParams.get("departmentId") ?? undefined,
    sectorIds:
      request.nextUrl.searchParams.get("sectorIds") ??
      request.nextUrl.searchParams.get("sectorsId") ??
      undefined,
  });

  if (!queryParse.success) {
    return validationError(queryParse.error.issues);
  }

  const parsedSectorIds = parseSectorIds(queryParse.data.sectorIds);

  if (!parsedSectorIds.ok) {
    return validationError([
      {
        path: ["sectorIds"],
        message: "Liste de secteurs invalide.",
      },
    ]);
  }

  try {
    const data = await getOrganigramData({
      departmentId: queryParse.data.departmentId,
      sectorIds: parsedSectorIds.ids,
    });

    return ok<OrganigramPayload>(data, "Organigramme récupéré");
  } catch {
    return internalError("Impossible de récupérer l'organigramme.");
  }
}
