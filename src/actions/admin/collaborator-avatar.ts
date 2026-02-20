"use server";

import { randomUUID } from "node:crypto";

import sharp from "sharp";
import { z } from "zod";

import { buildApiPayload } from "@/src/lib/api-response";
import { requireAdmin } from "@/src/lib/auth-guards";
import prisma from "@/src/lib/prisma";
import { deleteFile, getFileUrl, uploadFile } from "@/src/lib/storage";
import type { ApiResponse } from "@/src/types/api";
import type { CollaboratorAvatarPayload } from "@/src/types/collaborator";
import { revalidatePath } from "next/cache";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const AVATAR_MAX_DIMENSION_PX = 512;
const AVATAR_WEBP_QUALITY = 82;

function toStorageErrorDetail(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const code =
    typeof (error as { name?: string }).name === "string"
      ? (error as { name?: string }).name
      : undefined;
  const message = error.message?.trim();

  if (code === "ECONNREFUSED") {
    return "Connexion au serveur de stockage impossible (MinIO/S3 indisponible).";
  }

  if (code === "NoSuchBucket") {
    return "Le bucket configuré est introuvable.";
  }

  if (!message) {
    return fallback;
  }

  return `${fallback} (${message})`;
}

const uploadAvatarSchema = z.object({
  collaboratorId: z.coerce.number().int().positive(),
  file: z
    .instanceof(File, { message: "Le fichier avatar est requis." })
    .refine((file) => file.size > 0, {
      message: "Le fichier avatar est vide.",
    })
    .refine((file) => file.size <= MAX_FILE_SIZE_BYTES, {
      message: "L'image ne doit pas dépasser 5MB.",
    })
    .refine((file) => ALLOWED_IMAGE_TYPES.includes(file.type as never), {
      message: "Format d'image non supporté (jpeg, png, webp, gif).",
    }),
});

const deleteAvatarSchema = z.object({
  collaboratorId: z.coerce.number().int().positive(),
});

function buildObjectKey(collaboratorId: number) {
  return `avatars/collaborators/${collaboratorId}/${randomUUID()}.webp`;
}

async function optimizeAvatarImage(inputBuffer: Buffer): Promise<Buffer> {
  return sharp(inputBuffer)
    .rotate()
    .resize(AVATAR_MAX_DIMENSION_PX, AVATAR_MAX_DIMENSION_PX, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: AVATAR_WEBP_QUALITY,
      effort: 4,
      smartSubsample: true,
    })
    .toBuffer();
}

