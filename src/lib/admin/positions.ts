import { prisma } from "@/src/lib/prisma";
import type { PositionDto, PositionListQuery } from "@/src/types/position";
import { Prisma } from "@/prisma/src/generated/prisma/client";

/**
 * Extrait le code d'erreur Prisma (P2002, P2003, P2025, etc.) d'une erreur.
 */
export const getPrismaErrorCode = (error: unknown): string | null => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
};

/**
 * Delegate Prisma pour le modèle Position.
 * Peut être indisponible à l'exécution selon la configuration du schéma.
 */
type PositionModelDelegate = {
  findMany: (args: Prisma.PositionFindManyArgs) => Promise<unknown[]>;
  findUnique: (args: Prisma.PositionFindUniqueArgs) => Promise<unknown | null>;
  create: (args: Prisma.PositionCreateArgs) => Promise<unknown>;
  update: (args: Prisma.PositionUpdateArgs) => Promise<unknown>;
  delete: (args: Prisma.PositionDeleteArgs) => Promise<unknown>;
  count: (args?: Prisma.PositionCountArgs) => Promise<number>;
};

/**
 * Helper pour lancer une erreur Prisma-like (avec code P*).
 * Utilisé dans les fallbacks SQL pour maintenir la cohérence des erreurs.
 */
function throwPrismaLikeError(code: string, message: string): never {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  throw error;
}

function normalizeJobDetails(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.filter(
    (item): item is string => typeof item === "string",
  );
  return items.length > 0 ? items : [];
}

const ALL_SECTORS_LABEL = "Tous les secteurs";

const isDepartmentDirector = (type: string) => type === "DIRECTEUR";

let supportsDepartmentScopeInOrmCache: boolean | null = null;

async function supportsDepartmentScopedPositionsInOrm(
  positionModel?: PositionModelDelegate,
): Promise<boolean> {
  if (!positionModel) {
    return false;
  }

  if (supportsDepartmentScopeInOrmCache !== null) {
    return supportsDepartmentScopeInOrmCache;
  }

  try {
    await positionModel.findMany({
      take: 1,
      select: {
        id: true,
        scope: true,
        departmentId: true,
      },
    } as Prisma.PositionFindManyArgs);

    supportsDepartmentScopeInOrmCache = true;
    return true;
  } catch {
    supportsDepartmentScopeInOrmCache = false;
    return false;
  }
}

