import "server-only";

import prisma from "@/src/lib/prisma";
import { getFileUrl } from "@/src/lib/storage";
import type {
  OrganigramDepartmentDto,
  OrganigramNodeDto,
  OrganigramPayload,
  OrganigramSectorDto,
} from "@/src/types/organigram";

type OrganigramQuery = {
  departmentId?: number;
  sectorIds?: number[];
};

type DepartmentModelDelegate = {
  findMany: (args: unknown) => Promise<Array<{ id: number; name: string }>>;
};

type SectorModelDelegate = {
  findMany: (
    args: unknown,
  ) => Promise<Array<{ id: number; name: string; departmentId: number }>>;
};

type PositionModelDelegate = {
  findMany: (args: unknown) => Promise<
    Array<{
      id: number;
      name: string;
      type:
        | "DIRECTEUR"
        | "SOUS_DIRECTEUR"
        | "CHEF_SERVICE"
        | "RESPONSABLE"
        | "COLLABORATEUR"
        | "ASSISTANT";
      parentPositionId: number | null;
      sectorId: number | null;
      sector: {
        id: number;
        name: string;
        department: { id: number; name: string };
      } | null;
      department: { id: number; name: string } | null;
      member: {
        id: number;
        serviceCode: string;
        firstname: string;
        lastname: string;
        gender: "HOMME" | "FEMME" | "AUTRE";
        birthday: Date | null;
        isReferentRH: boolean;
        professionalEmail: string;
        phone: string | null;
        startDate: Date;
        endDate: Date | null;
        avatarKey: string | null;
        avatarUrl: string | null;
        location: {
          name: string;
        } | null;
      } | null;
      memberAssignments?: Array<{
        member: {
          id: number;
          serviceCode: string;
          firstname: string;
          lastname: string;
          gender: "HOMME" | "FEMME" | "AUTRE";
          birthday: Date | null;
          isReferentRH: boolean;
          professionalEmail: string;
          phone: string | null;
          startDate: Date;
          endDate: Date | null;
          avatarKey: string | null;
          avatarUrl: string | null;
          location: {
            name: string;
          } | null;
        };
      }>;
    }>
  >;
};

const departmentModel = (
  prisma as unknown as { department?: DepartmentModelDelegate }
).department;
const sectorModel = (prisma as unknown as { sector?: SectorModelDelegate })
  .sector;
const positionModel = (
  prisma as unknown as { position?: PositionModelDelegate }
).position;

let supportsDepartmentScopeInOrganigramOrmCache: boolean | null = null;

