"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/src/lib/auth";
import { getUser, getUserRole } from "@/src/lib/auth-server";

const disableUserSchema = z.object({
  userId: z.string().min(1, "L'identifiant utilisateur est requis."),
});

const setUserRoleSchema = z.object({
  userId: z.string().min(1, "L'identifiant utilisateur est requis."),
  role: z.enum(["admin", "user"], {
    message: "Le rôle est invalide.",
  }),
});

async function ensureAdminUser() {
  const [user, role] = await Promise.all([getUser(), getUserRole()]);

  if (!user || role !== "admin") {
    return null;
  }

  return user;
}

function hasAuthApiError(result: unknown): boolean {
  if (!result || typeof result !== "object") {
    return false;
  }

  return "error" in result && Boolean((result as { error?: unknown }).error);
}

export async function disableUserAction(payload: unknown) {
  const parsed = disableUserSchema.safeParse(payload);

  if (!parsed.success) {
    return { success: false, message: "Paramètres invalides." };
  }

  const adminUser = await ensureAdminUser();

  if (!adminUser) {
    return { success: false, message: "Accès non autorisé." };
  }

  if (adminUser.id === parsed.data.userId) {
    return {
      success: false,
      message: "Vous ne pouvez pas vous désactiver vous-même.",
    };
  }

  const result = await auth.api.banUser({
    headers: await headers(),
    body: {
      userId: parsed.data.userId,
      banReason: "ACCOUNT_DISABLED",
    },
  });

  if (hasAuthApiError(result)) {
    return {
      success: false,
      message: "Impossible de désactiver cet utilisateur.",
    };
  }

  return { success: true };
}

export async function setUserRoleAction(payload: unknown) {
  const parsed = setUserRoleSchema.safeParse(payload);

  if (!parsed.success) {
    return { success: false, message: "Paramètres invalides." };
  }

  const adminUser = await ensureAdminUser();

  if (!adminUser) {
    return { success: false, message: "Accès non autorisé." };
  }

  if (adminUser.id === parsed.data.userId) {
    return {
      success: false,
      message: "Vous ne pouvez pas modifier votre propre rôle.",
    };
  }

  const result = await auth.api.setRole({
    headers: await headers(),
    body: {
      userId: parsed.data.userId,
      role: parsed.data.role,
    },
  });

  if (hasAuthApiError(result)) {
    return {
      success: false,
      message: "Impossible de modifier le rôle de cet utilisateur.",
    };
  }

  return { success: true };
}
