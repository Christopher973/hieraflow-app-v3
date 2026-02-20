import { headers } from "next/headers";
import { auth } from "./auth";

export const getSession = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session;
};

export const getUser = async () => {
  const session = await getSession();
  return session?.user;
};

function normalizeRole(role: string | null | undefined): "user" | "admin" {
  const normalized = role?.toLowerCase();
  if (normalized === "user" || normalized === "admin") {
    return normalized;
  }
  return "user";
}

export const getUserRole = async () => {
  const user = await getUser();
  return normalizeRole(user?.role);
};
