// Instellingen uit de database lezen, met .env als terugval (alleen op de server).
import { getDb } from "@/lib/db";
import { mergeSettings, readSettings, type GameSettings, type SettingsRow } from "@/lib/settings";

// Zo lang mag de database erover doen (Neon kan na een pauze even nodig hebben om te starten)
export const DB_TIMEOUT_MS = 5000;

export type FetchSettingsRow = () => Promise<SettingsRow | null>;

// De rij met id 1 uit game_settings; null als er geen database is ingesteld
function fetchFromDb(): FetchSettingsRow | null {
  const db = getDb();
  if (!db) return null;
  return () =>
    db.gameSettings.findUnique({
      where: { id: 1 },
      select: { odds: true, maxTries: true, roundsPerPayment: true },
    });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`geen antwoord binnen ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Database → anders .env → anders de vaste standaard. Een databasefout stopt het spel niet.
export async function loadSettings(
  fetchRow: FetchSettingsRow | null = fetchFromDb(),
  env: Record<string, string | undefined> = process.env,
  timeoutMs = DB_TIMEOUT_MS,
): Promise<GameSettings> {
  const defaults = readSettings(env);
  if (!fetchRow) return { ...defaults, source: "env" };
  try {
    return mergeSettings(await withTimeout(fetchRow(), timeoutMs), defaults);
  } catch (error) {
    console.warn("Instellingen niet uit de database gelezen, .env wordt gebruikt:", error);
    return { ...defaults, source: "env" };
  }
}
