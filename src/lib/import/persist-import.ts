import "server-only";

import prisma from "@/src/lib/prisma";
import type { ImportPayloadInput } from "@/src/lib/import/persist-schemas";
import type {
  ImportPersistPhase,
  ImportPersistResult,
} from "@/src/types/import";

type ValidationIssue = {
  path: Array<string | number>;
  message: string;
};

type PrismaIdRow = { id: number };
type PrismaCreateManyResult = { count: number };

type LocationRow = { id: number; name: string };
type DepartmentRow = { id: number; name: string };
type SectorRow = { id: number; name: string; departmentId: number };
type PositionRow = { id: number; name: string; sectorId: number };
type MemberRow = { id: number; serviceCode: string };

type LocationDelegate = {
  findUnique: (args: unknown) => Promise<PrismaIdRow | null>;
  findMany: (args: unknown) => Promise<LocationRow[]>;
  createMany: (args: unknown) => Promise<PrismaCreateManyResult>;
  create: (args: unknown) => Promise<PrismaIdRow>;
};

type DepartmentDelegate = {
  findUnique: (args: unknown) => Promise<PrismaIdRow | null>;
  findMany: (args: unknown) => Promise<DepartmentRow[]>;
  createMany: (args: unknown) => Promise<PrismaCreateManyResult>;
  create: (args: unknown) => Promise<PrismaIdRow>;
};

type SectorDelegate = {
  findFirst: (args: unknown) => Promise<PrismaIdRow | null>;
  findMany: (args: unknown) => Promise<SectorRow[]>;
  createMany: (args: unknown) => Promise<PrismaCreateManyResult>;
  create: (args: unknown) => Promise<PrismaIdRow>;
};

type PositionDelegate = {
  findFirst: (args: unknown) => Promise<PrismaIdRow | null>;
  findMany: (args: unknown) => Promise<PositionRow[]>;
  createMany: (args: unknown) => Promise<PrismaCreateManyResult>;
  update: (args: unknown) => Promise<PrismaIdRow>;
  create: (args: unknown) => Promise<PrismaIdRow>;
  updateMany: (args: unknown) => Promise<unknown>;
};

type MemberDelegate = {
  findUnique: (args: unknown) => Promise<PrismaIdRow | null>;
  findMany: (args: unknown) => Promise<MemberRow[]>;
  createMany: (args: unknown) => Promise<PrismaCreateManyResult>;
  create: (args: unknown) => Promise<PrismaIdRow>;
  update: (args: unknown) => Promise<PrismaIdRow>;
  updateMany: (args: unknown) => Promise<unknown>;
};

type MemberPositionAssignmentDelegate = {
  deleteMany: (args: unknown) => Promise<unknown>;
  createMany: (args: unknown) => Promise<unknown>;
};

type PrismaClientLike = {
  location: LocationDelegate;
  department: DepartmentDelegate;
  sector: SectorDelegate;
  position: PositionDelegate;
  member: MemberDelegate;
  memberPositionAssignment: MemberPositionAssignmentDelegate;
  $transaction: <T>(
    fn: (tx: PrismaClientLike) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
    },
  ) => Promise<T>;
};

const prismaClient = prisma as unknown as PrismaClientLike;

const dedupeValues = (values: string[]) => Array.from(new Set(values));
const makeSectorKey = (departmentId: number, name: string) =>
  `${departmentId}::${name}`;
const makePositionKey = (sectorId: number, name: string) =>
  `${sectorId}::${name}`;
const CREATE_MANY_CHUNK_SIZE = 500;

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (items.length === 0) return [];

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const executeCreateManyInChunks = async <T>(
  items: T[],
  runner: (chunk: T[]) => Promise<unknown>,
) => {
  const chunks = chunkArray(items, CREATE_MANY_CHUNK_SIZE);

  for (const chunk of chunks) {
    await runner(chunk);
  }
};

type PersistImportProgressCallback = (input: {
  phase: ImportPersistPhase;
  progress: number;
  message?: string;
}) => void;

type PersistImportOptions = {
  onProgress?: PersistImportProgressCallback;
};

const emitProgress = (
  onProgress: PersistImportProgressCallback | undefined,
  phase: ImportPersistPhase,
  progress: number,
  message: string,
) => {
  if (!onProgress) return;

  onProgress({
    phase,
    progress,
    message,
  });
};

