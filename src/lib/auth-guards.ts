import "server-only";

import { getSession, getUserRole } from "@/src/lib/auth-server";

type SessionValue = Awaited<ReturnType<typeof getSession>>;
type AuthenticatedSession = NonNullable<SessionValue>;

type GuardFailureCode = "UNAUTHORIZED" | "FORBIDDEN";

type GuardSuccess = {
  ok: true;
  session: AuthenticatedSession;
};

type GuardFailure = {
  ok: false;
  code: GuardFailureCode;
  message: string;
};

export type SessionGuardResult = GuardSuccess | GuardFailure;

export async function requireSession(): Promise<SessionGuardResult> {
  const session = await getSession();

  if (!session) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Authentification requise.",
    };
  }

  return { ok: true, session };
}

export async function requireAdmin(): Promise<SessionGuardResult> {
  const sessionCheck = await requireSession();

  if (!sessionCheck.ok) {
    return sessionCheck;
  }

  const role = await getUserRole();

  if (role !== "admin") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Droits administrateur requis.",
    };
  }

  return sessionCheck;
}
