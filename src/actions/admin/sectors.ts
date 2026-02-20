"use server";

import { z } from "zod";

import { buildApiPayload } from "@/src/lib/api-response";
import { requireAdmin, requireSession } from "@/src/lib/auth-guards";
import {
  createSector,
  deleteSector,
  getPrismaErrorCode,
  listSectors,
  updateSector,
} from "@/src/lib/admin/sectors";
import {
  createSectorInputSchema,
  listSectorsQuerySchema,
  sectorIdSchema,
  updateSectorInputSchema,
} from "@/src/lib/admin/sectors-schemas";
import type { ApiResponse, PaginationMeta } from "@/src/types/api";
import type {
  SectorListPayload,
  SectorMutationPayload,
} from "@/src/types/sector";

const updateSectorActionSchema = z.object({
  id: sectorIdSchema,
  name: updateSectorInputSchema.shape.name,
  departmentId: updateSectorInputSchema.shape.departmentId,
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

export async function listSectorsAction(
  payload: unknown,
): Promise<ApiResponse<SectorListPayload>> {
  const sessionCheck = await requireSession();

  if (!sessionCheck.ok) {
    return unauthorizedActionResponse<SectorListPayload>(
      sessionCheck.message,
      sessionCheck.code,
    );
  }

  const parse = listSectorsQuerySchema.safeParse(payload ?? {});

  if (!parse.success) {
    return buildApiPayload<SectorListPayload>({
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
    const result = await listSectors(parse.data);

    return buildApiPayload<SectorListPayload>({
      data: { items: result.items },
      message: "Secteurs récupérés",
      meta: {
        pagination: result.pagination satisfies PaginationMeta,
      },
    });
  } catch {
    return buildApiPayload<SectorListPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de récupérer les secteurs.",
        },
      ],
      message: "Erreur interne",
    });
  }
}

export async function createSectorAction(
  payload: unknown,
): Promise<ApiResponse<SectorMutationPayload>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return unauthorizedActionResponse<SectorMutationPayload>(
      adminCheck.message,
      adminCheck.code,
    );
  }

  const parse = createSectorInputSchema.safeParse(payload);

  if (!parse.success) {
    return buildApiPayload<SectorMutationPayload>({
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
    const sector = await createSector(parse.data);

    return buildApiPayload<SectorMutationPayload>({
      data: { sector },
      message: "Secteur créé",
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2002") {
      return buildApiPayload<SectorMutationPayload>({
        errors: [
          {
            code: "CONFLICT",
            source: "name",
            detail: "Un secteur avec ce nom existe déjà dans ce département.",
          },
        ],
        message: "Conflit",
      });
    }

    if (code === "P2003") {
      return buildApiPayload<SectorMutationPayload>({
        errors: [
          {
            code: "CONFLICT",
            source: "departmentId",
            detail: "Le département sélectionné est introuvable.",
          },
        ],
        message: "Conflit",
      });
    }

    return buildApiPayload<SectorMutationPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de créer le secteur.",
        },
      ],
      message: "Erreur interne",
    });
  }
}

export async function updateSectorAction(
  payload: unknown,
): Promise<ApiResponse<SectorMutationPayload>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return unauthorizedActionResponse<SectorMutationPayload>(
      adminCheck.message,
      adminCheck.code,
    );
  }

  const parse = updateSectorActionSchema.safeParse(payload);

  if (!parse.success) {
    return buildApiPayload<SectorMutationPayload>({
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
    const sector = await updateSector(parse.data.id, {
      name: parse.data.name,
      departmentId: parse.data.departmentId,
    });

    return buildApiPayload<SectorMutationPayload>({
      data: { sector },
      message: "Secteur mis à jour",
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return buildApiPayload<SectorMutationPayload>({
        errors: [{ code: "NOT_FOUND", detail: "Secteur introuvable." }],
        message: "Ressource introuvable",
      });
    }

    if (code === "P2002") {
      return buildApiPayload<SectorMutationPayload>({
        errors: [
          {
            code: "CONFLICT",
            source: "name",
            detail: "Un secteur avec ce nom existe déjà dans ce département.",
          },
        ],
        message: "Conflit",
      });
    }

    if (code === "P2003") {
      return buildApiPayload<SectorMutationPayload>({
        errors: [
          {
            code: "CONFLICT",
            source: "departmentId",
            detail: "Le département sélectionné est introuvable.",
          },
        ],
        message: "Conflit",
      });
    }

    return buildApiPayload<SectorMutationPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de mettre à jour le secteur.",
        },
      ],
      message: "Erreur interne",
    });
  }
}

export async function deleteSectorAction(
  payload: unknown,
): Promise<ApiResponse<null>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return unauthorizedActionResponse<null>(
      adminCheck.message,
      adminCheck.code,
    );
  }

  const parse = sectorIdSchema.safeParse(
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
    await deleteSector(parse.data);

    return buildApiPayload<null>({
      data: null,
      errors: null,
      message: "Secteur supprimé",
      meta: null,
    });
  } catch (error) {
    const code = getPrismaErrorCode(error);

    if (code === "P2025") {
      return buildApiPayload<null>({
        errors: [{ code: "NOT_FOUND", detail: "Secteur introuvable." }],
        message: "Ressource introuvable",
      });
    }

    if (code === "P2003") {
      return buildApiPayload<null>({
        errors: [
          {
            code: "CONFLICT",
            detail: "Ce secteur ne peut pas être supprimé car il est utilisé.",
          },
        ],
        message: "Conflit",
      });
    }

    return buildApiPayload<null>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de supprimer le secteur.",
        },
      ],
      message: "Erreur interne",
    });
  }
}