export const validateImportPayloadRefs = (
  payload: ImportPayloadInput,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  const departmentIds = new Set(
    payload.departments.map((item) => item._tempId),
  );
  const sectorIds = new Set(payload.sectors.map((item) => item._tempId));
  const positionIds = new Set(payload.positions.map((item) => item._tempId));
  const locationIds = new Set(payload.locations.map((item) => item._tempId));

  payload.sectors.forEach((sector, index) => {
    if (!departmentIds.has(sector.departmentRef)) {
      issues.push({
        path: ["payload", "sectors", index, "departmentRef"],
        message: "Référence de département introuvable dans le payload.",
      });
    }
  });

  payload.positions.forEach((position, index) => {
    if (!sectorIds.has(position.sectorRef)) {
      issues.push({
        path: ["payload", "positions", index, "sectorRef"],
        message: "Référence de secteur introuvable dans le payload.",
      });
    }

    if (
      position.parentPositionRef &&
      !positionIds.has(position.parentPositionRef)
    ) {
      issues.push({
        path: ["payload", "positions", index, "parentPositionRef"],
        message: "Référence de poste parent introuvable dans le payload.",
      });
    }
  });

  payload.members.forEach((member, index) => {
    if (!locationIds.has(member.locationRef)) {
      issues.push({
        path: ["payload", "members", index, "locationRef"],
        message: "Référence de localisation introuvable dans le payload.",
      });
    }

    member.positionRefs.forEach((positionRef, refIndex) => {
      if (!positionIds.has(positionRef)) {
        issues.push({
          path: ["payload", "members", index, "positionRefs", refIndex],
          message: "Référence de poste introuvable dans le payload.",
        });
      }
    });

    if (member.primaryPositionRef && !positionIds.has(member.primaryPositionRef)) {
      issues.push({
        path: ["payload", "members", index, "primaryPositionRef"],
        message: "Référence de poste principal introuvable dans le payload.",
      });
    }

    if (
      member.primaryPositionRef &&
      !member.positionRefs.includes(member.primaryPositionRef)
    ) {
      issues.push({
        path: ["payload", "members", index, "primaryPositionRef"],
        message:
          "Le poste principal doit aussi être présent dans la liste des postes assignés.",
      });
    }

    if (member.endDate && member.endDate < member.startDate) {
      issues.push({
        path: ["payload", "members", index, "endDate"],
        message:
          "La date de fin ne peut pas être antérieure à la date de début.",
      });
    }
  });

  return issues;
};

