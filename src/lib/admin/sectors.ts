import "server-only";

import prisma from "@/src/lib/prisma";
import type {
  CreateSectorInput,
  ListSectorsQueryInput,
  UpdateSectorInput,
} from "@/src/lib/admin/sectors-schemas";
import type { SectorDto } from "@/src/types/sector";

type SectorModelDelegate = {
  count: (args: unknown) => Promise<number>;
  findMany: (args: unknown) => Promise<
    Array<{
      id: number;
      name: string;
      departmentId: number;
      createdAt: Date;
      updatedAt: Date;
      department: { name: string };
      _count: { positions: number };
    }>
  >;
  create: (args: unknown) => Promise<{
    id: number;
    name: string;
    departmentId: number;
    createdAt: Date;
    updatedAt: Date;
    department: { name: string };
    _count: { positions: number };
  }>;
  update: (args: unknown) => Promise<{
    id: number;
    name: string;
    departmentId: number;
    createdAt: Date;
    updatedAt: Date;
    department: { name: string };
    _count: { positions: number };
  }>;
  delete: (args: unknown) => Promise<unknown>;
};

const sectorModel = (prisma as unknown as { sector?: SectorModelDelegate })
  .sector;

type PrismaErrorWithCode = {
  code?: string;
};

const throwPrismaLikeError = (code: string) => {
  throw { code } as PrismaErrorWithCode;
};

const mapSector = (sector: {
  id: number;
  name: string;
  departmentId: number;
  createdAt: Date;
  updatedAt: Date;
  department?: { name: string } | null;
  _count?: { positions: number } | null;
}): SectorDto => ({
  id: sector.id,
  name: sector.name,
  departmentId: sector.departmentId,
  departmentName: sector.department?.name ?? "",
  positionsCount: sector._count?.positions ?? 0,
  createdAt: sector.createdAt.toISOString(),
  updatedAt: sector.updatedAt.toISOString(),
});

export const getPrismaErrorCode = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as PrismaErrorWithCode;
  return typeof candidate.code === "string" ? candidate.code : null;
};

