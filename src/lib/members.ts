import "server-only";

import prisma from "@/src/lib/prisma";
import { getFileUrl } from "@/src/lib/storage";
import type { ResolvedMember } from "@/src/types/member";

type ChronologicalOrder = "desc" | "asc";

type MemberRow = {
  id: number;
  serviceCode: string;
  firstname: string;
  lastname: string;
  gender: string;
  avatarKey: string | null;
  avatarUrl: string | null;
  professionalEmail: string;
  phone: string | null;
  startDate: Date;
  endDate: Date | null;
  location?: { name: string } | null;
  status: string;
  isReferentRH: boolean;
  positionId: number | null;
};

type PositionRow = {
  id: number;
  name: string;
  type: string;
  sectorId: number | null;
  parentPositionId: number | null;
  lastMobility?: Date | null;
  sector: {
    id: number;
    name: string;
    departmentId: number;
    department: {
      id: number;
      name: string;
    };
  } | null;
};

type ResolvedRow = {
  member: MemberRow | null;
  position: PositionRow | null;
};

const resolveAvatarUrl = async (
  avatarKey: string | null | undefined,
  avatarUrl: string | null,
) => {
  if (!avatarKey) {
    return avatarUrl;
  }

  try {
    return await getFileUrl(avatarKey);
  } catch {
    return avatarUrl;
  }
};

async function toResolvedMember(
  row: ResolvedRow,
): Promise<ResolvedMember | null> {
  if (!row || !row.member) {
    return null;
  }

  const position = row.position;
  const sector = position?.sector;
  const department = sector?.department;

  const safePositionId =
    typeof row.member.positionId === "number"
      ? row.member.positionId
      : (position?.id ?? 0);

  const safePosition: ResolvedMember["position"] = {
    id: position?.id ?? 0,
    name: position?.name ?? "Poste non assigné",
    type: position?.type ?? "COLLABORATEUR",
    sectorId: position?.sectorId ?? 0,
    parentPositionId: position?.parentPositionId ?? null,
    lastMobility: position?.lastMobility
      ? new Date(position.lastMobility).toISOString()
      : null,
  };

  const safeSector: ResolvedMember["sector"] = {
    id: sector?.id ?? 0,
    name: sector?.name ?? "Secteur non assigné",
    departmentId: sector?.departmentId ?? 0,
  };

  const safeDepartment: ResolvedMember["department"] = {
    id: department?.id ?? 0,
    name: department?.name ?? "Département non assigné",
  };

  return {
    member: {
      id: Number(row.member.id),
      serviceCode: String(row.member.serviceCode),
      firstname: String(row.member.firstname),
      lastname: String(row.member.lastname),
      gender: String(row.member.gender),
      avatarUrl: await resolveAvatarUrl(
        row.member.avatarKey,
        row.member.avatarUrl,
      ),
      professionalEmail: String(row.member.professionalEmail),
      phone: String(row.member.phone ?? ""),
      startDate: new Date(row.member.startDate).toISOString(),
      endDate: row.member.endDate
        ? new Date(row.member.endDate).toISOString()
        : null,
      locationName: row.member.location?.name ?? null,
      status: String(row.member.status),
      isReferentRH: Boolean(row.member.isReferentRH),
      positionId: safePositionId,
    },
    position: safePosition,
    sector: safeSector,
    department: safeDepartment,
  };
}

export async function fetchLatestMembers(
  limit = 10,
  order: ChronologicalOrder = "desc",
): Promise<ResolvedMember[]> {
  const members = await prisma.member.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      position: {
        include: {
          sector: { include: { department: true } },
        },
      },
      location: true,
    },
  });

  const resolved = (
    await Promise.all(
      members.map((m) => toResolvedMember({ member: m, position: m.position })),
    )
  ).filter((v): v is ResolvedMember => v !== null);

  return order === "asc" ? [...resolved].reverse() : resolved;
}

export async function fetchLatestMobilityMembers(
  limit = 10,
  order: ChronologicalOrder = "desc",
): Promise<ResolvedMember[]> {
  const positions = await prisma.position.findMany({
    where: { lastMobility: { not: null }, member: { isNot: null } },
    orderBy: { lastMobility: "desc" },
    take: limit,
    include: {
      member: { include: { location: true } },
      sector: { include: { department: true } },
      // include member location through member relation is handled by mapping
    },
  });

  const resolved = (
    await Promise.all(
      positions.map((p) => toResolvedMember({ member: p.member, position: p })),
    )
  ).filter((v): v is ResolvedMember => v !== null);

  return order === "asc" ? [...resolved].reverse() : resolved;
}
