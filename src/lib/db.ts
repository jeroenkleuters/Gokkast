// Prisma Client voor de app (alleen op de server), via de Neon serverless driver.
// Zonder DATABASE_URL is er geen database: getDb() geeft dan null en het spel gebruikt .env.
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

// Eén client per proces; in development blijft hij bewaard bij het herladen van modules
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb(): PrismaClient | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  globalForPrisma.prisma ??= new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  return globalForPrisma.prisma;
}
