import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

let prisma: PrismaClient | null = null;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required before using the database client.");
  }

  prisma ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  return prisma;
}
