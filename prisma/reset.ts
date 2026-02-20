import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./src/generated/prisma/client";

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

async function main() {
  await prisma.$transaction(async (transactionAny) => {
    const transaction = transactionAny as unknown as SeedTransaction;

    await transaction.memberPositionAssignment.deleteMany();
    await transaction.member.deleteMany();
    await transaction.position.deleteMany();
    await transaction.location.deleteMany();
    await transaction.sector.deleteMany();
    await transaction.department.deleteMany();
  });

  console.log("✅ Réinitialisation terminée");
}

main()
  .catch((error) => {
    console.error("❌ Erreur pendant la réinitialisation :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
