import "server-only";

import prisma from "@/src/lib/prisma";
import type {
  CreateCollaboratorInput,
  ListCollaboratorsQueryInput,
  UpdateCollaboratorInput,
} from "@/src/lib/admin/collaborators-schemas";
import { getFileUrl } from "@/src/lib/storage";
import type {
  CollaboratorDetailDto,
  CollaboratorDto,
  CollaboratorLightMemberDto,
  CollaboratorRelatedPositionDto,
} from "@/src/types/collaborator";

const prismaClient = prisma as unknown as PrismaClientLike;

type MemberDelegate = {
  findUnique: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown[]>;
  count: (args: unknown) => Promise<number>;
  create: (args: unknown) => Promise<{ id: number }>;
  update: (args: unknown) => Promise<{ id: number }>;
  delete: (args: unknown) => Promise<unknown>;
};

type PositionDelegate = {
  findMany: (args: unknown) => Promise<unknown[]>;
  updateMany: (args: unknown) => Promise<unknown>;
};

type MemberPositionAssignmentDelegate = {
  findMany: (args: unknown) => Promise<unknown[]>;
  deleteMany: (args: unknown) => Promise<unknown>;
  createMany: (args: unknown) => Promise<unknown>;
};

type PrismaClientLike = {
  member: MemberDelegate;
  position: PositionDelegate;
  memberPositionAssignment: MemberPositionAssignmentDelegate;
  $transaction: <T>(fn: (tx: PrismaClientLike) => Promise<T>) => Promise<T>;
};
type PrismaErrorWithCode = {
  code?: string;
};

const throwPrismaLikeError = (code: string, message?: string): never => {
  const error: PrismaErrorWithCode & { message?: string } = { code };
  if (message) {
    error.message = message;
  }
  throw error;
};

export const getPrismaErrorCode = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as PrismaErrorWithCode;
  return typeof candidate.code === "string" ? candidate.code : null;
};

type AssignmentInput = {
  positionIds: number[];
  primaryPositionId: number | null;
};

type ValidatedAssignment = {
  positionId: number;
  sectorId: number;
  isPrimary: boolean;
};

const normalizeJobDetails = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.filter(
    (item): item is string => typeof item === "string",
  );

  return items.length > 0 ? items : [];
};

