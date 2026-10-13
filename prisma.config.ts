// Configuratie van de Prisma CLI (generate, migrate, seed, studio).
// Prisma laadt zelf geen .env-bestanden; @next/env laadt ze in dezelfde volgorde als Next.js
// (.env.local gaat voor .env).
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Migraties via de directe verbinding (Neon: zonder pooler); de app gebruikt DATABASE_URL.
  // Zonder variabelen (bijv. in de testjob) werkt alleen prisma generate.
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  },
});