const supportsDepartmentScopeInOrganigramOrm = async (
  model?: PositionModelDelegate,
) => {
  if (!model) {
    return false;
  }

  if (supportsDepartmentScopeInOrganigramOrmCache !== null) {
    return supportsDepartmentScopeInOrganigramOrmCache;
  }

  try {
    await model.findMany({
      take: 1,
      select: {
        id: true,
        departmentId: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    supportsDepartmentScopeInOrganigramOrmCache = true;
    return true;
  } catch {
    supportsDepartmentScopeInOrganigramOrmCache = false;
    return false;
  }
};

const mapDepartments = (
  rows: Array<{ id: number; name: string }>,
): OrganigramDepartmentDto[] =>
  rows.map((row) => ({ id: row.id, name: row.name }));

const mapSectors = (
  rows: Array<{ id: number; name: string; departmentId: number }>,
): OrganigramSectorDto[] =>
  rows.map((row) => ({
    id: row.id,
    name: row.name,
    departmentId: row.departmentId,
  }));

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

const filterNodesBySectorsKeepingAncestors = (
  nodes: OrganigramNodeDto[],
  selectedSectorIds: number[],
) => {
  if (selectedSectorIds.length === 0) {
    return nodes;
  }

  const selectedSectorIdsSet = new Set(selectedSectorIds);
  const nodeById = new Map<number, OrganigramNodeDto>();
  nodes.forEach((node) => nodeById.set(node.id, node));

  const allowedIds = new Set<number>();

  nodes.forEach((node) => {
    if (
      (node.positionType === "DIRECTEUR" && node.sectorId === null) ||
      (node.sectorId !== null && selectedSectorIdsSet.has(node.sectorId))
    ) {
      allowedIds.add(node.id);
    }
  });

  const addAncestors = (nodeId: number) => {
    let current = nodeById.get(nodeId);
    while (current?.pid) {
      if (!allowedIds.has(current.pid)) {
        allowedIds.add(current.pid);
      }
      current = nodeById.get(current.pid);
    }
  };

  Array.from(allowedIds).forEach(addAncestors);

  nodes.forEach((node) => {
    if (
      node.tags?.includes("assistant") &&
      node.pid &&
      allowedIds.has(node.pid) &&
      (node.sectorId === null || selectedSectorIdsSet.has(node.sectorId))
    ) {
      allowedIds.add(node.id);
    }
  });

  return nodes.filter((node) => {
    if (!allowedIds.has(node.id)) {
      return false;
    }

    if (node.positionType === "DIRECTEUR" && node.sectorId === null) {
      return true;
    }

    if (node.sectorId === null) {
      return true;
    }

    return selectedSectorIdsSet.has(node.sectorId);
  });
};

export async function getOrganigramData(
  query: OrganigramQuery = {},
): Promise<OrganigramPayload> {
  const { departmentId, sectorIds = [] } = query;

  if (departmentModel && sectorModel && positionModel) {
    const hasDepartmentScope =
      await supportsDepartmentScopeInOrganigramOrm(positionModel);

    const positionWhere: Record<string, unknown> = {};

    if (departmentId) {
      if (hasDepartmentScope) {
        positionWhere.OR = [{ departmentId }, { sector: { departmentId } }];
      } else {
        positionWhere.sector = { departmentId };
      }
    }

    const sectorWhere = departmentId ? { departmentId } : undefined;
    const positionSelect: Record<string, unknown> = {
      id: true,
      name: true,
      type: true,
      parentPositionId: true,
      sectorId: true,
      sector: {
        select: {
          id: true,
          name: true,
          department: {
            select: { id: true, name: true },
          },
        },
      },
      member: {
        select: {
          id: true,
          serviceCode: true,
          firstname: true,
          lastname: true,
          gender: true,
          birthday: true,
          isReferentRH: true,
          professionalEmail: true,
          phone: true,
          startDate: true,
          endDate: true,
          avatarKey: true,
          avatarUrl: true,
          location: {
            select: {
              name: true,
            },
          },
        },
      },
      memberAssignments: {
        take: 1,
        select: {
          member: {
            select: {
              id: true,
              serviceCode: true,
              firstname: true,
              lastname: true,
              gender: true,
              birthday: true,
              isReferentRH: true,
              professionalEmail: true,
              phone: true,
              startDate: true,
              endDate: true,
              avatarKey: true,
              avatarUrl: true,
              location: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    };

    if (hasDepartmentScope) {
      positionSelect.departmentId = true;
      positionSelect.department = {
        select: {
          id: true,
          name: true,
        },
      };
    }

    const [departmentsRows, sectorsRows, positionsRows] = await Promise.all([
      departmentModel.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      sectorModel.findMany({
        where: sectorWhere,
        select: { id: true, name: true, departmentId: true },
        orderBy: { name: "asc" },
      }),
      positionModel.findMany({
        where: positionWhere,
        select: positionSelect,
        orderBy: { id: "asc" },
      }),
    ]);

    const departments = mapDepartments(departmentsRows);
    const sectors = mapSectors(sectorsRows);

    const nodesUnfiltered: OrganigramNodeDto[] = await Promise.all(
      positionsRows.map(async (position) => {
        const departmentFromPosition =
          (position as { department?: { id: number; name: string } | null })
            .department ?? null;
        const isDepartmentDirector = position.type === "DIRECTEUR";

        const member =
          position.memberAssignments?.[0]?.member ?? position.member ?? null;
        const memberAvatarUrl = member
          ? await resolveAvatarUrl(member.avatarKey, member.avatarUrl)
          : null;

        return {
          id: position.id,
          pid: position.parentPositionId ?? undefined,
          positionType: position.type,
          name: member
            ? `${member.firstname} ${member.lastname}`
            : "Poste vacant",
          title: position.name,
          img: memberAvatarUrl ?? undefined,
          tags: position.type === "ASSISTANT" ? ["assistant"] : undefined,
          department:
            departmentFromPosition?.name ??
            position.sector?.department.name ??
            "Département non assigné",
          sector: isDepartmentDirector
            ? "Tous les secteurs"
            : (position.sector?.name ?? "Tous les secteurs"),
          departmentId:
            departmentFromPosition?.id ?? position.sector?.department.id ?? 0,
          sectorId: isDepartmentDirector ? null : position.sectorId,
          isVacant: member === null,
          memberId: member?.id,
          serviceCode: member?.serviceCode,
          firstname: member?.firstname,
          lastname: member?.lastname,
          gender: member?.gender,
          birthday: member?.birthday?.toISOString(),
          isReferentRH: member?.isReferentRH,
          professionalEmail: member?.professionalEmail,
          phone: member?.phone ?? undefined,
          locationName: member?.location?.name,
          startDate: member?.startDate?.toISOString(),
          endDate: member?.endDate?.toISOString(),
          avatarUrl: memberAvatarUrl ?? undefined,
          detailsUrl: member?.id
            ? `/trombinoscope?memberId=${member.id}`
            : undefined,
        };
      }),
    );

    const nodes = filterNodesBySectorsKeepingAncestors(
      nodesUnfiltered,
      sectorIds,
    );

    return {
      departments,
      sectors,
      nodes,
    };
  }

  const departmentsRows = (await prisma.$queryRaw`
    SELECT d.id, d.name
    FROM department d
    ORDER BY d.name ASC
  `) as Array<{ id: number; name: string }>;

  const sectorsRows = departmentId
    ? ((await prisma.$queryRaw`
        SELECT s.id, s.name, s.departmentId
        FROM sector s
        WHERE s.departmentId = ${departmentId}
        ORDER BY s.name ASC
      `) as Array<{ id: number; name: string; departmentId: number }>)
    : ((await prisma.$queryRaw`
        SELECT s.id, s.name, s.departmentId
        FROM sector s
        ORDER BY s.name ASC
      `) as Array<{ id: number; name: string; departmentId: number }>);

  const departmentFilterClause = departmentId
    ? "WHERE COALESCE(p.departmentId, s.departmentId) = ?"
    : "";
  const departmentFilterParams: unknown[] = departmentId ? [departmentId] : [];

  const positionsRows = (await prisma.$queryRawUnsafe(
    `SELECT
      p.id,
      p.name,
      p.type,
      p.parentPositionId,
      p.sectorId,
      s.name AS sectorName,
      COALESCE(p.departmentId, s.departmentId) AS departmentId,
      d.name AS departmentName,
      COALESCE(ma.id, ml.id) AS memberId,
      COALESCE(ma.serviceCode, ml.serviceCode) AS serviceCode,
      COALESCE(ma.firstname, ml.firstname) AS firstname,
      COALESCE(ma.lastname, ml.lastname) AS lastname,
      COALESCE(ma.gender, ml.gender) AS gender,
      COALESCE(ma.birthday, ml.birthday) AS birthday,
      COALESCE(ma.isReferentRH, ml.isReferentRH) AS isReferentRH,
      COALESCE(ma.professionalEmail, ml.professionalEmail) AS professionalEmail,
      COALESCE(ma.phone, ml.phone) AS phone,
      COALESCE(ma.startDate, ml.startDate) AS startDate,
      COALESCE(ma.endDate, ml.endDate) AS endDate,
      COALESCE(ma.avatarKey, ml.avatarKey) AS avatarKey,
      COALESCE(ma.avatarUrl, ml.avatarUrl) AS avatarUrl,
      l.name AS locationName
    FROM \`position\` p
    LEFT JOIN sector s ON s.id = p.sectorId
    INNER JOIN department d ON d.id = COALESCE(p.departmentId, s.departmentId)
    LEFT JOIN member_position_assignment mpa ON mpa.positionId = p.id
    LEFT JOIN member ma ON ma.id = mpa.memberId
    LEFT JOIN member ml ON ml.positionId = p.id
    LEFT JOIN location l ON l.id = COALESCE(ma.locationId, ml.locationId)
    ${departmentFilterClause}
    ORDER BY p.id ASC`,
    ...departmentFilterParams,
  )) as Array<{
    id: number;
    name: string;
    type:
      | "DIRECTEUR"
      | "SOUS_DIRECTEUR"
      | "CHEF_SERVICE"
      | "RESPONSABLE"
      | "COLLABORATEUR"
      | "ASSISTANT";
    parentPositionId: number | null;
    sectorId: number | null;
    sectorName: string | null;
    departmentId: number;
    departmentName: string;
    memberId: number | null;
    serviceCode: string | null;
    firstname: string | null;
    lastname: string | null;
    gender: "HOMME" | "FEMME" | "AUTRE" | null;
    birthday: Date | null;
    isReferentRH: boolean | null;
    professionalEmail: string | null;
    phone: string | null;
    startDate: Date | null;
    endDate: Date | null;
    avatarKey: string | null;
    avatarUrl: string | null;
    locationName: string | null;
  }>;

  const nodesUnfiltered: OrganigramNodeDto[] = await Promise.all(
    positionsRows.map(async (position) => {
      const isDepartmentDirector = position.type === "DIRECTEUR";
      const avatarUrl = await resolveAvatarUrl(
        position.avatarKey,
        position.avatarUrl,
      );

      return {
        id: position.id,
        pid: position.parentPositionId ?? undefined,
        positionType: position.type,
        name:
          position.memberId && position.firstname && position.lastname
            ? `${position.firstname} ${position.lastname}`
            : "Poste vacant",
        title: position.name,
        img: avatarUrl ?? undefined,
        tags: position.type === "ASSISTANT" ? ["assistant"] : undefined,
        department: position.departmentName,
        sector: isDepartmentDirector
          ? "Tous les secteurs"
          : (position.sectorName ?? "Tous les secteurs"),
        departmentId: position.departmentId,
        sectorId: isDepartmentDirector ? null : position.sectorId,
        isVacant: position.memberId === null,
        memberId: position.memberId ?? undefined,
        serviceCode: position.serviceCode ?? undefined,
        firstname: position.firstname ?? undefined,
        lastname: position.lastname ?? undefined,
        gender: position.gender ?? undefined,
        birthday: position.birthday?.toISOString(),
        isReferentRH: position.isReferentRH ?? undefined,
        professionalEmail: position.professionalEmail ?? undefined,
        phone: position.phone ?? undefined,
        locationName: position.locationName ?? undefined,
        startDate: position.startDate?.toISOString(),
        endDate: position.endDate?.toISOString(),
        avatarUrl: avatarUrl ?? undefined,
        detailsUrl: position.memberId
          ? `/trombinoscope?memberId=${position.memberId}`
          : undefined,
      };
    }),
  );

  const nodes = filterNodesBySectorsKeepingAncestors(
    nodesUnfiltered,
    sectorIds,
  );

  return {
    departments: mapDepartments(departmentsRows),
    sectors: mapSectors(sectorsRows),
    nodes,
  };
}
