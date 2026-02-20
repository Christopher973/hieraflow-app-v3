import "server-only";

import prisma from "@/src/lib/prisma";
import type {
  CreateDepartmentInput,
  ListDepartmentsQueryInput,
  UpdateDepartmentInput,
} from "@/src/lib/admin/departments-schemas";
import type { DepartmentDto } from "@/src/types/department";

type DepartmentModelDelegate = {
  count: (args: unknown) => Promise<number>;
  findMany: (args: unknown) => Promise<
    Array<{
      id: number;
      name: string;
      createdAt: Date;
      updatedAt: Date;
      _count: { sectors: number };
    }>
  >;
  create: (args: unknown) => Promise<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { sectors: number };
  }>;
  update: (args: unknown) => Promise<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { sectors: number };
  }>;
  delete: (args: unknown) => Promise<unknown>;
};

const departmentModel = (
  prisma as unknown as { department?: DepartmentModelDelegate }
).department;

type PrismaErrorWithCode = {
  code?: string;
};

const throwPrismaLikeError = (code: string) => {
  throw { code } as PrismaErrorWithCode;
};

const mapDepartment = (department: {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { sectors: number } | null;
}): DepartmentDto => ({
  id: department.id,
  name: department.name,
  sectorsCount: department._count?.sectors ?? 0,
  createdAt: department.createdAt.toISOString(),
  updatedAt: department.updatedAt.toISOString(),
});

export const getPrismaErrorCode = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as PrismaErrorWithCode;
  return typeof candidate.code === "string" ? candidate.code : null;
};

export async function listDepartments(query: ListDepartmentsQueryInput) {
  const searchValue = query.q?.trim() ?? "";
  const skip = (query.page - 1) * query.pageSize;

  const where = searchValue
    ? {
        name: {
          contains: searchValue,
        },
      }
    : {};

  // If Prisma client exposes the delegate, use it. Otherwise fallback to a raw query.
  let totalItems: number;
  let departmentsRaw: Array<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { sectors: number } | null;
  }>;

  if (departmentModel) {
    totalItems = await departmentModel.count({ where });

    departmentsRaw = await departmentModel.findMany({
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
            sectors: true,
          },
        },
      },
    });
  } else {
    // Fallback raw SQL (safe bindings) if Prisma model is not available at runtime.
    const like = searchValue ? `%${searchValue}%` : "%";

    const countRows = (await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM department d
      WHERE d.name LIKE ${like}
    `) as Array<{ count: number }>;

    totalItems = Number(countRows?.[0]?.count ?? 0);

    const rows = (await prisma.$queryRaw`
      SELECT d.id, d.name, d.createdAt as createdAt, d.updatedAt as updatedAt,
        (SELECT COUNT(*) FROM sector s WHERE s.departmentId = d.id) as sectors
      FROM department d
      WHERE d.name LIKE ${like}
      ORDER BY d.name ASC
      LIMIT ${query.pageSize}
      OFFSET ${skip}
    `) as Array<{
      id: number;
      name: string;
      createdAt: Date;
      updatedAt: Date;
      sectors: number;
    }>;

    departmentsRaw = rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      _count: { sectors: Number(r.sectors ?? 0) },
    }));
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

  return {
    items: departmentsRaw.map(mapDepartment),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function createDepartment(input: CreateDepartmentInput) {
  if (departmentModel) {
    const department = await departmentModel.create({
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
            sectors: true,
          },
        },
      },
    });

    return mapDepartment(department);
  }

  const existingRows = (await prisma.$queryRaw`
    SELECT id
    FROM department d
    WHERE d.name = ${input.name}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (existingRows.length > 0) {
    throwPrismaLikeError("P2002");
  }

  await prisma.$executeRaw`
    INSERT INTO department (name, createdAt, updatedAt)
    VALUES (${input.name}, NOW(), NOW())
  `;

  const createdRows = (await prisma.$queryRaw`
    SELECT d.id, d.name, d.createdAt as createdAt, d.updatedAt as updatedAt,
      (SELECT COUNT(*) FROM sector s WHERE s.departmentId = d.id) as sectors
    FROM department d
    WHERE d.name = ${input.name}
    ORDER BY d.id DESC
    LIMIT 1
  `) as Array<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    sectors: number;
  }>;

  const createdDepartment = createdRows[0];

  if (!createdDepartment) {
    throwPrismaLikeError("INTERNAL_ERROR");
  }

  return mapDepartment({
    id: createdDepartment.id,
    name: createdDepartment.name,
    createdAt: new Date(createdDepartment.createdAt),
    updatedAt: new Date(createdDepartment.updatedAt),
    _count: { sectors: Number(createdDepartment.sectors ?? 0) },
  });
}

export async function updateDepartment(
  id: number,
  input: UpdateDepartmentInput,
) {
  const updateData: { name?: string } = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
  }

  if (departmentModel) {
    const department = await departmentModel.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            sectors: true,
          },
        },
      },
    });

    return mapDepartment(department);
  }

  const targetRows = (await prisma.$queryRaw`
    SELECT id
    FROM department d
    WHERE d.id = ${id}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (targetRows.length === 0) {
    throwPrismaLikeError("P2025");
  }

  if (updateData.name !== undefined) {
    const duplicateRows = (await prisma.$queryRaw`
      SELECT id
      FROM department d
      WHERE d.name = ${updateData.name} AND d.id <> ${id}
      LIMIT 1
    `) as Array<{ id: number }>;

    if (duplicateRows.length > 0) {
      throwPrismaLikeError("P2002");
    }

    await prisma.$executeRaw`
      UPDATE department
      SET name = ${updateData.name}, updatedAt = NOW()
      WHERE id = ${id}
    `;
  }

  const updatedRows = (await prisma.$queryRaw`
    SELECT d.id, d.name, d.createdAt as createdAt, d.updatedAt as updatedAt,
      (SELECT COUNT(*) FROM sector s WHERE s.departmentId = d.id) as sectors
    FROM department d
    WHERE d.id = ${id}
    LIMIT 1
  `) as Array<{
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    sectors: number;
  }>;

  const updatedDepartment = updatedRows[0];

  if (!updatedDepartment) {
    throwPrismaLikeError("P2025");
  }

  return mapDepartment({
    id: updatedDepartment.id,
    name: updatedDepartment.name,
    createdAt: new Date(updatedDepartment.createdAt),
    updatedAt: new Date(updatedDepartment.updatedAt),
    _count: { sectors: Number(updatedDepartment.sectors ?? 0) },
  });
}

export async function deleteDepartment(id: number) {
  if (departmentModel) {
    await departmentModel.delete({
      where: { id },
    });
    return;
  }

  const targetRows = (await prisma.$queryRaw`
    SELECT id
    FROM department d
    WHERE d.id = ${id}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (targetRows.length === 0) {
    throwPrismaLikeError("P2025");
  }

  const sectorRows = (await prisma.$queryRaw`
    SELECT id
    FROM sector s
    WHERE s.departmentId = ${id}
    LIMIT 1
  `) as Array<{ id: number }>;

  if (sectorRows.length > 0) {
    throwPrismaLikeError("P2003");
  }

  await prisma.$executeRaw`
    DELETE FROM department
    WHERE id = ${id}
  `;
}
