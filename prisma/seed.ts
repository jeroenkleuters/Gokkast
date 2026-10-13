// Seed-data voor ontwikkeling: npm run db:seed (ook na prisma migrate reset).
// Zet de instellingen op de .env-waarden en maakt een paar voorbeeldrondes als er nog geen zijn.
import { loadEnvConfig } from "@next/env";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { readSettings } from "../src/lib/settings";

loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL ontbreekt (zie .env.example)");
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

async function main() {
  const { odds, maxTries, roundsPerPayment } = readSettings();
  await prisma.gameSettings.upsert({
    where: { id: 1 },
    create: { id: 1, odds, maxTries, roundsPerPayment },
    update: { odds, maxTries, roundsPerPayment },
  });
  console.log(`game_settings: winkans 1 op ${odds}, ${maxTries} pogingen, ${roundsPerPayment} ronde(s) per betaling`);

  if ((await prisma.game.count()) === 0) {
    const day = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    await prisma.game.createMany({
      data: [
        { name: "Anna", outcome: "LOST", tries: 3, playedAt: day(3) },
        { name: "Anna", outcome: "WON", tries: 2, playedAt: day(2) },
        { name: "Bram", outcome: "LOST", tries: 3, playedAt: day(1) },
        { name: "Bram", outcome: "WON", tries: 1, playedAt: day(0) },
      ],
    });
    console.log("games: 4 voorbeeldrondes toegevoegd");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