export async function uploadCollaboratorAvatarAction(
  formData: FormData,
): Promise<ApiResponse<CollaboratorAvatarPayload>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return buildApiPayload<CollaboratorAvatarPayload>({
      errors: [{ code: adminCheck.code, detail: adminCheck.message }],
      message:
        adminCheck.code === "UNAUTHORIZED"
          ? "Accès non autorisé"
          : "Accès interdit",
    });
  }

  const parse = uploadAvatarSchema.safeParse({
    collaboratorId: formData.get("collaboratorId"),
    file: formData.get("file"),
  });

  if (!parse.success) {
    return buildApiPayload<CollaboratorAvatarPayload>({
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

  const { collaboratorId, file } = parse.data;

  const existing = await prisma.member.findUnique({
    where: { id: collaboratorId },
    select: {
      id: true,
      avatarKey: true,
    },
  });

  if (!existing) {
    return buildApiPayload<CollaboratorAvatarPayload>({
      errors: [{ code: "NOT_FOUND", detail: "Collaborateur introuvable." }],
      message: "Ressource introuvable",
    });
  }

  const newAvatarKey = buildObjectKey(collaboratorId);
  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  let optimizedBuffer: Buffer;

  try {
    optimizedBuffer = await optimizeAvatarImage(sourceBuffer);
  } catch {
    return buildApiPayload<CollaboratorAvatarPayload>({
      errors: [
        {
          code: "BAD_REQUEST",
          detail: "Impossible de traiter l'image envoyée.",
        },
      ],
      message: "Image invalide",
    });
  }

  try {
    await uploadFile(optimizedBuffer, newAvatarKey, "image/webp");
  } catch (error) {
    // Log the full error for debugging on the server (temporary)
    try {
      console.error("[Avatar Upload] uploadFile error:", error);
    } catch (e) {
      // ignore logging errors
      console.error("[Avatar Upload] Failed to log error:", e);
    }
    return buildApiPayload<CollaboratorAvatarPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: toStorageErrorDetail(
            error,
            "Impossible de téléverser l'avatar.",
          ),
        },
      ],
      message: "Erreur interne",
    });
  }

  try {
    await prisma.member.update({
      where: { id: collaboratorId },
      data: {
        avatarKey: newAvatarKey,
        avatarUrl: null,
      },
    });
  } catch {
    try {
      await deleteFile(newAvatarKey);
    } catch {
      // noop
    }

    return buildApiPayload<CollaboratorAvatarPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de sauvegarder l'avatar du collaborateur.",
        },
      ],
      message: "Erreur interne",
    });
  }

  if (existing.avatarKey && existing.avatarKey !== newAvatarKey) {
    try {
      await deleteFile(existing.avatarKey);
    } catch {
      // noop
    }
  }

  revalidatePath("/admin/collaborators");
  revalidatePath("/trombinoscope");
  revalidatePath("/organigram");
  revalidatePath(`/collaborator/${collaboratorId}`);

  return buildApiPayload<CollaboratorAvatarPayload>({
    data: {
      collaboratorId,
      avatarKey: newAvatarKey,
      avatarUrl: await getFileUrl(newAvatarKey),
    },
    message: "Avatar mis à jour",
  });
}

export async function deleteCollaboratorAvatarAction(
  formData: FormData,
): Promise<ApiResponse<CollaboratorAvatarPayload>> {
  const adminCheck = await requireAdmin();

  if (!adminCheck.ok) {
    return buildApiPayload<CollaboratorAvatarPayload>({
      errors: [{ code: adminCheck.code, detail: adminCheck.message }],
      message:
        adminCheck.code === "UNAUTHORIZED"
          ? "Accès non autorisé"
          : "Accès interdit",
    });
  }

  const parse = deleteAvatarSchema.safeParse({
    collaboratorId: formData.get("collaboratorId"),
  });

  if (!parse.success) {
    return buildApiPayload<CollaboratorAvatarPayload>({
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

  const { collaboratorId } = parse.data;

  const existing = await prisma.member.findUnique({
    where: { id: collaboratorId },
    select: {
      id: true,
      avatarKey: true,
    },
  });

  if (!existing) {
    return buildApiPayload<CollaboratorAvatarPayload>({
      errors: [{ code: "NOT_FOUND", detail: "Collaborateur introuvable." }],
      message: "Ressource introuvable",
    });
  }

  if (existing.avatarKey) {
    try {
      await deleteFile(existing.avatarKey);
    } catch (error) {
      return buildApiPayload<CollaboratorAvatarPayload>({
        errors: [
          {
            code: "INTERNAL_ERROR",
            detail: toStorageErrorDetail(
              error,
              "Impossible de supprimer l'avatar du stockage.",
            ),
          },
        ],
        message: "Erreur interne",
      });
    }
  }

  try {
    await prisma.member.update({
      where: { id: collaboratorId },
      data: {
        avatarKey: null,
        avatarUrl: null,
      },
    });
  } catch {
    return buildApiPayload<CollaboratorAvatarPayload>({
      errors: [
        {
          code: "INTERNAL_ERROR",
          detail: "Impossible de mettre à jour le collaborateur.",
        },
      ],
      message: "Erreur interne",
    });
  }

  revalidatePath("/admin/collaborators");
  revalidatePath("/trombinoscope");
  revalidatePath("/organigram");
  revalidatePath(`/collaborator/${collaboratorId}`);

  return buildApiPayload<CollaboratorAvatarPayload>({
    data: {
      collaboratorId,
      avatarKey: null,
      avatarUrl: null,
    },
    message: "Avatar supprimé",
  });
}