export async function persistImportPayload(
  payload: ImportPayloadInput,
  options?: PersistImportOptions,
): Promise<ImportPersistResult> {
  const onProgress = options?.onProgress;

  emitProgress(onProgress, "queued", 1, "Préparation de l'import.");

  return prismaClient.$transaction(
    async (tx) => {
      const result: ImportPersistResult = {
        locations: { created: 0, updated: 0 },
        departments: { created: 0, updated: 0 },
        sectors: { created: 0, updated: 0 },
        positions: { created: 0, updated: 0 },
        members: { created: 0, updated: 0 },
      };

      const locationIdByTempId = new Map<string, number>();
      const departmentIdByTempId = new Map<string, number>();
      const sectorIdByTempId = new Map<string, number>();
      const positionIdByTempId = new Map<string, number>();
      const positionSectorIdById = new Map<number, number>();

      emitProgress(
        onProgress,
        "locations",
        5,
        "Synchronisation des localisations...",
      );

      const locationNames = dedupeValues(
        payload.locations.map((item) => item.name),
      );
      const existingLocations =
        locationNames.length > 0
          ? await tx.location.findMany({
              where: { name: { in: locationNames } },
              select: { id: true, name: true },
            })
          : [];
      const existingLocationByName = new Map(
        existingLocations.map((item) => [item.name, item.id]),
      );
      const missingLocations = payload.locations.filter(
        (item) => !existingLocationByName.has(item.name),
      );
      if (missingLocations.length > 0) {
        const locationRows = dedupeValues(
          missingLocations.map((item) => item.name),
        ).map((name) => ({ name }));

        await executeCreateManyInChunks(locationRows, async (chunk) => {
          await tx.location.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        });
      }
      const allLocations =
        locationNames.length > 0
          ? await tx.location.findMany({
              where: { name: { in: locationNames } },
              select: { id: true, name: true },
            })
          : [];
      const allLocationByName = new Map(
        allLocations.map((item) => [item.name, item.id]),
      );
      payload.locations.forEach((item) => {
        const id = allLocationByName.get(item.name);
        if (id) {
          locationIdByTempId.set(item._tempId, id);
          if (existingLocationByName.has(item.name)) {
            result.locations.updated += 1;
          } else {
            result.locations.created += 1;
          }
        }
      });

      emitProgress(onProgress, "locations", 18, "Localisations synchronisées.");

      emitProgress(
        onProgress,
        "departments",
        20,
        "Synchronisation des départements...",
      );

      const departmentNames = dedupeValues(
        payload.departments.map((item) => item.name),
      );
      const existingDepartments =
        departmentNames.length > 0
          ? await tx.department.findMany({
              where: { name: { in: departmentNames } },
              select: { id: true, name: true },
            })
          : [];
      const existingDepartmentByName = new Map(
        existingDepartments.map((item) => [item.name, item.id]),
      );
      const missingDepartments = payload.departments.filter(
        (item) => !existingDepartmentByName.has(item.name),
      );
      if (missingDepartments.length > 0) {
        const departmentRows = dedupeValues(
          missingDepartments.map((item) => item.name),
        ).map((name) => ({ name }));

        await executeCreateManyInChunks(departmentRows, async (chunk) => {
          await tx.department.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        });
      }
      const allDepartments =
        departmentNames.length > 0
          ? await tx.department.findMany({
              where: { name: { in: departmentNames } },
              select: { id: true, name: true },
            })
          : [];
      const allDepartmentByName = new Map(
        allDepartments.map((item) => [item.name, item.id]),
      );
      payload.departments.forEach((item) => {
        const id = allDepartmentByName.get(item.name);
        if (id) {
          departmentIdByTempId.set(item._tempId, id);
          if (existingDepartmentByName.has(item.name)) {
            result.departments.updated += 1;
          } else {
            result.departments.created += 1;
          }
        }
      });

      emitProgress(onProgress, "departments", 32, "Départements synchronisés.");

      emitProgress(
        onProgress,
        "sectors",
        34,
        "Synchronisation des secteurs...",
      );

      const sectorInputs = payload.sectors.map((sector) => {
        const departmentId = departmentIdByTempId.get(sector.departmentRef);

        if (!departmentId) {
          throw new Error(
            "Référence de département invalide pendant la persistance.",
          );
        }

        return {
          tempId: sector._tempId,
          name: sector.name,
          departmentId,
          key: makeSectorKey(departmentId, sector.name),
        };
      });

      const existingSectors =
        sectorInputs.length > 0
          ? await tx.sector.findMany({
              where: {
                OR: sectorInputs.map((item) => ({
                  departmentId: item.departmentId,
                  name: item.name,
                })),
              },
              select: {
                id: true,
                name: true,
                departmentId: true,
              },
            })
          : [];
      const existingSectorByKey = new Map(
        existingSectors.map((item) => [
          makeSectorKey(item.departmentId, item.name),
          item.id,
        ]),
      );
      const missingSectorData = sectorInputs
        .filter((item) => !existingSectorByKey.has(item.key))
        .map((item) => ({
          name: item.name,
          departmentId: item.departmentId,
        }));
      if (missingSectorData.length > 0) {
        await executeCreateManyInChunks(missingSectorData, async (chunk) => {
          await tx.sector.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        });
      }
      const allSectors =
        sectorInputs.length > 0
          ? await tx.sector.findMany({
              where: {
                OR: sectorInputs.map((item) => ({
                  departmentId: item.departmentId,
                  name: item.name,
                })),
              },
              select: {
                id: true,
                name: true,
                departmentId: true,
              },
            })
          : [];
      const allSectorByKey = new Map(
        allSectors.map((item) => [
          makeSectorKey(item.departmentId, item.name),
          item.id,
        ]),
      );
      sectorInputs.forEach((item) => {
        const id = allSectorByKey.get(item.key);
        if (id) {
          sectorIdByTempId.set(item.tempId, id);
          if (existingSectorByKey.has(item.key)) {
            result.sectors.updated += 1;
          } else {
            result.sectors.created += 1;
          }
        }
      });

      emitProgress(onProgress, "sectors", 46, "Secteurs synchronisés.");

      emitProgress(
        onProgress,
        "positions",
        48,
        "Synchronisation des postes...",
      );

      const positionInputs = payload.positions.map((position) => {
        const sectorId = sectorIdByTempId.get(position.sectorRef);

        if (!sectorId) {
          throw new Error(
            "Référence de secteur invalide pendant la persistance.",
          );
        }

        return {
          tempId: position._tempId,
          name: position.name,
          type: position.type,
          isPrimary: position.isPrimary,
          jobDetails: position.jobDetails,
          parentPositionRef: position.parentPositionRef,
          sectorId,
          key: makePositionKey(sectorId, position.name),
        };
      });

      const existingPositions =
        positionInputs.length > 0
          ? await tx.position.findMany({
              where: {
                OR: positionInputs.map((item) => ({
                  sectorId: item.sectorId,
                  name: item.name,
                })),
              },
              select: {
                id: true,
                name: true,
                sectorId: true,
              },
            })
          : [];
      const existingPositionByKey = new Map(
        existingPositions.map((item) => [
          makePositionKey(item.sectorId, item.name),
          item.id,
        ]),
      );
      const missingPositionData = positionInputs
        .filter((item) => !existingPositionByKey.has(item.key))
        .map((item) => ({
          name: item.name,
          type: item.type,
          isPrimary: item.isPrimary,
          jobDetails: item.jobDetails,
          sectorId: item.sectorId,
          parentPositionId: null,
        }));
      if (missingPositionData.length > 0) {
        await executeCreateManyInChunks(missingPositionData, async (chunk) => {
          await tx.position.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        });
      }
      const allPositions =
        positionInputs.length > 0
          ? await tx.position.findMany({
              where: {
                OR: positionInputs.map((item) => ({
                  sectorId: item.sectorId,
                  name: item.name,
                })),
              },
              select: {
                id: true,
                name: true,
                sectorId: true,
              },
            })
          : [];
      const allPositionByKey = new Map(
        allPositions.map((item) => [
          makePositionKey(item.sectorId, item.name),
          item.id,
        ]),
      );

      for (const item of positionInputs) {
        const id = allPositionByKey.get(item.key);

        if (!id) {
          throw new Error(
            "Référence de poste invalide pendant la persistance.",
          );
        }

        positionIdByTempId.set(item.tempId, id);
        positionSectorIdById.set(id, item.sectorId);

        if (existingPositionByKey.has(item.key)) {
          result.positions.updated += 1;
        } else {
          result.positions.created += 1;
        }

        await tx.position.update({
          where: { id },
          data: {
            type: item.type,
            isPrimary: item.isPrimary,
            jobDetails: item.jobDetails,
          },
          select: { id: true },
        });
      }

      emitProgress(onProgress, "positions", 66, "Postes synchronisés.");

      emitProgress(
        onProgress,
        "positions_hierarchy",
        68,
        "Mise à jour de la hiérarchie des postes...",
      );

      for (const position of payload.positions) {
        const positionId = positionIdByTempId.get(position._tempId);

        if (!positionId) {
          throw new Error(
            "Référence de poste invalide pendant la persistance.",
          );
        }

        const parentPositionId = position.parentPositionRef
          ? (positionIdByTempId.get(position.parentPositionRef) ?? null)
          : null;

        await tx.position.update({
          where: { id: positionId },
          data: {
            parentPositionId:
              parentPositionId && parentPositionId !== positionId
                ? parentPositionId
                : null,
          },
          select: { id: true },
        });
      }

      emitProgress(
        onProgress,
        "positions_hierarchy",
        74,
        "Hiérarchie des postes synchronisée.",
      );

      emitProgress(
        onProgress,
        "members",
        76,
        "Synchronisation des collaborateurs...",
      );

      const memberInputs = payload.members.map((member) => {
        const locationId = locationIdByTempId.get(member.locationRef);

        if (!locationId) {
          throw new Error(
            "Référence de localisation invalide pendant la persistance.",
          );
        }

        const resolvedPositionIds = dedupeValues(member.positionRefs)
          .map((positionRef) => positionIdByTempId.get(positionRef))
          .filter((value): value is number => typeof value === "number");

        const primaryPositionId = member.primaryPositionRef
          ? (positionIdByTempId.get(member.primaryPositionRef) ?? null)
          : null;
        // Sécurité: si aucun principal explicite n'est défini, on conserve
        // l'ancien comportement en prenant le premier poste assigné.
        const resolvedPrimaryPositionId =
          primaryPositionId ?? resolvedPositionIds[0] ?? null;

        return {
          serviceCode: member.serviceCode,
          firstname: member.firstname,
          lastname: member.lastname,
          birthday: member.birthday,
          gender: member.gender,
          avatarUrl: member.avatarUrl,
          professionalEmail: member.professionalEmail,
          phone: member.phone,
          startDate: member.startDate,
          endDate: member.endDate,
          isReferentRH: member.isReferentRH,
          locationId,
          positionId: resolvedPrimaryPositionId,
          resolvedPositionIds,
          primaryPositionId: resolvedPrimaryPositionId,
        };
      });

      const memberServiceCodes = dedupeValues(
        memberInputs.map((item) => item.serviceCode),
      );
      const existingMembers =
        memberServiceCodes.length > 0
          ? await tx.member.findMany({
              where: { serviceCode: { in: memberServiceCodes } },
              select: { id: true, serviceCode: true },
            })
          : [];
      const existingMemberByServiceCode = new Map(
        existingMembers.map((item) => [item.serviceCode, item.id]),
      );
      const membersToCreate = memberInputs.filter(
        (item) => !existingMemberByServiceCode.has(item.serviceCode),
      );
      if (membersToCreate.length > 0) {
        const memberRows = membersToCreate.map((item) => ({
          serviceCode: item.serviceCode,
          firstname: item.firstname,
          lastname: item.lastname,
          birthday: item.birthday,
          gender: item.gender,
          avatarUrl: item.avatarUrl,
          professionalEmail: item.professionalEmail,
          phone: item.phone,
          startDate: item.startDate,
          endDate: item.endDate,
          status: "ACTIF",
          isReferentRH: item.isReferentRH,
          locationId: item.locationId,
          positionId: item.positionId,
        }));

        await executeCreateManyInChunks(memberRows, async (chunk) => {
          await tx.member.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        });
      }

      const allMembers =
        memberServiceCodes.length > 0
          ? await tx.member.findMany({
              where: { serviceCode: { in: memberServiceCodes } },
              select: { id: true, serviceCode: true },
            })
          : [];
      const memberIdByServiceCode = new Map(
        allMembers.map((item) => [item.serviceCode, item.id]),
      );

      for (const item of memberInputs) {
        const memberId = memberIdByServiceCode.get(item.serviceCode);

        if (!memberId) {
          throw new Error(
            "Référence de membre invalide pendant la persistance.",
          );
        }

        if (existingMemberByServiceCode.has(item.serviceCode)) {
          await tx.member.update({
            where: { id: memberId },
            data: {
              firstname: item.firstname,
              lastname: item.lastname,
              birthday: item.birthday,
              gender: item.gender,
              avatarUrl: item.avatarUrl,
              professionalEmail: item.professionalEmail,
              phone: item.phone,
              startDate: item.startDate,
              endDate: item.endDate,
              isReferentRH: item.isReferentRH,
              locationId: item.locationId,
              positionId: item.positionId,
            },
            select: { id: true },
          });
          result.members.updated += 1;
        } else {
          result.members.created += 1;
        }
      }

      emitProgress(onProgress, "members", 88, "Collaborateurs synchronisés.");

      emitProgress(
        onProgress,
        "assignments",
        90,
        "Synchronisation des affectations...",
      );

      const importedMemberIds = memberInputs
        .map((item) => memberIdByServiceCode.get(item.serviceCode))
        .filter((value): value is number => typeof value === "number");
      const allAssignedPositionIds = dedupeValues(
        memberInputs.flatMap((item) => item.resolvedPositionIds.map(String)),
      ).map((value) => Number(value));

      if (allAssignedPositionIds.length > 0 && importedMemberIds.length > 0) {
        await tx.memberPositionAssignment.deleteMany({
          where: {
            positionId: { in: allAssignedPositionIds },
            memberId: { notIn: importedMemberIds },
          },
        });

        await tx.member.updateMany({
          where: {
            positionId: { in: allAssignedPositionIds },
            id: { notIn: importedMemberIds },
          },
          data: { positionId: null },
        });
      }

      if (importedMemberIds.length > 0) {
        await tx.memberPositionAssignment.deleteMany({
          where: { memberId: { in: importedMemberIds } },
        });
      }

      const assignmentRows: Array<{
        memberId: number;
        positionId: number;
        sectorId: number;
        isPrimary: boolean;
      }> = [];

      for (const item of memberInputs) {
        const memberId = memberIdByServiceCode.get(item.serviceCode);

        if (!memberId || item.resolvedPositionIds.length === 0) {
          continue;
        }

        item.resolvedPositionIds.forEach((positionId) => {
          const sectorId = positionSectorIdById.get(positionId);

          if (!sectorId) {
            return;
          }

          assignmentRows.push({
            memberId,
            positionId,
            sectorId,
            isPrimary:
              item.primaryPositionId !== null &&
              positionId === item.primaryPositionId,
          });
        });
      }

      if (assignmentRows.length > 0) {
        await executeCreateManyInChunks(assignmentRows, async (chunk) => {
          await tx.memberPositionAssignment.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        });

        await tx.position.updateMany({
          where: {
            id: {
              in: dedupeValues(
                assignmentRows.map((item) => String(item.positionId)),
              ).map(Number),
            },
          },
          data: {
            lastMobility: new Date(),
          },
        });
      }

      emitProgress(onProgress, "finalizing", 97, "Finalisation de l'import...");

      return result;
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
    },
  );
}
