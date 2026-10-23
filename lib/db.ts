import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

const prismaGlobal = globalThis as typeof globalThis & { itfReimbursementPrisma?: PrismaClient };

function poolSize() {
  const configured = process.env.DATABASE_POOL_MAX;
  const size = configured === undefined ? 1 : Number(configured);
  if (!Number.isInteger(size) || size < 1 || size > 10) {
    throw new Error("DATABASE_POOL_MAX must be a whole number between 1 and 10.");
  }
  return size;
}

export function getDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required before using the database client.");
  }

  prismaGlobal.itfReimbursementPrisma ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: poolSize(),
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
    }),
  });

  return prismaGlobal.itfReimbursementPrisma;
}
