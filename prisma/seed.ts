import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./src/generated/prisma/client";

import demoData from "../src/lib/demo-3-depts.json";

type DemoDepartment = {
  id: number;
  name: string;
};

type DemoSector = {
  id: number;
  name: string;
  departmentId: number;
};

type DemoPosition = {
  id: number;
  name: string;
  type:
    | "DIRECTEUR"
    | "SOUS_DIRECTEUR"
    | "CHEF_SERVICE"
    | "RESPONSABLE"
    | "COLLABORATEUR"
    | "ASSISTANT";
  sectorId: number;
  parentPositionId: number | null;
};

type DemoMember = {
  id: number;
  serviceCode: string;
  firstname: string;
  lastname: string;
  gender: "HOMME" | "FEMME" | "AUTRE";
  professionalEmail: string;
  phone: string;
  startDate: string;
  status: "ACTIF" | "INACTIF" | "SUSPENDU";
  isReferentRH: boolean;
  positionId: number;
};

type DemoData = {
  departments: DemoDepartment[];
  sectors: DemoSector[];
  positions: DemoPosition[];
  members: DemoMember[];
};

type SeedLocation = {
  id: number;
  name: string;
};

type SeedTransaction = {
  memberPositionAssignment: {
    deleteMany: (args?: unknown) => Promise<unknown>;
    createMany: (args: unknown) => Promise<unknown>;
  };
  member: {
    deleteMany: (args?: unknown) => Promise<unknown>;
    createMany: (args: unknown) => Promise<unknown>;
  };
  position: {
    deleteMany: (args?: unknown) => Promise<unknown>;
    createMany: (args: unknown) => Promise<unknown>;
  };
  location: {
    deleteMany: (args?: unknown) => Promise<unknown>;
    createMany: (args: unknown) => Promise<unknown>;
  };
  sector: {
    deleteMany: (args?: unknown) => Promise<unknown>;
    createMany: (args: unknown) => Promise<unknown>;
  };
  department: {
    deleteMany: (args?: unknown) => Promise<unknown>;
    createMany: (args: unknown) => Promise<unknown>;
  };
};

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

const typedDemoData = demoData as DemoData;

async function main() {
  const locations: SeedLocation[] = [
    { id: 1, name: "Siège Paris" },
    { id: 2, name: "Site Lyon" },
    { id: 3, name: "Site Toulouse" },
  ];

  const departments = typedDemoData.departments;
  const sectors = typedDemoData.sectors;
  const positions = typedDemoData.positions;
  const members = typedDemoData.members;

  const sectorByPositionId = new Map<number, number>();
  for (const position of positions) {
    sectorByPositionId.set(position.id, position.sectorId);
  }

  await prisma.$transaction(async (transactionAny) => {
    const transaction = transactionAny as unknown as SeedTransaction;

    await transaction.memberPositionAssignment.deleteMany();
    await transaction.member.deleteMany();
    await transaction.position.deleteMany();
    await transaction.location.deleteMany();
    await transaction.sector.deleteMany();
    await transaction.department.deleteMany();

    await transaction.department.createMany({
      data: departments.map((department) => ({
        id: department.id,
        name: department.name,
      })),
      skipDuplicates: true,
    });

    await transaction.sector.createMany({
      data: sectors.map((sector) => ({
        id: sector.id,
        name: sector.name,
        departmentId: sector.departmentId,
      })),
      skipDuplicates: true,
    });

    await transaction.location.createMany({
      data: locations,
      skipDuplicates: true,
    });

    await transaction.position.createMany({
      data: positions.map((position) => ({
        id: position.id,
        name: position.name,
        type: position.type,
        isPrimary: position.type === "DIRECTEUR",
        jobDetails: [
          `Missions principales du poste ${position.name}`,
          `Compétences attendues pour ${position.type}`,
        ],
        sectorId: position.sectorId,
        parentPositionId: position.parentPositionId,
        lastMobility: new Date("2025-01-15T08:00:00.000Z"),
      })),
      skipDuplicates: true,
    });

    await transaction.member.createMany({
      data: members.map((member, index) => {
        const startDate = new Date(member.startDate);
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 5);

        return {
          id: member.id,
          serviceCode: member.serviceCode,
          firstname: member.firstname,
          lastname: member.lastname,
          birthday: new Date(
            1980 + (index % 20),
            (index % 12) + 1,
            (index % 27) + 1,
          ),
          gender: member.gender,
          avatarUrl: `https://i.pravatar.cc/150?img=${(index % 70) + 1}`,
          professionalEmail: member.professionalEmail,
          phone: member.phone,
          startDate,
          endDate,
          status: member.status,
          isReferentRH: member.isReferentRH,
          locationId: locations[index % locations.length].id,
          positionId: member.positionId,
        };
      }),
      skipDuplicates: true,
    });

    // Construire les assignations initiales (poste principal) puis ajouter
    // des assignations secondaires pour certains membres lorsque c'est possible.
    const takenPositionIds = new Set<number>(members.map((m) => m.positionId));

    const assignments: Array<{
      memberId: number;
      positionId: number;
      sectorId: number;
      isPrimary: boolean;
      assignedAt: Date;
    }> = [];

    // Ajout des assignations principales
    for (const member of members) {
      const sectorId = sectorByPositionId.get(member.positionId);

      if (!sectorId) {
        throw new Error(
          `Poste ${member.positionId} introuvable pour le membre ${member.id}`,
        );
      }

      assignments.push({
        memberId: member.id,
        positionId: member.positionId,
        sectorId,
        isPrimary: true,
        assignedAt: new Date(member.startDate),
      });
    }

    // Tentative d'ajout d'assignations secondaires pour certains membres.
    // Règles simples : pour chaque 5ème membre (id % 5 === 0), essayer d'affecter
    // un poste non pris et appartenant à un secteur différent.
    const freePositions = positions.filter((p) => !takenPositionIds.has(p.id));

    for (const member of members) {
      if (member.id % 5 !== 0) continue;

      const currentSector = sectorByPositionId.get(member.positionId);
      if (!currentSector) continue;

      const candidate = freePositions.find((p) => {
        const s = sectorByPositionId.get(p.id);
        return s !== undefined && s !== currentSector;
      });

      if (!candidate) continue;

      // Marquer la position comme prise pour éviter double affectation
      takenPositionIds.add(candidate.id);

      const candidateSector = sectorByPositionId.get(candidate.id)!;

      assignments.push({
        memberId: member.id,
        positionId: candidate.id,
        sectorId: candidateSector,
        isPrimary: false,
        assignedAt: new Date(member.startDate),
      });
    }

    await transaction.memberPositionAssignment.createMany({
      data: assignments,
      skipDuplicates: true,
    });
  });

  console.log(
    "✅ Seed terminé : departments, sectors, locations, positions, members, member_position_assignment",
  );
}

main()
  .catch((error) => {
    console.error("❌ Erreur pendant le seed :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
