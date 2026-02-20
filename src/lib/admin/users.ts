import "server-only";

import { z } from "zod";

import { getUser, getUserRole } from "@/src/lib/auth-server";
import prisma from "@/src/lib/prisma";

export type AdminUserRole = "admin" | "user";

export type AdminUserListItem = {
  id: string;
  fullName: string;
  email: string;
  role: AdminUserRole;
  isDisabled: boolean;
};

const usersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(["all", "admin", "user"]).default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(1000).default(10),
});

function normalizeRole(role: string | null | undefined): AdminUserRole {
  return role?.toLowerCase() === "admin" ? "admin" : "user";
}

export async function listUsersForAdmin(rawQuery: unknown) {
  const user = await getUser();
  const role = await getUserRole();

  if (!user || role !== "admin") {
    throw new Error("UNAUTHORIZED");
  }

  const query = usersQuerySchema.parse(rawQuery);
  const searchValue = query.q?.trim() ?? "";
  const skip = (query.page - 1) * query.pageSize;

  const where = {
    ...(query.role !== "all" ? { role: query.role } : {}),
    ...(searchValue
      ? {
          OR: [
            {
              name: {
                contains: searchValue,
              },
            },
            {
              email: {
                contains: searchValue,
              },
            },
          ],
        }
      : {}),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        banned: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

  return {
    users: users.map<AdminUserListItem>((item) => ({
      id: item.id,
      fullName: item.name,
      email: item.email,
      role: normalizeRole(item.role),
      isDisabled: Boolean(item.banned),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages,
    searchValue,
    roleFilter: query.role,
  };
}