export async function listSectors(query: ListSectorsQueryInput) {
  const searchValue = query.q?.trim() ?? "";
  const skip = (query.page - 1) * query.pageSize;

  const where = {
    ...(searchValue
      ? {
          name: {
            contains: searchValue,
          },
        }
      : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
  };

  let totalItems: number;
  let sectorsRaw: Array<{
    id: number;
    name: string;
    departmentId: number;
    createdAt: Date;
    updatedAt: Date;
    department: { name: string } | null;
    _count: { positions: number } | null;
  }>;

  if (sectorModel) {
    totalItems = await sectorModel.count({ where });

    sectorsRaw = await sectorModel.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: [{ departmentId: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            positions: true,
          },
        },
      },
    });
  } else {
    const like = searchValue ? `%${searchValue}%` : "%";
    const hasDepartmentFilter = typeof query.departmentId === "number";

    const countRows = hasDepartmentFilter
      ? ((await prisma.$queryRaw`
          SELECT COUNT(*) as count
          FROM sector s
          WHERE s.name LIKE ${like} AND s.departmentId = ${query.departmentId}
        `) as Array<{ count: number }>)
      : ((await prisma.$queryRaw`
          SELECT COUNT(*) as count
          FROM sector s
          WHERE s.name LIKE ${like}
        `) as Array<{ count: number }>);

    totalItems = Number(countRows?.[0]?.count ?? 0);

    const rows = hasDepartmentFilter
      ? ((await prisma.$queryRaw`
          SELECT s.id, s.name, s.departmentId, s.createdAt as createdAt, s.updatedAt as updatedAt,
            d.name as departmentName,
            (SELECT COUNT(*) FROM position p WHERE p.sectorId = s.id) as positions
          FROM sector s
          INNER JOIN department d ON d.id = s.departmentId
          WHERE s.name LIKE ${like} AND s.departmentId = ${query.departmentId}
          ORDER BY s.departmentId ASC, s.name ASC
          LIMIT ${query.pageSize}
          OFFSET ${skip}
        `) as Array<{
          id: number;
          name: string;
          departmentId: number;
          createdAt: Date;
          updatedAt: Date;
          departmentName: string;
          positions: number;
        }>)
      : ((await prisma.$queryRaw`
          SELECT s.id, s.name, s.departmentId, s.createdAt as createdAt, s.updatedAt as updatedAt,
            d.name as departmentName,
            (SELECT COUNT(*) FROM position p WHERE p.sectorId = s.id) as positions
          FROM sector s
          INNER JOIN department d ON d.id = s.departmentId
          WHERE s.name LIKE ${like}
          ORDER BY s.departmentId ASC, s.name ASC
          LIMIT ${query.pageSize}
          OFFSET ${skip}
        `) as Array<{
          id: number;
          name: string;
          departmentId: number;
          createdAt: Date;
          updatedAt: Date;
          departmentName: string;
          positions: number;
        }>);

    sectorsRaw = rows.map((row) => ({
      id: row.id,
      name: row.name,
      departmentId: row.departmentId,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      department: { name: row.departmentName },
      _count: { positions: Number(row.positions ?? 0) },
    }));
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

  return {
    items: sectorsRaw.map(mapSector),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function createSector(input: CreateSectorInput) {
  if (sectorModel) {
    const sector = await sectorModel.create({
      data: {
        name: input.name,
        departmentId: input.departmentId,
      },
      select: {
        id: true,
        name: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            positions: true,
          },
        },
      },
    });

    return mapSector(sector);
  }

  const departmentRows = (await prisma.$queryRaw`
    SELECT id, name
    FROM department d
    WHERE d.id = ${input.departmentId}
    LIMIT 1
  `) as Array<{ id: number; name: string }>;

  if (departmentRows.length === 0) {
    throwPrismaLikeError("P2003");
  }

  const duplicateRows = (await prisma.$queryRaw`
    SELECT id
    FROM sector s
    WHERE s.departmentId = ${input.departmentId} AND s.name = ${input.name}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (duplicateRows.length > 0) {
    throwPrismaLikeError("P2002");
  }

  await prisma.$executeRaw`
    INSERT INTO sector (name, departmentId, createdAt, updatedAt)
    VALUES (${input.name}, ${input.departmentId}, NOW(), NOW())
  `;

  const createdRows = (await prisma.$queryRaw`
    SELECT s.id, s.name, s.departmentId, s.createdAt as createdAt, s.updatedAt as updatedAt,
      d.name as departmentName,
      (SELECT COUNT(*) FROM position p WHERE p.sectorId = s.id) as positions
    FROM sector s
    INNER JOIN department d ON d.id = s.departmentId
    WHERE s.departmentId = ${input.departmentId} AND s.name = ${input.name}
    ORDER BY s.id DESC
    LIMIT 1
  `) as Array<{
    id: number;
    name: string;
    departmentId: number;
    createdAt: Date;
    updatedAt: Date;
    departmentName: string;
    positions: number;
  }>;

  const createdSector = createdRows[0];

  if (!createdSector) {
    throwPrismaLikeError("INTERNAL_ERROR");
  }

  return mapSector({
    id: createdSector.id,
    name: createdSector.name,
    departmentId: createdSector.departmentId,
    createdAt: new Date(createdSector.createdAt),
    updatedAt: new Date(createdSector.updatedAt),
    department: { name: createdSector.departmentName },
    _count: { positions: Number(createdSector.positions ?? 0) },
  });
}

export async function updateSector(id: number, input: UpdateSectorInput) {
  const updateData: { name?: string; departmentId?: number } = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
  }

  if (input.departmentId !== undefined) {
    updateData.departmentId = input.departmentId;
  }

  if (sectorModel) {
    const sector = await sectorModel.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            positions: true,
          },
        },
      },
    });

    return mapSector(sector);
  }

  const targetRows = (await prisma.$queryRaw`
    SELECT id
    FROM sector s
    WHERE s.id = ${id}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (targetRows.length === 0) {
    throwPrismaLikeError("P2025");
  }

  const currentRows = (await prisma.$queryRaw`
    SELECT name, departmentId
    FROM sector s
    WHERE s.id = ${id}
    LIMIT 1
  `) as Array<{ name: string; departmentId: number }>;

  const current = currentRows[0];

  if (!current) {
    throwPrismaLikeError("P2025");
  }

  const nextDepartmentId = updateData.departmentId ?? current.departmentId;
  const nextName = updateData.name ?? current.name;

  if (updateData.departmentId !== undefined) {
    const departmentRows = (await prisma.$queryRaw`
      SELECT id
      FROM department d
      WHERE d.id = ${nextDepartmentId}
      LIMIT 1
    `) as Array<{ id: number }>;

    if (departmentRows.length === 0) {
      throwPrismaLikeError("P2003");
    }
  }

  const duplicateRows = (await prisma.$queryRaw`
    SELECT id
    FROM sector s
    WHERE s.departmentId = ${nextDepartmentId}
      AND s.name = ${nextName}
      AND s.id <> ${id}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (duplicateRows.length > 0) {
    throwPrismaLikeError("P2002");
  }

  await prisma.$executeRaw`
    UPDATE sector
    SET name = ${nextName}, departmentId = ${nextDepartmentId}, updatedAt = NOW()
    WHERE id = ${id}
  `;

  const updatedRows = (await prisma.$queryRaw`
    SELECT s.id, s.name, s.departmentId, s.createdAt as createdAt, s.updatedAt as updatedAt,
      d.name as departmentName,
      (SELECT COUNT(*) FROM position p WHERE p.sectorId = s.id) as positions
    FROM sector s
    INNER JOIN department d ON d.id = s.departmentId
    WHERE s.id = ${id}
    LIMIT 1
  `) as Array<{
    id: number;
    name: string;
    departmentId: number;
    createdAt: Date;
    updatedAt: Date;
    departmentName: string;
    positions: number;
  }>;

  const updatedSector = updatedRows[0];

  if (!updatedSector) {
    throwPrismaLikeError("P2025");
  }

  return mapSector({
    id: updatedSector.id,
    name: updatedSector.name,
    departmentId: updatedSector.departmentId,
    createdAt: new Date(updatedSector.createdAt),
    updatedAt: new Date(updatedSector.updatedAt),
    department: { name: updatedSector.departmentName },
    _count: { positions: Number(updatedSector.positions ?? 0) },
  });
}

export async function deleteSector(id: number) {
  if (sectorModel) {
    await sectorModel.delete({
      where: { id },
    });
    return;
  }

  const targetRows = (await prisma.$queryRaw`
    SELECT id
    FROM sector s
    WHERE s.id = ${id}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (targetRows.length === 0) {
    throwPrismaLikeError("P2025");
  }

  const positionRows = (await prisma.$queryRaw`
    SELECT id
    FROM position p
    WHERE p.sectorId = ${id}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (positionRows.length > 0) {
    throwPrismaLikeError("P2003");
  }

  await prisma.$executeRaw`
    DELETE FROM sector
    WHERE id = ${id}
  `;
}