async function resolveSectorIdFromDepartment(
  departmentId?: number,
): Promise<number | null> {
  if (!departmentId) {
    return null;
  }

  const sector = await prisma.sector.findFirst({
    where: { departmentId },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  return sector?.id ?? null;
}

async function resolveDepartmentIdFromSector(
  sectorId?: number | null,
): Promise<number | null> {
  if (!sectorId) {
    return null;
  }

  const sector = await prisma.sector.findUnique({
    where: { id: sectorId },
    select: { departmentId: true },
  });

  return sector?.departmentId ?? null;
}

/**
 * Mappe une ligne de résultat SQL brut vers un PositionDto.
 */
function mapPosition(row: {
  id: number;
  name: string;
  type: string;
  scope: string;
  isPrimary: number | boolean;
  jobDetails: string | null;
  sectorId: number | null;
  sectorName: string | null;
  departmentId: number;
  departmentName: string;
  parentPositionId: number | null;
  parentPositionName: string | null;
  memberName: string | null;
  memberAvatar: string | null;
  childrenCount: number | bigint;
  lastMobility: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): PositionDto {
  const departmentDirector = isDepartmentDirector(row.type);

  const parsedJobDetails = (() => {
    if (!row.jobDetails) {
      return null;
    }

    try {
      return normalizeJobDetails(JSON.parse(row.jobDetails));
    } catch {
      return null;
    }
  })();

  return {
    id: row.id,
    name: row.name,
    type: row.type as PositionDto["type"],
    isPrimary: Boolean(row.isPrimary),
    jobDetails: parsedJobDetails,
    sectorId: departmentDirector ? null : row.sectorId,
    departmentId: row.departmentId,
    sectorName: departmentDirector
      ? ALL_SECTORS_LABEL
      : (row.sectorName ?? ALL_SECTORS_LABEL),
    departmentName: row.departmentName,
    parentPositionId: row.parentPositionId,
    parentPositionName: row.parentPositionName,
    memberName: row.memberName,
    memberAvatar: row.memberAvatar,
    childrenCount: Number(row.childrenCount),
    lastMobility: row.lastMobility
      ? new Date(row.lastMobility).toISOString()
      : null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/**
 * Liste les postes avec filtres et pagination.
 *
 * @param query - Paramètres de requête validés par Zod
 * @returns Liste des postes et métadonnées de pagination
 */
export async function listPositions(query: PositionListQuery): Promise<{
  positions: PositionDto[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const {
    q,
    sectorId,
    departmentId,
    type,
    vacantOnly,
    page = 1,
    pageSize = 10,
  } = query;

  const offset = (page - 1) * pageSize;

  const positionModel = (
    prisma as unknown as { position?: PositionModelDelegate }
  ).position;

  const hasDepartmentScope =
    await supportsDepartmentScopedPositionsInOrm(positionModel);

  if (positionModel && !hasDepartmentScope) {
    const where: Prisma.PositionWhereInput = {};

    if (q) {
      where.name = { contains: q };
    }

    if (sectorId) {
      where.sectorId = sectorId;
    }

    if (departmentId) {
      where.sector = { departmentId };
    }

    if (type) {
      where.type = type;
    }

    if (vacantOnly) {
      where.memberAssignments = { none: {} };
    }

    const [positions, total] = await Promise.all([
      positionModel.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          isPrimary: true,
          jobDetails: true,
          sectorId: true,
          sector: {
            select: {
              id: true,
              name: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          parentPositionId: true,
          parentPosition: {
            select: {
              name: true,
            },
          },
          memberAssignments: {
            take: 1,
            orderBy: { isPrimary: "desc" },
            select: {
              member: {
                select: {
                  firstname: true,
                  lastname: true,
                  avatarUrl: true,
                },
              },
            },
          },
          _count: {
            select: {
              childPositions: true,
            },
          },
          lastMobility: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: "asc" },
        skip: offset,
        take: pageSize,
      }),
      positionModel.count({ where }),
    ]);

    const positionsDto: PositionDto[] = (
      positions as Array<{
        id: number;
        name: string;
        type: string;
        isPrimary: boolean;
        jobDetails: unknown;
        sectorId: number;
        sector: {
          id: number;
          name: string;
          department: { id: number; name: string };
        };
        parentPositionId: number | null;
        parentPosition: { name: string } | null;
        memberAssignments: Array<{
          member: {
            firstname: string;
            lastname: string;
            avatarUrl: string | null;
          };
        }>;
        _count: { childPositions: number };
        lastMobility: Date | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    ).map((p) => {
      const departmentDirector = isDepartmentDirector(p.type);

      return {
        id: p.id,
        name: p.name,
        type: p.type as PositionDto["type"],
        isPrimary: p.isPrimary,
        jobDetails: normalizeJobDetails(p.jobDetails),
        sectorId: departmentDirector ? null : p.sectorId,
        departmentId: p.sector.department.id,
        sectorName: departmentDirector ? ALL_SECTORS_LABEL : p.sector.name,
        departmentName: p.sector.department.name,
        parentPositionId: p.parentPositionId,
        parentPositionName: p.parentPosition?.name ?? null,
        memberName: p.memberAssignments[0]?.member
          ? `${p.memberAssignments[0].member.firstname} ${p.memberAssignments[0].member.lastname}`
          : null,
        memberAvatar: p.memberAssignments[0]?.member.avatarUrl ?? null,
        childrenCount: p._count.childPositions,
        lastMobility: p.lastMobility ? p.lastMobility.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });

    return { positions: positionsDto, total, page, pageSize };
  }

  if (!positionModel) {
    // Fallback SQL complet
    const whereConditions: string[] = [];
    const params: unknown[] = [];

    if (q) {
      whereConditions.push(`p.name LIKE ?`);
      params.push(`%${q}%`);
    }

    if (sectorId) {
      whereConditions.push(`p.sectorId = ?`);
      params.push(sectorId);
    }

    if (departmentId) {
      whereConditions.push(`COALESCE(p.departmentId, s.departmentId) = ?`);
      params.push(departmentId);
    }

    if (type) {
      whereConditions.push(`p.type = ?`);
      params.push(type);
    }

    if (vacantOnly) {
      whereConditions.push(`mpa.memberId IS NULL`);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // Requête de comptage
    const countQuery = `
      SELECT COUNT(*) as total
      FROM \`position\` p
      LEFT JOIN sector s ON s.id = p.sectorId
      INNER JOIN department d ON d.id = COALESCE(p.departmentId, s.departmentId)
      LEFT JOIN member_position_assignment mpa ON mpa.positionId = p.id
      LEFT JOIN member m ON m.id = mpa.memberId
      ${whereClause}
    `;

    const countResult = (await prisma.$queryRawUnsafe(
      countQuery,
      ...params,
    )) as Array<{ total: bigint }>;
    const total = Number(countResult[0]?.total ?? 0);

    // Requête de liste avec JOIN
    const listQuery = `
      SELECT
        p.id,
        p.name,
        p.type,
        p.scope,
        p.isPrimary,
        p.jobDetails,
        p.sectorId,
        COALESCE(p.departmentId, s.departmentId) as departmentId,
        s.name as sectorName,
        d.name as departmentName,
        p.parentPositionId,
        pp.name as parentPositionName,
        CONCAT(m.firstname, ' ', m.lastname) as memberName,
        m.avatarUrl as memberAvatar,
        (SELECT COUNT(*) FROM \`position\` WHERE parentPositionId = p.id) as childrenCount,
        p.lastMobility,
        p.createdAt,
        p.updatedAt
      FROM \`position\` p
      LEFT JOIN sector s ON s.id = p.sectorId
      INNER JOIN department d ON d.id = COALESCE(p.departmentId, s.departmentId)
      LEFT JOIN \`position\` pp ON pp.id = p.parentPositionId
      LEFT JOIN member_position_assignment mpa ON mpa.positionId = p.id
      LEFT JOIN member m ON m.id = mpa.memberId
      ${whereClause}
      ORDER BY p.name ASC
      LIMIT ? OFFSET ?
    `;

    params.push(pageSize, offset);

    const rows = (await prisma.$queryRawUnsafe(listQuery, ...params)) as Array<{
      id: number;
      name: string;
      type: string;
      scope: string;
      isPrimary: number;
      jobDetails: string | null;
      sectorId: number | null;
      sectorName: string | null;
      departmentId: number;
      departmentName: string;
      parentPositionId: number | null;
      parentPositionName: string | null;
      memberName: string | null;
      memberAvatar: string | null;
      childrenCount: bigint;
      lastMobility: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>;

    const positions = rows.map(mapPosition);

    return { positions, total, page, pageSize };
  }

  // Utilisation de Prisma ORM
  const where: Record<string, unknown> = {};

  if (q) {
    where.name = { contains: q };
  }

  if (sectorId) {
    where.sectorId = sectorId;
  }

  if (departmentId) {
    where.OR = [{ departmentId }, { sector: { departmentId } }];
  }

  if (type) {
    where.type = type;
  }

  if (vacantOnly) {
    where.memberAssignments = { none: {} };
  }

  const [positions, total] = await Promise.all([
    positionModel.findMany({
      where: where as Prisma.PositionWhereInput,
      select: {
        id: true,
        name: true,
        type: true,
        scope: true,
        isPrimary: true,
        jobDetails: true,
        departmentId: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        sectorId: true,
        sector: {
          select: {
            name: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        parentPositionId: true,
        parentPosition: {
          select: {
            name: true,
          },
        },
        memberAssignments: {
          take: 1,
          orderBy: { isPrimary: "desc" },
          select: {
            member: {
              select: {
                firstname: true,
                lastname: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            childPositions: true,
          },
        },
        lastMobility: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
      skip: offset,
      take: pageSize,
    } as unknown as Prisma.PositionFindManyArgs),
    positionModel.count({ where: where as Prisma.PositionWhereInput }),
  ]);

  const positionsDto: PositionDto[] = (
    positions as Array<{
      id: number;
      name: string;
      type: string;
      scope: string;
      isPrimary: boolean;
      jobDetails: unknown;
      departmentId: number | null;
      sectorId: number | null;
      department: { name: string; id: number } | null;
      sector: { name: string; department: { name: string; id: number } } | null;
      parentPositionId: number | null;
      parentPosition: { name: string } | null;
      memberAssignments: Array<{
        member: {
          firstname: string;
          lastname: string;
          avatarUrl: string | null;
        };
      }>;
      _count: { childPositions: number };
      lastMobility: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  ).map((p) => {
    const departmentDirector = isDepartmentDirector(p.type);

    return {
      id: p.id,
      name: p.name,
      type: p.type as PositionDto["type"],
      isPrimary: p.isPrimary,
      jobDetails: normalizeJobDetails(p.jobDetails),
      sectorId: departmentDirector ? null : p.sectorId,
      departmentId: p.departmentId ?? p.sector?.department.id ?? 0,
      sectorName: departmentDirector
        ? ALL_SECTORS_LABEL
        : (p.sector?.name ?? ALL_SECTORS_LABEL),
      departmentName:
        p.department?.name ??
        p.sector?.department.name ??
        "Département non assigné",
      parentPositionId: p.parentPositionId,
      parentPositionName: p.parentPosition?.name ?? null,
      memberName: p.memberAssignments[0]?.member
        ? `${p.memberAssignments[0].member.firstname} ${p.memberAssignments[0].member.lastname}`
        : null,
      memberAvatar: p.memberAssignments[0]?.member.avatarUrl ?? null,
      childrenCount: p._count.childPositions,
      lastMobility: p.lastMobility ? p.lastMobility.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  return { positions: positionsDto, total, page, pageSize };
}

/**
 * Récupère un poste par son ID.
 *
 * @param id - Identifiant du poste
 * @returns Le poste trouvé ou null
 */
export async function getPositionById(id: number): Promise<PositionDto | null> {
  const positionModel = (
    prisma as unknown as { position?: PositionModelDelegate }
  ).position;

  const hasDepartmentScope =
    await supportsDepartmentScopedPositionsInOrm(positionModel);

  if (positionModel && !hasDepartmentScope) {
    const position = await positionModel.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        isPrimary: true,
        jobDetails: true,
        sectorId: true,
        sector: {
          select: {
            id: true,
            name: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        parentPositionId: true,
        parentPosition: {
          select: {
            name: true,
          },
        },
        memberAssignments: {
          take: 1,
          orderBy: { isPrimary: "desc" },
          select: {
            member: {
              select: {
                firstname: true,
                lastname: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            childPositions: true,
          },
        },
        lastMobility: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!position) {
      return null;
    }

    const p = position as {
      id: number;
      name: string;
      type: string;
      isPrimary: boolean;
      jobDetails: unknown;
      sectorId: number;
      sector: {
        id: number;
        name: string;
        department: { id: number; name: string };
      };
      parentPositionId: number | null;
      parentPosition: { name: string } | null;
      memberAssignments: Array<{
        member: {
          firstname: string;
          lastname: string;
          avatarUrl: string | null;
        };
      }>;
      _count: { childPositions: number };
      lastMobility: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };

    const departmentDirector = isDepartmentDirector(p.type);

    return {
      id: p.id,
      name: p.name,
      type: p.type as PositionDto["type"],
      isPrimary: p.isPrimary,
      jobDetails: normalizeJobDetails(p.jobDetails),
      sectorId: departmentDirector ? null : p.sectorId,
      departmentId: p.sector.department.id,
      sectorName: departmentDirector ? ALL_SECTORS_LABEL : p.sector.name,
      departmentName: p.sector.department.name,
      parentPositionId: p.parentPositionId,
      parentPositionName: p.parentPosition?.name ?? null,
      memberName: p.memberAssignments[0]?.member
        ? `${p.memberAssignments[0].member.firstname} ${p.memberAssignments[0].member.lastname}`
        : null,
      memberAvatar: p.memberAssignments[0]?.member.avatarUrl ?? null,
      childrenCount: p._count.childPositions,
      lastMobility: p.lastMobility ? p.lastMobility.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  if (!positionModel) {
    // Fallback SQL
    const query = `
      SELECT
        p.id,
        p.name,
        p.type,
        p.scope,
        p.isPrimary,
        p.jobDetails,
        p.sectorId,
        COALESCE(p.departmentId, s.departmentId) as departmentId,
        s.name as sectorName,
        d.name as departmentName,
        p.parentPositionId,
        pp.name as parentPositionName,
        CONCAT(m.firstname, ' ', m.lastname) as memberName,
        m.avatarUrl as memberAvatar,
        (SELECT COUNT(*) FROM \`position\` WHERE parentPositionId = p.id) as childrenCount,
        p.lastMobility,
        p.createdAt,
        p.updatedAt
      FROM \`position\` p
      LEFT JOIN sector s ON s.id = p.sectorId
      INNER JOIN department d ON d.id = COALESCE(p.departmentId, s.departmentId)
      LEFT JOIN \`position\` pp ON pp.id = p.parentPositionId
      LEFT JOIN member_position_assignment mpa ON mpa.positionId = p.id
      LEFT JOIN member m ON m.id = mpa.memberId
      WHERE p.id = ?
      LIMIT 1
    `;

    const rows = (await prisma.$queryRawUnsafe(query, id)) as Array<{
      id: number;
      name: string;
      type: string;
      scope: string;
      isPrimary: number;
      jobDetails: string | null;
      sectorId: number | null;
      sectorName: string | null;
      departmentId: number;
      departmentName: string;
      parentPositionId: number | null;
      parentPositionName: string | null;
      memberName: string | null;
      memberAvatar: string | null;
      childrenCount: bigint;
      lastMobility: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>;

    if (rows.length === 0) {
      return null;
    }

    return mapPosition(rows[0]);
  }

  // Utilisation de Prisma ORM
  const position = await positionModel.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      scope: true,
      isPrimary: true,
      jobDetails: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
      sectorId: true,
      sector: {
        select: {
          name: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      parentPositionId: true,
      parentPosition: {
        select: {
          name: true,
        },
      },
      memberAssignments: {
        take: 1,
        orderBy: { isPrimary: "desc" },
        select: {
          member: {
            select: {
              firstname: true,
              lastname: true,
              avatarUrl: true,
            },
          },
        },
      },
      _count: {
        select: {
          childPositions: true,
        },
      },
      lastMobility: true,
      createdAt: true,
      updatedAt: true,
    },
  } as unknown as Prisma.PositionFindUniqueArgs);

  if (!position) {
    return null;
  }

  const p = position as {
    id: number;
    name: string;
    type: string;
    scope: string;
    isPrimary: boolean;
    jobDetails: unknown;
    departmentId: number | null;
    department: { name: string; id: number } | null;
    sectorId: number | null;
    sector: { name: string; department: { name: string; id: number } } | null;
    parentPositionId: number | null;
    parentPosition: { name: string } | null;
    memberAssignments: Array<{
      member: {
        firstname: string;
        lastname: string;
        avatarUrl: string | null;
      };
    }>;
    _count: { childPositions: number };
    lastMobility: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  const departmentDirector = isDepartmentDirector(p.type);

  return {
    id: p.id,
    name: p.name,
    type: p.type as PositionDto["type"],
    isPrimary: p.isPrimary,
    jobDetails: normalizeJobDetails(p.jobDetails),
    sectorId: departmentDirector ? null : p.sectorId,
    departmentId: p.departmentId ?? p.sector?.department.id ?? 0,
    sectorName: departmentDirector
      ? ALL_SECTORS_LABEL
      : (p.sector?.name ?? ALL_SECTORS_LABEL),
    departmentName:
      p.department?.name ??
      p.sector?.department.name ??
      "Département non assigné",
    parentPositionId: p.parentPositionId,
    parentPositionName: p.parentPosition?.name ?? null,
    memberName: p.memberAssignments[0]?.member
      ? `${p.memberAssignments[0].member.firstname} ${p.memberAssignments[0].member.lastname}`
      : null,
    memberAvatar: p.memberAssignments[0]?.member.avatarUrl ?? null,
    childrenCount: p._count.childPositions,
    lastMobility: p.lastMobility ? p.lastMobility.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/**
 * Crée un nouveau poste.
 *
 * @param data - Données du poste à créer
 * @returns Le poste créé
 * @throws {Error} Erreur Prisma avec code P2002 (contrainte unique), P2003 (FK invalide)
 */
export async function createPosition(data: {
  name: string;
  type: PositionDto["type"];
  isPrimary: boolean;
  jobDetails: string[] | null;
  sectorId?: number | null;
  departmentId?: number;
  parentPositionId?: number | null;
}): Promise<PositionDto> {
  const positionModel = (
    prisma as unknown as { position?: PositionModelDelegate }
  ).position;

  const hasDepartmentScope =
    await supportsDepartmentScopedPositionsInOrm(positionModel);

  if (positionModel && !hasDepartmentScope) {
    const isDepartmentDirectorLegacy = data.type === "DIRECTEUR";

    let resolvedSectorId = data.sectorId ?? null;

    if (isDepartmentDirectorLegacy && resolvedSectorId === null) {
      resolvedSectorId = await resolveSectorIdFromDepartment(data.departmentId);
    }

    if (resolvedSectorId === null) {
      throwPrismaLikeError(
        "P2003",
        "Foreign key constraint failed on the field: `sectorId`",
      );
    }

    const sector = await prisma.sector.findUnique({
      where: { id: resolvedSectorId },
      select: { departmentId: true },
    });

    if (!sector) {
      throwPrismaLikeError(
        "P2003",
        "Foreign key constraint failed on the field: `sectorId`",
      );
    }

    if (isDepartmentDirectorLegacy) {
      const duplicateDirector = await positionModel.findMany({
        where: {
          type: "DIRECTEUR",
          sector: { departmentId: sector.departmentId },
        },
        select: { id: true },
        take: 1,
      });

      if (duplicateDirector.length > 0) {
        throwPrismaLikeError("P2002", "department_director_unique");
      }
    } else {
      const duplicateCheck = await positionModel.findMany({
        where: {
          sectorId: resolvedSectorId,
          name: data.name,
        },
        select: { id: true },
        take: 1,
      });

      if (duplicateCheck.length > 0) {
        throwPrismaLikeError(
          "P2002",
          "Unique constraint failed on the fields: (`sectorId`,`name`)",
        );
      }
    }

    const createData: Prisma.PositionUncheckedCreateInput = {
      name: data.name,
      type: data.type,
      isPrimary: data.isPrimary,
      sectorId: resolvedSectorId,
      parentPositionId: data.parentPositionId ?? null,
    };

    if (data.jobDetails != null) {
      createData.jobDetails =
        data.jobDetails as unknown as Prisma.InputJsonValue;
    }

    const created = await positionModel.create({
      data: createData,
      select: { id: true },
    });

    const createdId = (created as { id: number }).id;
    const position = await getPositionById(createdId);

    if (!position) {
      throw new Error("Poste créé mais introuvable après insertion.");
    }

    return position;
  }

  const isDepartmentDirector = data.type === "DIRECTEUR";
  const normalizedSectorId = isDepartmentDirector
    ? null
    : (data.sectorId ?? null);
  const normalizedDepartmentId = isDepartmentDirector
    ? (data.departmentId ?? null)
    : null;

  if (isDepartmentDirector && normalizedDepartmentId === null) {
    throwPrismaLikeError(
      "P2003",
      "Foreign key constraint failed on the field: `departmentId`",
    );
  }

  if (!isDepartmentDirector && normalizedSectorId === null) {
    throwPrismaLikeError(
      "P2003",
      "Foreign key constraint failed on the field: `sectorId`",
    );
  }

  if (!positionModel) {
    // Fallback SQL
    // 1. Vérifier l'entité de rattachement
    if (isDepartmentDirector) {
      const departmentCheck = (await prisma.$queryRawUnsafe(
        `SELECT id FROM department WHERE id = ? LIMIT 1`,
        normalizedDepartmentId,
      )) as Array<{ id: number }>;

      if (departmentCheck.length === 0) {
        throwPrismaLikeError(
          "P2003",
          "Foreign key constraint failed on the field: `departmentId`",
        );
      }

      const directorCheck = (await prisma.$queryRawUnsafe(
        "SELECT id FROM `position` WHERE type = 'DIRECTEUR' AND departmentId = ? LIMIT 1",
        normalizedDepartmentId,
      )) as Array<{ id: number }>;

      if (directorCheck.length > 0) {
        throwPrismaLikeError("P2002", "department_director_unique");
      }
    } else {
      const sectorCheck = (await prisma.$queryRawUnsafe(
        `SELECT id FROM sector WHERE id = ? LIMIT 1`,
        normalizedSectorId,
      )) as Array<{ id: number }>;

      if (sectorCheck.length === 0) {
        throwPrismaLikeError(
          "P2003",
          "Foreign key constraint failed on the field: `sectorId`",
        );
      }
    }

    // 2. Vérifier que le poste parent existe (si fourni)
    if (data.parentPositionId) {
      const parentCheck = (await prisma.$queryRawUnsafe(
        "SELECT id FROM `position` WHERE id = ? LIMIT 1",
        data.parentPositionId,
      )) as Array<{ id: number }>;

      if (parentCheck.length === 0) {
        throwPrismaLikeError(
          "P2003",
          "Foreign key constraint failed on the field: `parentPositionId`",
        );
      }
    }

    // 3. Vérifier unicité [sectorId, name] pour les postes rattachés secteur
    if (!isDepartmentDirector) {
      const duplicateCheck = (await prisma.$queryRawUnsafe(
        "SELECT id FROM `position` WHERE sectorId = ? AND name = ? LIMIT 1",
        normalizedSectorId,
        data.name,
      )) as Array<{ id: number }>;

      if (duplicateCheck.length > 0) {
        throwPrismaLikeError(
          "P2002",
          "Unique constraint failed on the fields: (`sectorId`,`name`)",
        );
      }
    }

    // 4. Insertion
    const jobDetailsJson = data.jobDetails
      ? JSON.stringify(data.jobDetails)
      : null;

    const insertQuery = `
      INSERT INTO \`position\` (name, type, scope, isPrimary, jobDetails, sectorId, departmentId, parentPositionId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    await prisma.$executeRawUnsafe(
      insertQuery,
      data.name,
      data.type,
      isDepartmentDirector ? "DEPARTMENT" : "SECTOR",
      data.isPrimary ? 1 : 0,
      jobDetailsJson,
      normalizedSectorId,
      normalizedDepartmentId,
      data.parentPositionId ?? null,
    );

    // 5. Récupérer l'ID du poste créé
    const getIdQuery = `SELECT LAST_INSERT_ID() as id`;
    const idResult = (await prisma.$queryRawUnsafe(getIdQuery)) as Array<{
      id: bigint;
    }>;
    const newId = Number(idResult[0].id);

    // 6. Récupérer le poste complet
    const position = await getPositionById(newId);
    if (!position) {
      throw new Error("Poste créé mais introuvable");
    }

    return position;
  }

  // Utilisation de Prisma ORM — approche simplifiée :
  // 1. Construire les données sans sentinel (Prisma.JsonNull) ;
  //    omettre jobDetails quand null → Prisma utilise le défaut SQL NULL.
  // 2. Créer avec un select minimal { id } pour éviter les problèmes
  //    de relations imbriquées dans le create.
  // 3. Récupérer le DTO complet via getPositionById.
  const createData: Record<string, unknown> = {
    name: data.name,
    type: data.type,
    scope: isDepartmentDirector ? "DEPARTMENT" : "SECTOR",
    isPrimary: data.isPrimary,
    sectorId: normalizedSectorId,
    departmentId: normalizedDepartmentId,
  };

  if (isDepartmentDirector && normalizedDepartmentId !== null) {
    const existingDirector = await positionModel.findMany({
      where: { type: "DIRECTEUR", departmentId: normalizedDepartmentId },
      select: { id: true },
      take: 1,
    } as unknown as Prisma.PositionFindManyArgs);

    if (existingDirector.length > 0) {
      throwPrismaLikeError("P2002", "department_director_unique");
    }
  }

  // Ajouter parentPositionId seulement s'il est fourni
  if (data.parentPositionId != null) {
    createData.parentPositionId = data.parentPositionId;
  }

  // Ajouter jobDetails seulement s'il n'est pas null
  if (data.jobDetails != null) {
    createData.jobDetails = data.jobDetails;
  }

  const created = await positionModel.create({
    data: createData as Prisma.PositionUncheckedCreateInput,
    select: { id: true },
  });

  const newId = (created as { id: number }).id;
  const position = await getPositionById(newId);
  if (!position) {
    throw new Error("Poste créé mais introuvable après insertion.");
  }

  return position;
}

/**
 * Met à jour un poste existant.
 *
 * @param id - Identifiant du poste à mettre à jour
 * @param data - Données de mise à jour (partielles)
 * @returns Le poste mis à jour
 * @throws {Error} Erreur Prisma avec code P2025 (not found), P2002 (unique), P2003 (FK)
 */
export async function updatePosition(
  id: number,
  data: {
    name?: string;
    type?: PositionDto["type"];
    isPrimary?: boolean;
    jobDetails?: string[] | null;
    sectorId?: number | null;
    departmentId?: number;
    parentPositionId?: number | null;
  },
): Promise<PositionDto> {
  const positionModel = (
    prisma as unknown as { position?: PositionModelDelegate }
  ).position;

  const hasDepartmentScope =
    await supportsDepartmentScopedPositionsInOrm(positionModel);

  if (positionModel && !hasDepartmentScope) {
    const existing = (await positionModel.findUnique({
      where: { id },
      select: { id: true, name: true, type: true, sectorId: true },
    })) as {
      id: number;
      name: string;
      type: PositionDto["type"];
      sectorId: number;
    } | null;

    if (!existing) {
      throwPrismaLikeError("P2025", "Record to update not found.");
    }

    const finalType = data.type ?? existing.type;
    const finalName = data.name ?? existing.name;

    let resolvedSectorId: number | null =
      data.sectorId !== undefined ? data.sectorId : existing.sectorId;

    if (finalType === "DIRECTEUR" && resolvedSectorId === null) {
      resolvedSectorId = await resolveSectorIdFromDepartment(data.departmentId);
    }

    if (resolvedSectorId === null) {
      throwPrismaLikeError(
        "P2003",
        "Foreign key constraint failed on the field: `sectorId`",
      );
    }

    if (data.parentPositionId !== undefined && data.parentPositionId === id) {
      throwPrismaLikeError("P2003", "Cannot set a position as its own parent");
    }

    if (data.parentPositionId !== undefined && data.parentPositionId !== null) {
      const parent = await positionModel.findUnique({
        where: { id: data.parentPositionId },
        select: { id: true },
      });

      if (!parent) {
        throwPrismaLikeError(
          "P2003",
          "Foreign key constraint failed on the field: `parentPositionId`",
        );
      }
    }

    const targetDepartmentId =
      await resolveDepartmentIdFromSector(resolvedSectorId);

    if (!targetDepartmentId) {
      throwPrismaLikeError(
        "P2003",
        "Foreign key constraint failed on the field: `sectorId`",
      );
    }

    if (finalType === "DIRECTEUR") {
      const duplicateDirector = await positionModel.findMany({
        where: {
          type: "DIRECTEUR",
          id: { not: id },
          sector: { departmentId: targetDepartmentId },
        },
        select: { id: true },
        take: 1,
      });

      if (duplicateDirector.length > 0) {
        throwPrismaLikeError("P2002", "department_director_unique");
      }
    } else {
      const duplicateName = await positionModel.findMany({
        where: {
          sectorId: resolvedSectorId,
          name: finalName,
          id: { not: id },
        },
        select: { id: true },
        take: 1,
      });

      if (duplicateName.length > 0) {
        throwPrismaLikeError(
          "P2002",
          "Unique constraint failed on the fields: (`sectorId`,`name`)",
        );
      }
    }

    const updateData: Prisma.PositionUncheckedUpdateInput = {
      sectorId: resolvedSectorId,
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;
    if (data.parentPositionId !== undefined) {
      updateData.parentPositionId = data.parentPositionId;
    }
    if (data.jobDetails !== undefined) {
      updateData.jobDetails =
        data.jobDetails === null
          ? Prisma.DbNull
          : (data.jobDetails as unknown as Prisma.InputJsonValue);
    }

    const updated = await positionModel.update({
      where: { id },
      data: updateData,
      select: { id: true },
    });

    if (resolvedSectorId !== existing.sectorId) {
      const conflictingAssignments =
        await prisma.memberPositionAssignment.findFirst({
          where: {
            positionId: id,
            member: {
              positionAssignments: {
                some: {
                  positionId: {
                    not: id,
                  },
                  sectorId: resolvedSectorId,
                },
              },
            },
          },
          select: { id: true },
        });

      if (conflictingAssignments) {
        throwPrismaLikeError("P2002", "member_sector_unique");
      }

      await prisma.memberPositionAssignment.updateMany({
        where: { positionId: id },
        data: { sectorId: resolvedSectorId },
      });

      await positionModel.update({
        where: { id },
        data: { lastMobility: new Date() },
        select: { id: true },
      });
    }

    const updatedId = (updated as { id: number }).id;
    const position = await getPositionById(updatedId);

    if (!position) {
      throw new Error("Poste mis à jour mais introuvable");
    }

    return position;
  }

  let previousSectorIdForOrm: number | null = null;

  if (positionModel && data.sectorId !== undefined) {
    const existingForSectorCheck = await positionModel.findUnique({
      where: { id },
      select: { sectorId: true, type: true, departmentId: true, name: true },
    } as unknown as Prisma.PositionFindUniqueArgs);

    if (!existingForSectorCheck) {
      throwPrismaLikeError("P2025", "Record to update not found.");
    }

    previousSectorIdForOrm = (
      existingForSectorCheck as { sectorId: number | null }
    ).sectorId;
  }

  if (!positionModel) {
    // Fallback SQL
    // 1. Vérifier que le poste existe
    const existingCheck = (await prisma.$queryRawUnsafe(
      "SELECT id, type, sectorId, departmentId, name FROM `position` WHERE id = ? LIMIT 1",
      id,
    )) as Array<{
      id: number;
      type: PositionDto["type"];
      sectorId: number | null;
      departmentId: number | null;
      name: string;
    }>;

    if (existingCheck.length === 0) {
      throwPrismaLikeError("P2025", "Record to update not found.");
    }

    const existing = existingCheck[0];

    const finalType = data.type ?? existing.type;
    const finalName = data.name ?? existing.name;
    const finalSectorId =
      finalType === "DIRECTEUR" ? null : (data.sectorId ?? existing.sectorId);
    const finalDepartmentId =
      finalType === "DIRECTEUR"
        ? (data.departmentId ?? existing.departmentId)
        : null;

    if (finalType === "DIRECTEUR" && finalDepartmentId === null) {
      throwPrismaLikeError(
        "P2003",
        "Foreign key constraint failed on the field: `departmentId`",
      );
    }

    if (finalType !== "DIRECTEUR" && finalSectorId === null) {
      throwPrismaLikeError(
        "P2003",
        "Foreign key constraint failed on the field: `sectorId`",
      );
    }

    // 2. Vérifier le nouveau secteur (si changé)
    if (finalSectorId !== null && finalSectorId !== existing.sectorId) {
      const sectorCheck = (await prisma.$queryRawUnsafe(
        `SELECT id FROM sector WHERE id = ? LIMIT 1`,
        finalSectorId,
      )) as Array<{ id: number }>;

      if (sectorCheck.length === 0) {
        throwPrismaLikeError(
          "P2003",
          "Foreign key constraint failed on the field: `sectorId`",
        );
      }
    }

    if (
      finalDepartmentId !== null &&
      finalDepartmentId !== existing.departmentId
    ) {
      const departmentCheck = (await prisma.$queryRawUnsafe(
        `SELECT id FROM department WHERE id = ? LIMIT 1`,
        finalDepartmentId,
      )) as Array<{ id: number }>;

      if (departmentCheck.length === 0) {
        throwPrismaLikeError(
          "P2003",
          "Foreign key constraint failed on the field: `departmentId`",
        );
      }
    }

    // 3. Vérifier le nouveau parent (si changé)
    if (data.parentPositionId !== undefined && data.parentPositionId !== null) {
      // Empêcher la relation circulaire (un poste ne peut pas être son propre parent)
      if (data.parentPositionId === id) {
        throwPrismaLikeError(
          "P2003",
          "Cannot set a position as its own parent",
        );
      }

      const parentCheck = (await prisma.$queryRawUnsafe(
        "SELECT id FROM `position` WHERE id = ? LIMIT 1",
        data.parentPositionId,
      )) as Array<{ id: number }>;

      if (parentCheck.length === 0) {
        throwPrismaLikeError(
          "P2003",
          "Foreign key constraint failed on the field: `parentPositionId`",
        );
      }
    }

    // 4. Vérifier les contraintes métier
    if (finalType === "DIRECTEUR") {
      const duplicateDirector = (await prisma.$queryRawUnsafe(
        "SELECT id FROM `position` WHERE type = 'DIRECTEUR' AND departmentId = ? AND id != ? LIMIT 1",
        finalDepartmentId,
        id,
      )) as Array<{ id: number }>;

      if (duplicateDirector.length > 0) {
        throwPrismaLikeError("P2002", "department_director_unique");
      }

      const assignmentCheck = (await prisma.$queryRawUnsafe(
        "SELECT id FROM member_position_assignment WHERE positionId = ? LIMIT 1",
        id,
      )) as Array<{ id: number }>;

      if (assignmentCheck.length > 0 && existing.type !== "DIRECTEUR") {
        throwPrismaLikeError("P2003", "director_position_assigned");
      }
    } else if (data.name || data.sectorId || data.type) {
      const duplicateCheck = (await prisma.$queryRawUnsafe(
        "SELECT id FROM `position` WHERE sectorId = ? AND name = ? AND id != ? LIMIT 1",
        finalSectorId,
        finalName,
        id,
      )) as Array<{ id: number }>;

      if (duplicateCheck.length > 0) {
        throwPrismaLikeError(
          "P2002",
          "Unique constraint failed on the fields: (`sectorId`,`name`)",
        );
      }
    }

    // 5. Construction de la requête UPDATE dynamique
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      updates.push("name = ?");
      params.push(data.name);
    }

    if (data.type !== undefined) {
      updates.push("type = ?");
      params.push(data.type);
    }

    if (data.isPrimary !== undefined) {
      updates.push("isPrimary = ?");
      params.push(data.isPrimary ? 1 : 0);
    }

    if (data.jobDetails !== undefined) {
      updates.push("jobDetails = ?");
      params.push(data.jobDetails ? JSON.stringify(data.jobDetails) : null);
    }

    if (data.sectorId !== undefined) {
      updates.push("sectorId = ?");
      params.push(finalSectorId);
    }

    if (data.departmentId !== undefined || data.type === "DIRECTEUR") {
      updates.push("departmentId = ?");
      params.push(finalDepartmentId);
    }

    if (data.type !== undefined) {
      updates.push("scope = ?");
      params.push(finalType === "DIRECTEUR" ? "DEPARTMENT" : "SECTOR");
    }

    if (data.parentPositionId !== undefined) {
      updates.push("parentPositionId = ?");
      params.push(data.parentPositionId);
    }

    updates.push("updatedAt = NOW()");

    if (updates.length === 1) {
      // Seulement updatedAt, pas de changement réel
      const position = await getPositionById(id);
      if (!position) {
        throwPrismaLikeError("P2025", "Record to update not found.");
      }
      return position;
    }

    params.push(id);

    const updateQuery = `
      UPDATE \`position\`
      SET ${updates.join(", ")}
      WHERE id = ?
    `;

    await prisma.$executeRawUnsafe(updateQuery, ...params);

    if (finalSectorId !== null && finalSectorId !== existing.sectorId) {
      const conflictingAssignments = (await prisma.$queryRawUnsafe(
        `SELECT mpa.memberId
         FROM member_position_assignment mpa
         INNER JOIN member_position_assignment other
           ON other.memberId = mpa.memberId
          AND other.positionId <> mpa.positionId
          AND other.sectorId = ?
         WHERE mpa.positionId = ?
         LIMIT 1`,
        finalSectorId,
        id,
      )) as Array<{ memberId: number }>;

      if (conflictingAssignments.length > 0) {
        throwPrismaLikeError("P2002", "member_sector_unique");
      }

      await prisma.$executeRawUnsafe(
        "UPDATE member_position_assignment SET sectorId = ?, updatedAt = NOW() WHERE positionId = ?",
        finalSectorId,
        id,
      );

      await prisma.$executeRawUnsafe(
        "UPDATE `position` SET lastMobility = NOW(), updatedAt = NOW() WHERE id = ?",
        id,
      );
    }

    // 6. Récupérer le poste mis à jour
    const updated = await getPositionById(id);
    if (!updated) {
      throw new Error("Poste mis à jour mais introuvable");
    }

    return updated;
  }

  // Utilisation de Prisma ORM (approche scalaire pour éviter les faux P2025 sur connect)
  const updateData: Record<string, unknown> = {};

  const existingForOrm = (await positionModel.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      sectorId: true,
      departmentId: true,
      name: true,
    },
  } as unknown as Prisma.PositionFindUniqueArgs)) as {
    id: number;
    type: PositionDto["type"];
    sectorId: number | null;
    departmentId: number | null;
    name: string;
  } | null;

  if (!existingForOrm) {
    throwPrismaLikeError("P2025", "Record to update not found.");
  }

  const finalTypeForOrm = data.type ?? existingForOrm.type;
  const finalNameForOrm = data.name ?? existingForOrm.name;
  const finalSectorIdForOrm =
    finalTypeForOrm === "DIRECTEUR"
      ? null
      : (data.sectorId ?? existingForOrm.sectorId);
  const finalDepartmentIdForOrm =
    finalTypeForOrm === "DIRECTEUR"
      ? (data.departmentId ?? existingForOrm.departmentId)
      : null;

  if (finalTypeForOrm === "DIRECTEUR" && finalDepartmentIdForOrm === null) {
    throwPrismaLikeError(
      "P2003",
      "Foreign key constraint failed on the field: `departmentId`",
    );
  }

  if (finalTypeForOrm !== "DIRECTEUR" && finalSectorIdForOrm === null) {
    throwPrismaLikeError(
      "P2003",
      "Foreign key constraint failed on the field: `sectorId`",
    );
  }

  if (data.parentPositionId !== undefined && data.parentPositionId === id) {
    throwPrismaLikeError("P2003", "Cannot set a position as its own parent");
  }

  if (finalTypeForOrm === "DIRECTEUR" && finalDepartmentIdForOrm !== null) {
    const existingDirector = await positionModel.findMany({
      where: {
        type: "DIRECTEUR",
        departmentId: finalDepartmentIdForOrm,
        id: { not: id },
      },
      select: { id: true },
      take: 1,
    } as unknown as Prisma.PositionFindManyArgs);

    if (existingDirector.length > 0) {
      throwPrismaLikeError("P2002", "department_director_unique");
    }

    const assignmentCheck = await prisma.memberPositionAssignment.findFirst({
      where: { positionId: id },
      select: { id: true },
    });

    if (assignmentCheck && existingForOrm.type !== "DIRECTEUR") {
      throwPrismaLikeError("P2003", "director_position_assigned");
    }
  }

  if (finalTypeForOrm !== "DIRECTEUR" && finalSectorIdForOrm !== null) {
    const duplicateSameSector = await positionModel.findMany({
      where: {
        sectorId: finalSectorIdForOrm,
        name: finalNameForOrm,
        id: { not: id },
      },
      select: { id: true },
      take: 1,
    });

    if (duplicateSameSector.length > 0) {
      throwPrismaLikeError(
        "P2002",
        "Unique constraint failed on the fields: (`sectorId`,`name`)",
      );
    }
  }

  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;
  if (data.jobDetails !== undefined) {
    updateData.jobDetails =
      data.jobDetails === null
        ? Prisma.DbNull
        : (data.jobDetails as unknown as Prisma.InputJsonValue);
  }
  updateData.scope = finalTypeForOrm === "DIRECTEUR" ? "DEPARTMENT" : "SECTOR";
  updateData.sectorId = finalSectorIdForOrm;
  updateData.departmentId = finalDepartmentIdForOrm;
  if (data.parentPositionId !== undefined) {
    updateData.parentPositionId = data.parentPositionId;
  }

  const updated = await positionModel.update({
    where: { id },
    data: updateData as Prisma.PositionUncheckedUpdateInput,
    select: { id: true },
  } as Prisma.PositionUpdateArgs);

  if (
    finalSectorIdForOrm !== null &&
    previousSectorIdForOrm !== null &&
    finalSectorIdForOrm !== previousSectorIdForOrm
  ) {
    const conflictingAssignments =
      await prisma.memberPositionAssignment.findFirst({
        where: {
          positionId: id,
          member: {
            positionAssignments: {
              some: {
                positionId: {
                  not: id,
                },
                sectorId: finalSectorIdForOrm,
              },
            },
          },
        },
        select: { id: true },
      });

    if (conflictingAssignments) {
      throwPrismaLikeError("P2002", "member_sector_unique");
    }

    await prisma.memberPositionAssignment.updateMany({
      where: { positionId: id },
      data: { sectorId: finalSectorIdForOrm },
    });

    await positionModel.update({
      where: { id },
      data: { lastMobility: new Date() },
      select: { id: true },
    });
  }

  const updatedId = (updated as { id: number }).id;
  const position = await getPositionById(updatedId);
  if (!position) {
    throw new Error("Poste mis à jour mais introuvable");
  }

  return position;
}

/**
 * Supprime un poste.
 *
 * @param id - Identifiant du poste à supprimer
 * @throws {Error} Erreur Prisma avec code P2025 (not found), P2003 (FK constraint)
 */
export async function deletePosition(id: number): Promise<void> {
  const positionModel = (
    prisma as unknown as { position?: PositionModelDelegate }
  ).position;

  if (!positionModel) {
    // Fallback SQL
    // 1. Vérifier que le poste existe
    const existingCheck = (await prisma.$queryRawUnsafe(
      "SELECT id FROM `position` WHERE id = ? LIMIT 1",
      id,
    )) as Array<{ id: number }>;

    if (existingCheck.length === 0) {
      throwPrismaLikeError("P2025", "Record to delete does not exist.");
    }

    // 2. Récupérer les membres occupant ce poste et supprimer les assignations
    const memberRows = (await prisma.$queryRawUnsafe(
      `SELECT DISTINCT memberId FROM member_position_assignment WHERE positionId = ?`,
      id,
    )) as Array<{ memberId: number }>;

    if (memberRows.length > 0) {
      // Supprimer toutes les assignations pour ce poste
      await prisma.$executeRawUnsafe(
        `DELETE FROM member_position_assignment WHERE positionId = ?`,
        id,
      );

      // Mettre à jour les membres concernés pour retirer la référence au poste principal
      const memberIds = memberRows.map((r) => r.memberId);
      const placeholders = memberIds.map(() => "?").join(",");
      await prisma.$executeRawUnsafe(
        `UPDATE \`member\` SET positionId = NULL WHERE id IN (${placeholders})`,
        ...memberIds,
      );
    }

    // 3. Les postes enfants auront automatiquement parentPositionId = NULL
    //    grâce à onDelete: SetNull dans le schéma Prisma
    await prisma.$executeRawUnsafe(
      "UPDATE `position` SET parentPositionId = NULL WHERE parentPositionId = ?",
      id,
    );

    // 4. Suppression du poste
    await prisma.$executeRawUnsafe("DELETE FROM `position` WHERE id = ?", id);

    return;
  }

  // Utilisation de Prisma ORM — supprimer d'abord les assignations et dé-référencer les membres
  await prisma.$transaction(async (tx) => {
    const occupied = (await tx.memberPositionAssignment.findMany({
      where: { positionId: id },
      select: { memberId: true },
    })) as Array<{ memberId: number }>;

    if (occupied.length > 0) {
      const memberIds = occupied.map((r) => r.memberId);

      // Supprimer les assignations pour ce poste
      await tx.memberPositionAssignment.deleteMany({
        where: { positionId: id },
      });

      // Dé-référencer la position principale des membres concernés
      await tx.member.updateMany({
        where: { id: { in: memberIds } },
        data: { positionId: null },
      });
    }

    await tx.position.delete({ where: { id } });
  });
}
