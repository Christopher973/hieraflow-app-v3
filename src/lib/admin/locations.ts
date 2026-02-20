import "server-only";

import prisma from "@/src/lib/prisma";
import type {
  CreateLocationInput,
  ListLocationsQueryInput,
  UpdateLocationInput,
} from "@/src/lib/admin/locations-schemas";
import type { LocationDto } from "@/src/types/location";

type LocationModelDelegate = {
  count: (args: unknown) => Promise<number>;
  findMany: (args: unknown) => Promise<
    Array<{
      id: number;
      name: string;
      createdAt: Date;
      updatedAt: Date;
      _count: { members: number };
    }>
  >;
  create: (args: unknown) => Promise<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { members: number };
  }>;
  update: (args: unknown) => Promise<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { members: number };
  }>;
  delete: (args: unknown) => Promise<unknown>;
};

const locationModel = (
  prisma as unknown as { location?: LocationModelDelegate }
).location;

type PrismaErrorWithCode = {
  code?: string;
};

const throwPrismaLikeError = (code: string) => {
  throw { code } as PrismaErrorWithCode;
};

const mapLocation = (location: {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { members: number } | null;
}): LocationDto => ({
  id: location.id,
  name: location.name,
  membersCount: location._count?.members ?? 0,
  createdAt: location.createdAt.toISOString(),
  updatedAt: location.updatedAt.toISOString(),
});

export const getPrismaErrorCode = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as PrismaErrorWithCode;
  return typeof candidate.code === "string" ? candidate.code : null;
};

export async function listLocations(query: ListLocationsQueryInput) {
  const searchValue = query.q?.trim() ?? "";
  const skip = (query.page - 1) * query.pageSize;

  const where = searchValue
    ? {
        name: {
          contains: searchValue,
        },
      }
    : {};

  let totalItems: number;
  let locationsRaw: Array<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { members: number } | null;
  }>;

  if (locationModel) {
    totalItems = await locationModel.count({ where });

    locationsRaw = await locationModel.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
    });
  } else {
    const like = searchValue ? `%${searchValue}%` : "%";

    const countRows = (await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM location l
      WHERE l.name LIKE ${like}
    `) as Array<{ count: number }>;

    totalItems = Number(countRows?.[0]?.count ?? 0);

    const rows = (await prisma.$queryRaw`
      SELECT l.id, l.name, l.createdAt as createdAt, l.updatedAt as updatedAt,
        (SELECT COUNT(*) FROM member m WHERE m.locationId = l.id) as members
      FROM location l
      WHERE l.name LIKE ${like}
      ORDER BY l.name ASC
      LIMIT ${query.pageSize}
      OFFSET ${skip}
    `) as Array<{
      id: number;
      name: string;
      createdAt: Date;
      updatedAt: Date;
      members: number;
    }>;

    locationsRaw = rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      _count: { members: Number(row.members ?? 0) },
    }));
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

  return {
    items: locationsRaw.map(mapLocation),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function createLocation(input: CreateLocationInput) {
  if (locationModel) {
    const location = await locationModel.create({
      data: {
        name: input.name,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    return mapLocation(location);
  }

  const existingRows = (await prisma.$queryRaw`
    SELECT id
    FROM location l
    WHERE l.name = ${input.name}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (existingRows.length > 0) {
    throwPrismaLikeError("P2002");
  }

  await prisma.$executeRaw`
    INSERT INTO location (name, createdAt, updatedAt)
    VALUES (${input.name}, NOW(), NOW())
  `;

  const createdRows = (await prisma.$queryRaw`
    SELECT l.id, l.name, l.createdAt as createdAt, l.updatedAt as updatedAt,
      (SELECT COUNT(*) FROM member m WHERE m.locationId = l.id) as members
    FROM location l
    WHERE l.name = ${input.name}
    ORDER BY l.id DESC
    LIMIT 1
  `) as Array<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    members: number;
  }>;

  const createdLocation = createdRows[0];

  if (!createdLocation) {
    throwPrismaLikeError("INTERNAL_ERROR");
  }

  return mapLocation({
    id: createdLocation.id,
    name: createdLocation.name,
    createdAt: new Date(createdLocation.createdAt),
    updatedAt: new Date(createdLocation.updatedAt),
    _count: { members: Number(createdLocation.members ?? 0) },
  });
}

export async function updateLocation(id: number, input: UpdateLocationInput) {
  const updateData: { name?: string } = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
  }

  if (locationModel) {
    const location = await locationModel.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    return mapLocation(location);
  }

  const targetRows = (await prisma.$queryRaw`
    SELECT id
    FROM location l
    WHERE l.id = ${id}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (targetRows.length === 0) {
    throwPrismaLikeError("P2025");
  }

  if (updateData.name !== undefined) {
    const duplicateRows = (await prisma.$queryRaw`
      SELECT id
      FROM location l
      WHERE l.name = ${updateData.name} AND l.id <> ${id}
      LIMIT 1
    `) as Array<{ id: number }>;

    if (duplicateRows.length > 0) {
      throwPrismaLikeError("P2002");
    }

    await prisma.$executeRaw`
      UPDATE location
      SET name = ${updateData.name}, updatedAt = NOW()
      WHERE id = ${id}
    `;
  }

  const updatedRows = (await prisma.$queryRaw`
    SELECT l.id, l.name, l.createdAt as createdAt, l.updatedAt as updatedAt,
      (SELECT COUNT(*) FROM member m WHERE m.locationId = l.id) as members
    FROM location l
    WHERE l.id = ${id}
    LIMIT 1
  `) as Array<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    members: number;
  }>;

  const updatedLocation = updatedRows[0];

  if (!updatedLocation) {
    throwPrismaLikeError("P2025");
  }

  return mapLocation({
    id: updatedLocation.id,
    name: updatedLocation.name,
    createdAt: new Date(updatedLocation.createdAt),
    updatedAt: new Date(updatedLocation.updatedAt),
    _count: { members: Number(updatedLocation.members ?? 0) },
  });
}

export async function deleteLocation(id: number) {
  if (locationModel) {
    await locationModel.delete({
      where: { id },
    });
    return;
  }

  const targetRows = (await prisma.$queryRaw`
    SELECT id
    FROM location l
    WHERE l.id = ${id}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (targetRows.length === 0) {
    throwPrismaLikeError("P2025");
  }

  const memberRows = (await prisma.$queryRaw`
    SELECT id
    FROM member m
    WHERE m.locationId = ${id}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (memberRows.length > 0) {
    throwPrismaLikeError("P2003");
  }

  await prisma.$executeRaw`
    DELETE FROM location
    WHERE id = ${id}
  `;
}