const resolveAvatarUrlAsync = async (
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

type CollaboratorListMember = Parameters<typeof mapCollaborator>[0];

type CollaboratorDetailMember = {
  id: number;
  serviceCode: string;
  firstname: string;
  lastname: string;
  birthday: Date | null;
  gender: "HOMME" | "FEMME" | "AUTRE";
  avatarKey: string | null;
  avatarUrl: string | null;
  professionalEmail: string;
  phone: string | null;
  startDate: Date;
  endDate: Date | null;
  status: "ACTIF" | "INACTIF" | "SUSPENDU";
  isReferentRH: boolean;
  locationId: number | null;
  positionId: number | null;
  createdAt: Date;
  updatedAt: Date;
  location: { name: string } | null;
  positionAssignments: Array<{
    isPrimary: boolean;
    positionId: number;
    position: {
      id: number;
      name: string;
      type:
        | "DIRECTEUR"
        | "SOUS_DIRECTEUR"
        | "CHEF_SERVICE"
        | "RESPONSABLE"
        | "COLLABORATEUR"
        | "ASSISTANT";
      isPrimary: boolean;
      jobDetails: unknown;
      sectorId: number;
      sector: {
        name: string;
        departmentId: number;
        department: { name: string };
      };
    };
  }>;
  position: {
    id: number;
    name: string;
    type:
      | "DIRECTEUR"
      | "SOUS_DIRECTEUR"
      | "CHEF_SERVICE"
      | "RESPONSABLE"
      | "COLLABORATEUR"
      | "ASSISTANT";
    jobDetails: unknown;
    sectorId: number;
    sector: {
      name: string;
      departmentId: number;
      department: { name: string };
    };
    parentPosition: Parameters<typeof mapRelatedPosition>[0] | null;
    childPositions: Array<Parameters<typeof mapRelatedPosition>[0]>;
  } | null;
};

const dedupeNumbers = (values: number[]) => {
  const unique = new Set<number>();

  for (const value of values) {
    unique.add(value);
  }

  return Array.from(unique);
};

const mapLightMember = async (member: {
  id: number;
  serviceCode: string;
  firstname: string;
  lastname: string;
  gender: "HOMME" | "FEMME" | "AUTRE";
  avatarKey: string | null;
  avatarUrl: string | null;
  professionalEmail: string;
  phone: string | null;
  startDate: Date;
  endDate: Date | null;
  locationId: number | null;
  location: { name: string } | null;
}): Promise<CollaboratorLightMemberDto> => ({
  id: member.id,
  serviceCode: member.serviceCode,
  firstname: member.firstname,
  lastname: member.lastname,
  gender: member.gender,
  avatarKey: member.avatarKey,
  avatarUrl: await resolveAvatarUrlAsync(member.avatarKey, member.avatarUrl),
  professionalEmail: member.professionalEmail,
  phone: member.phone,
  startDate: member.startDate.toISOString(),
  endDate: member.endDate?.toISOString() ?? null,
  locationId: member.locationId,
  locationName: member.location?.name ?? null,
});

const mapRelatedPosition = async (position: {
  id: number;
  name: string;
  type:
    | "DIRECTEUR"
    | "SOUS_DIRECTEUR"
    | "CHEF_SERVICE"
    | "RESPONSABLE"
    | "COLLABORATEUR"
    | "ASSISTANT";
  jobDetails: unknown;
  sectorId: number;
  sector: {
    name: string;
    departmentId: number;
    department: {
      name: string;
    };
  };
  memberAssignments: Array<{
    member: {
      id: number;
      serviceCode: string;
      firstname: string;
      lastname: string;
      gender: "HOMME" | "FEMME" | "AUTRE";
      avatarKey: string | null;
      avatarUrl: string | null;
      professionalEmail: string;
      phone: string | null;
      startDate: Date;
      endDate: Date | null;
      locationId: number | null;
      location: { name: string } | null;
    };
  }>;
}): Promise<CollaboratorRelatedPositionDto> => ({
  id: position.id,
  name: position.name,
  type: position.type,
  sectorId: position.sectorId,
  sectorName: position.sector?.name ?? null,
  departmentId: position.sector?.departmentId ?? null,
  departmentName: position.sector?.department?.name ?? null,
  member:
    position.memberAssignments.length > 0
      ? await mapLightMember(position.memberAssignments[0].member)
      : null,
  jobDetails: normalizeJobDetails(position.jobDetails),
});

const mapCollaborator = async (member: {
  id: number;
  serviceCode: string;
  firstname: string;
  lastname: string;
  birthday: Date | null;
  gender: "HOMME" | "FEMME" | "AUTRE";
  avatarKey: string | null;
  avatarUrl: string | null;
  professionalEmail: string;
  phone: string | null;
  startDate: Date;
  endDate: Date | null;
  status: "ACTIF" | "INACTIF" | "SUSPENDU";
  isReferentRH: boolean;
  locationId: number | null;
  positionId: number | null;
  createdAt: Date;
  updatedAt: Date;
  location: { name: string } | null;
  position: {
    name: string;
    sectorId: number;
    sector: {
      name: string;
      departmentId: number;
      department: {
        name: string;
      };
    };
  } | null;
}): Promise<CollaboratorDto> => ({
  id: member.id,
  serviceCode: member.serviceCode,
  firstname: member.firstname,
  lastname: member.lastname,
  birthday: member.birthday?.toISOString() ?? null,
  gender: member.gender,
  avatarKey: member.avatarKey,
  avatarUrl: await resolveAvatarUrlAsync(member.avatarKey, member.avatarUrl),
  professionalEmail: member.professionalEmail,
  phone: member.phone,
  startDate: member.startDate.toISOString(),
  endDate: member.endDate?.toISOString() ?? null,
  status: member.status,
  isReferentRH: member.isReferentRH,
  locationId: member.locationId,
  locationName: member.location?.name ?? null,
  positionId: member.positionId,
  positionName: member.position?.name ?? null,
  sectorId: member.position?.sectorId ?? null,
  sectorName: member.position?.sector?.name ?? null,
  departmentId: member.position?.sector?.departmentId ?? null,
  departmentName: member.position?.sector?.department?.name ?? null,
  createdAt: member.createdAt.toISOString(),
  updatedAt: member.updatedAt.toISOString(),
});

const parseAssignmentInput = (
  input: Pick<
    CreateCollaboratorInput | UpdateCollaboratorInput,
    "positionId" | "positionIds" | "primaryPositionId"
  >,
): AssignmentInput | null => {
  if (input.positionIds !== undefined) {
    return {
      positionIds: dedupeNumbers(input.positionIds),
      primaryPositionId: input.primaryPositionId ?? null,
    };
  }

  if (input.positionId !== undefined) {
    const nextIds = input.positionId != null ? [input.positionId] : [];
    return {
      positionIds: nextIds,
      primaryPositionId: input.primaryPositionId ?? input.positionId ?? null,
    };
  }

  if (input.primaryPositionId !== undefined) {
    return {
      positionIds: [],
      primaryPositionId: input.primaryPositionId,
    };
  }

  return null;
};

const validateAssignments = async (
  payload: AssignmentInput,
  memberId: number | null,
): Promise<{
  assignments: ValidatedAssignment[];
  primaryPositionId: number | null;
}> => {
  if (payload.positionIds.length === 0) {
    return { assignments: [], primaryPositionId: null };
  }

  const positions = (await prismaClient.position.findMany({
    where: { id: { in: payload.positionIds } },
    select: { id: true, sectorId: true, departmentId: true },
  })) as Array<{
    id: number;
    sectorId: number | null;
    departmentId: number | null;
  }>;

  if (positions.length !== payload.positionIds.length) {
    throwPrismaLikeError("P2003", "positionId");
  }

  const primaryPositionId =
    payload.primaryPositionId ?? payload.positionIds[0] ?? null;

  if (
    primaryPositionId == null ||
    !payload.positionIds.includes(primaryPositionId)
  ) {
    throwPrismaLikeError("P2003", "primaryPositionId");
  }

  const byId = new Map<number, { id: number; sectorId: number }>();

  // Normalize positions: resolve a concrete sectorId for positions that
  // are department-scoped (sectorId === null) by looking up a fallback
  // sector in the related department. This ensures MemberPositionAssignment
  // always receives a non-null sectorId (DB constraint).
  const normalizedPositions = await Promise.all(
    positions.map(async (position) => {
      // If sectorId is present, use it as-is (narrow to number)
      if (position.sectorId !== null && position.sectorId !== undefined) {
        return { id: position.id, sectorId: position.sectorId as number };
      }

      // Otherwise, try to resolve a fallback sector for the department
      const deptId = position.departmentId;

      if (deptId == null) {
        // Cannot resolve a sector for this position
        throwPrismaLikeError("P2003", "positionId");
      }

      const fallback = await prisma.sector.findFirst({
        where: { departmentId: deptId as number },
        select: { id: true },
        orderBy: { id: "asc" },
      });

      if (!fallback) {
        throwPrismaLikeError("P2003", "positionId");
      }

      const fallbackId = fallback!.id;
      return { id: position.id, sectorId: fallbackId };
    }),
  );

  for (const position of normalizedPositions) {
    byId.set(position.id, position);
  }

  const occupied = (await prismaClient.memberPositionAssignment.findMany({
    where: {
      positionId: { in: payload.positionIds },
      ...(memberId !== null
        ? {
            memberId: {
              not: memberId,
            },
          }
        : {}),
    },
    select: { positionId: true },
  })) as Array<{ positionId: number }>;

  if (occupied.length > 0) {
    throwPrismaLikeError("P2002", "positionId");
  }

  const assignments: ValidatedAssignment[] = payload.positionIds.map(
    (positionId) => {
      const position = byId.get(positionId);

      if (!position) {
        throwPrismaLikeError("P2003", "positionId");
      }

      const resolvedPosition = position as { id: number; sectorId: number };

      return {
        positionId,
        sectorId: resolvedPosition.sectorId,
        isPrimary: positionId === primaryPositionId,
      };
    },
  );

  return { assignments, primaryPositionId };
};

const syncMemberAssignments = async (
  tx: PrismaClientLike,
  memberId: number,
  assignments: ValidatedAssignment[],
  primaryPositionId: number | null,
) => {
  await tx.memberPositionAssignment.deleteMany({
    where: { memberId },
  });

  if (assignments.length > 0) {
    await tx.memberPositionAssignment.createMany({
      data: assignments.map((assignment) => ({
        memberId,
        positionId: assignment.positionId,
        sectorId: assignment.sectorId,
        isPrimary: assignment.isPrimary,
      })),
    });

    await tx.position.updateMany({
      where: {
        id: { in: assignments.map((assignment) => assignment.positionId) },
      },
      data: { lastMobility: new Date() },
    });
  }

  await tx.member.update({
    where: { id: memberId },
    data: { positionId: primaryPositionId },
    select: { id: true },
  });
};

export async function getCollaboratorDetailById(
  id: number,
): Promise<CollaboratorDetailDto | null> {
  const member = (await prismaClient.member.findUnique({
    where: { id },
    select: {
      id: true,
      serviceCode: true,
      firstname: true,
      lastname: true,
      birthday: true,
      gender: true,
      avatarKey: true,
      avatarUrl: true,
      professionalEmail: true,
      phone: true,
      startDate: true,
      endDate: true,
      status: true,
      isReferentRH: true,
      locationId: true,
      positionId: true,
      createdAt: true,
      updatedAt: true,
      location: { select: { name: true } },
      positionAssignments: {
        orderBy: [{ isPrimary: "desc" }, { positionId: "asc" }],
        select: {
          isPrimary: true,
          positionId: true,
          position: {
            select: {
              id: true,
              name: true,
              type: true,
              isPrimary: true,
              jobDetails: true,
              sectorId: true,
              sector: {
                select: {
                  name: true,
                  departmentId: true,
                  department: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      position: {
        select: {
          id: true,
          name: true,
          type: true,
          jobDetails: true,
          sectorId: true,
          sector: {
            select: {
              name: true,
              departmentId: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
          parentPosition: {
            select: {
              id: true,
              name: true,
              type: true,
              jobDetails: true,
              sectorId: true,
              sector: {
                select: {
                  name: true,
                  departmentId: true,
                  department: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              memberAssignments: {
                take: 1,
                orderBy: { isPrimary: "desc" },
                select: {
                  member: {
                    select: {
                      id: true,
                      serviceCode: true,
                      firstname: true,
                      lastname: true,
                      gender: true,
                      avatarKey: true,
                      avatarUrl: true,
                      professionalEmail: true,
                      phone: true,
                      startDate: true,
                      endDate: true,
                      locationId: true,
                      location: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
          childPositions: {
            orderBy: [{ name: "asc" }],
            select: {
              id: true,
              name: true,
              type: true,
              jobDetails: true,
              sectorId: true,
              sector: {
                select: {
                  name: true,
                  departmentId: true,
                  department: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              memberAssignments: {
                take: 1,
                orderBy: { isPrimary: "desc" },
                select: {
                  member: {
                    select: {
                      id: true,
                      serviceCode: true,
                      firstname: true,
                      lastname: true,
                      gender: true,
                      avatarKey: true,
                      avatarUrl: true,
                      professionalEmail: true,
                      phone: true,
                      startDate: true,
                      endDate: true,
                      locationId: true,
                      location: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })) as CollaboratorDetailMember | null;

  if (!member) {
    return null;
  }

  const primaryAssignment =
    member.positionAssignments.find(
      (assignment: { isPrimary: boolean }) => assignment.isPrimary,
    ) ?? null;

  const parentPosition = member.position?.parentPosition
    ? await mapRelatedPosition(member.position.parentPosition)
    : null;

  const childPositions = member.position
    ? await Promise.all(member.position.childPositions.map(mapRelatedPosition))
    : [];

  const resolvedAvatarUrl = await resolveAvatarUrlAsync(
    member.avatarKey,
    member.avatarUrl,
  );

  return {
    id: member.id,
    serviceCode: member.serviceCode,
    firstname: member.firstname,
    lastname: member.lastname,
    birthday: member.birthday?.toISOString() ?? null,
    gender: member.gender,
    avatarKey: member.avatarKey,
    avatarUrl: resolvedAvatarUrl,
    professionalEmail: member.professionalEmail,
    phone: member.phone,
    startDate: member.startDate.toISOString(),
    endDate: member.endDate?.toISOString() ?? null,
    status: member.status,
    isReferentRH: member.isReferentRH,
    locationId: member.locationId,
    locationName: member.location?.name ?? null,
    positionId: member.positionId,
    primaryPositionId:
      primaryAssignment?.positionId ?? member.positionId ?? null,
    positions: member.positionAssignments.map((assignment) => ({
      id: assignment.position.id,
      name: assignment.position.name,
      type: assignment.position.type,
      jobDetails: normalizeJobDetails(assignment.position.jobDetails),
      sectorId: assignment.position.sectorId,
      sectorName: assignment.position.sector?.name ?? null,
      departmentId: assignment.position.sector?.departmentId ?? null,
      departmentName: assignment.position.sector?.department?.name ?? null,
      isPrimary: Boolean(assignment.isPrimary),
    })),
    position: member.position
      ? {
          id: member.position.id,
          name: member.position.name,
          type: member.position.type,
          jobDetails: normalizeJobDetails(member.position.jobDetails),
          sectorId: member.position.sectorId,
          sectorName: member.position.sector?.name ?? null,
          departmentId: member.position.sector?.departmentId ?? null,
          departmentName: member.position.sector?.department?.name ?? null,
          parentPosition,
          childPositions,
        }
      : null,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

export async function getCollaboratorById(
  id: number,
): Promise<CollaboratorDto | null> {
  const member = (await prismaClient.member.findUnique({
    where: { id },
    select: {
      id: true,
      serviceCode: true,
      firstname: true,
      lastname: true,
      birthday: true,
      gender: true,
      avatarKey: true,
      avatarUrl: true,
      professionalEmail: true,
      phone: true,
      startDate: true,
      endDate: true,
      status: true,
      isReferentRH: true,
      locationId: true,
      positionId: true,
      createdAt: true,
      updatedAt: true,
      location: { select: { name: true } },
      position: {
        select: {
          name: true,
          sectorId: true,
          sector: {
            select: {
              name: true,
              departmentId: true,
              department: { select: { name: true } },
            },
          },
        },
      },
    },
  })) as CollaboratorListMember | null;

  return member ? await mapCollaborator(member) : null;
}

export async function listCollaborators(query: ListCollaboratorsQueryInput) {
  const searchValue = query.q?.trim() ?? "";
  const searchTerms = searchValue.split(/\s+/).filter(Boolean);
  const skip = (query.page - 1) * query.pageSize;

  const andConditions: Record<string, unknown>[] = [];
  const where: Record<string, unknown> = {};

  if (searchTerms.length > 0) {
    andConditions.push(
      ...searchTerms.map((term) => ({
        OR: [
          { firstname: { contains: term } },
          { lastname: { contains: term } },
          { professionalEmail: { contains: term } },
          { serviceCode: { contains: term } },
          { phone: { contains: term } },
          {
            positionAssignments: {
              some: {
                position: {
                  name: { contains: term },
                },
              },
            },
          },
        ],
      })),
    );
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.gender) {
    where.gender = query.gender;
  }

  if (query.locationId) {
    where.locationId = query.locationId;
  }

  if (query.positionId) {
    andConditions.push({
      positionAssignments: {
        some: {
          positionId: query.positionId,
        },
      },
    });
  }

  if (query.departmentId) {
    andConditions.push({
      positionAssignments: {
        some: {
          position: {
            sector: {
              departmentId: query.departmentId,
            },
          },
        },
      },
    });
  }

  if (query.sectorId) {
    andConditions.push({
      positionAssignments: {
        some: {
          position: {
            sectorId: query.sectorId,
          },
        },
      },
    });
  }

  if (query.isReferentRH !== undefined) {
    where.isReferentRH = query.isReferentRH;
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const [totalItems, members] = await Promise.all([
    prismaClient.member.count({ where }),
    prismaClient.member.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: [{ lastname: "asc" }, { firstname: "asc" }],
      select: {
        id: true,
        serviceCode: true,
        firstname: true,
        lastname: true,
        birthday: true,
        gender: true,
        avatarKey: true,
        avatarUrl: true,
        professionalEmail: true,
        phone: true,
        startDate: true,
        endDate: true,
        status: true,
        isReferentRH: true,
        locationId: true,
        positionId: true,
        createdAt: true,
        updatedAt: true,
        location: { select: { name: true } },
        position: {
          select: {
            name: true,
            sectorId: true,
            sector: {
              select: {
                name: true,
                departmentId: true,
                department: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const typedMembers = members as CollaboratorListMember[];
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));

  const mappedItems = await Promise.all(typedMembers.map(mapCollaborator));

  return {
    items: mappedItems,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function createCollaborator(
  input: CreateCollaboratorInput,
): Promise<CollaboratorDto> {
  const assignmentPayload = parseAssignmentInput(input) ?? {
    positionIds: [],
    primaryPositionId: null,
  };

  const validated = await validateAssignments(assignmentPayload, null);

  const createdId = await prismaClient.$transaction(async (tx) => {
    const created = await tx.member.create({
      data: {
        serviceCode: input.serviceCode,
        firstname: input.firstname,
        lastname: input.lastname,
        birthday: input.birthday ?? null,
        gender: input.gender,
        avatarKey: input.avatarKey ?? null,
        avatarUrl: input.avatarUrl ?? null,
        professionalEmail: input.professionalEmail,
        phone: input.phone ?? null,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        status: input.status,
        isReferentRH: input.isReferentRH,
        locationId: input.locationId ?? null,
        positionId: validated.primaryPositionId,
      },
      select: { id: true },
    });

    await syncMemberAssignments(
      tx,
      created.id,
      validated.assignments,
      validated.primaryPositionId,
    );

    return created.id;
  });

  const collaborator = await getCollaboratorById(createdId);

  if (!collaborator) {
    throwPrismaLikeError("INTERNAL_ERROR", "Collaborator creation failed");
  }

  return collaborator as CollaboratorDto;
}

export async function updateCollaborator(
  id: number,
  input: UpdateCollaboratorInput,
): Promise<CollaboratorDto> {
  const existing = (await prismaClient.member.findUnique({
    where: { id },
    select: {
      id: true,
      positionAssignments: {
        select: {
          positionId: true,
          isPrimary: true,
        },
      },
    },
  })) as {
    id: number;
    positionAssignments: Array<{
      positionId: number;
      isPrimary: boolean;
    }>;
  } | null;

  if (!existing) {
    throwPrismaLikeError("P2025", "Collaborateur introuvable");
  }

  const data: Record<string, unknown> = {};

  if (input.serviceCode !== undefined) data.serviceCode = input.serviceCode;
  if (input.firstname !== undefined) data.firstname = input.firstname;
  if (input.lastname !== undefined) data.lastname = input.lastname;
  if (input.birthday !== undefined) data.birthday = input.birthday;
  if (input.gender !== undefined) data.gender = input.gender;
  if (input.avatarKey !== undefined) data.avatarKey = input.avatarKey;
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;
  if (input.professionalEmail !== undefined) {
    data.professionalEmail = input.professionalEmail;
  }
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.startDate !== undefined) data.startDate = input.startDate;
  if (input.endDate !== undefined) data.endDate = input.endDate;
  if (input.status !== undefined) data.status = input.status;
  if (input.isReferentRH !== undefined) data.isReferentRH = input.isReferentRH;
  if (input.locationId !== undefined) data.locationId = input.locationId;

  const parsedAssignments = parseAssignmentInput(input);

  let assignmentPayload: AssignmentInput | null = null;

  if (parsedAssignments) {
    if (
      parsedAssignments.positionIds.length === 0 &&
      input.positionIds === undefined &&
      input.positionId === undefined &&
      input.primaryPositionId !== undefined
    ) {
      assignmentPayload = {
        positionIds: existing!.positionAssignments.map(
          (item: { positionId: number }) => item.positionId,
        ),
        primaryPositionId: parsedAssignments.primaryPositionId,
      };
    } else {
      assignmentPayload = parsedAssignments;
    }
  }

  let validatedAssignments = null as {
    assignments: ValidatedAssignment[];
    primaryPositionId: number | null;
  } | null;

  if (assignmentPayload !== null) {
    try {
      validatedAssignments = await validateAssignments(assignmentPayload, id);
    } catch (err) {
      const code = getPrismaErrorCode(err);

      // Si la validation a échoué à cause d'un poste déjà occupé, on tente
      // de libérer les occupants actuels des postes demandés puis on réessaie.
      if (code === "P2002") {
        // Récupérer les assignations existantes pour ces postes
        const occupied = (await prismaClient.memberPositionAssignment.findMany({
          where: {
            positionId: { in: assignmentPayload.positionIds },
            memberId: { not: id },
          },
          select: { memberId: true },
        })) as Array<{ memberId: number }>;

        const toUnassign = Array.from(new Set(occupied.map((o) => o.memberId)));

        if (toUnassign.length > 0) {
          await prismaClient.$transaction(async (tx) => {
            // Supprimer les assignations pour ces membres
            await tx.memberPositionAssignment.deleteMany({
              where: { memberId: { in: toUnassign } },
            });

            // Réinitialiser leur position primaire
            await Promise.all(
              toUnassign.map((memberId) =>
                tx.member.update({
                  where: { id: memberId },
                  data: { positionId: null },
                  select: { id: true },
                }),
              ),
            );
          });

          // Retenter la validation maintenant que les postes sont libérés
          validatedAssignments = await validateAssignments(
            assignmentPayload,
            id,
          );
        } else {
          // Pas d'occupant détecté, réémettre l'erreur initiale
          throw err;
        }
      } else {
        throw err;
      }
    }
  }

  await prismaClient.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.member.update({
        where: { id },
        data,
        select: { id: true },
      });
    }

    if (validatedAssignments) {
      await syncMemberAssignments(
        tx,
        id,
        validatedAssignments.assignments,
        validatedAssignments.primaryPositionId,
      );
    }
  });

  const collaborator = await getCollaboratorById(id);

  if (!collaborator) {
    throwPrismaLikeError("P2025", "Collaborateur introuvable");
  }

  return collaborator as CollaboratorDto;
}

export async function deleteCollaborator(id: number) {
  await prismaClient.member.delete({
    where: { id },
  });
}
