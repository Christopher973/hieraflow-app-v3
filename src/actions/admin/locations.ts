"use server";

import { z } from "zod";

import { buildApiPayload } from "@/src/lib/api-response";
import { requireAdmin, requireSession } from "@/src/lib/auth-guards";
import {
  createLocation,
  deleteLocation,
  getPrismaErrorCode,
  listLocations,
  updateLocation,
} from "@/src/lib/admin/locations";
import {
  createLocationInputSchema,
  listLocationsQuerySchema,
  locationIdSchema,
  updateLocationInputSchema,
} from "@/src/lib/admin/locations-schemas";
import type { ApiResponse, PaginationMeta } from "@/src/types/api";
import type {
  LocationListPayload,
  LocationMutationPayload,
} from "@/src/types/location";

const updateLocationActionSchema = z.object({
  id: locationIdSchema,
  name: updateLocationInputSchema.shape.name,
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

export async function listLocationsAction(
  payload: unknown,
): Promise<ApiResponse<LocationListPayload>> {
  const sessionCheck = await requireSession();

  if (!sessionCheck.ok) {
    return unauthorizedActionResponse<LocationListPayload>(
      sessionCheck.message,
      sessionCheck.code,
    );
  }

  const parse = listLocationsQuerySchema.safeParse(payload ?? {});

  if (!parse.success) {
    return buildApiPayload<LocationListPayload>({
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
    const result = await listLocations(parse.data);

    return buildApiPayload<LocationListPayload>({
      data: { items: result.items },
      message: "Localisations récupérées",
      meta: {
        pagination: result.pagination satisfies PaginationMeta,
      },
    });
  } catch {
    return buildApiPayload<LocationListPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de récupérer les localisations.",
        },
      ],
      message: "Erreur interne",
    });
  }
}

export async function createLocationAction(
  payload: unknown,
): Promise<ApiResponse<LocationMutationPayload>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return unauthorizedActionResponse<LocationMutationPayload>(
      adminCheck.message,
      adminCheck.code,
    );
  }

  const parse = createLocationInputSchema.safeParse(payload);

  if (!parse.success) {
    return buildApiPayload<LocationMutationPayload>({
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
    const location = await createLocation(parse.data);

    return buildApiPayload<LocationMutationPayload>({
      data: { location },
      message: "Localisation créée",
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2002") {
      return buildApiPayload<LocationMutationPayload>({
        errors: [
          {
            code: "CONFLICT",
            source: "name",
            detail: "Une localisation avec ce nom existe déjà.",
          },
        ],
        message: "Conflit",
      });
    }

    return buildApiPayload<LocationMutationPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de créer la localisation.",
        },
      ],
      message: "Erreur interne",
    });
  }
}

export async function updateLocationAction(
  payload: unknown,
): Promise<ApiResponse<LocationMutationPayload>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return unauthorizedActionResponse<LocationMutationPayload>(
      adminCheck.message,
      adminCheck.code,
    );
  }

  const parse = updateLocationActionSchema.safeParse(payload);

  if (!parse.success) {
    return buildApiPayload<LocationMutationPayload>({
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
    const location = await updateLocation(parse.data.id, {
      name: parse.data.name,
    });

    return buildApiPayload<LocationMutationPayload>({
      data: { location },
      message: "Localisation mise à jour",
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return buildApiPayload<LocationMutationPayload>({
        errors: [{ code: "NOT_FOUND", detail: "Localisation introuvable." }],
        message: "Ressource introuvable",
      });
    }

    if (code === "P2002") {
      return buildApiPayload<LocationMutationPayload>({
        errors: [
          {
            code: "CONFLICT",
            source: "name",
            detail: "Une localisation avec ce nom existe déjà.",
          },
        ],
        message: "Conflit",
      });
    }

    return buildApiPayload<LocationMutationPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de mettre à jour la localisation.",
        },
      ],
      message: "Erreur interne",
    });
  }
}

export async function deleteLocationAction(
  payload: unknown,
): Promise<ApiResponse<null>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return unauthorizedActionResponse<null>(
      adminCheck.message,
      adminCheck.code,
    );
  }

  const parse = locationIdSchema.safeParse(
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
    await deleteLocation(parse.data);

    return buildApiPayload<null>({
      data: null,
      errors: null,
      message: "Localisation supprimée",
      meta: null,
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return buildApiPayload<null>({
        errors: [{ code: "NOT_FOUND", detail: "Localisation introuvable." }],
        message: "Ressource introuvable",
      });
    }

    if (code === "P2003") {
      return buildApiPayload<null>({
        errors: [
          {
            code: "CONFLICT",
            detail:
              "Cette localisation ne peut pas être supprimée car elle est utilisée.",
          },
        ],
        message: "Conflit",
      });
    }

    return buildApiPayload<null>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de supprimer la localisation.",
        },
      ],
      message: "Erreur interne",
    });
  }
}
