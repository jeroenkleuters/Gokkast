// Instellingen uit de database lezen (met .env als terugval) en opslaan vanuit de game-manager.
// Alleen op de server.
import { DB_TIMEOUT_MS, getDb, withTimeout } from "@/lib/db";
import { mergeSettings, readSettings, type GameSettings, type SettingsRow } from "@/lib/settings";

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

// Voor de game-manager: de ruwe rij (lege velden = standaard), zonder terugval op .env,
// zodat de pagina kan laten zien wat er in de database staat en of die bereikbaar is.
export type StoredSettings =
  | { status: "ok"; row: SettingsRow | null }
  | { status: "no-database" }
  | { status: "error" };

export async function readStoredSettings(
  fetchRow: FetchSettingsRow | null = fetchFromDb(),
  timeoutMs = DB_TIMEOUT_MS,
): Promise<StoredSettings> {
  if (!fetchRow) return { status: "no-database" };
  try {
    return { status: "ok", row: await withTimeout(fetchRow(), timeoutMs) };
  } catch (error) {
    console.warn("Instellingen niet uit de database gelezen:", error);
    return { status: "error" };
  }
}

export type SaveSettingsRow = (values: SettingsRow) => Promise<unknown>;

// Rij id 1 aanmaken of bijwerken; null in een veld = terug naar de .env-waarde
function saveToDb(): SaveSettingsRow | null {
  const db = getDb();
  if (!db) return null;
  return (values) =>
    db.gameSettings.upsert({ where: { id: 1 }, create: { id: 1, ...values }, update: values });
}

export type SaveSettingsResult = "saved" | "no-database" | "error";

export async function saveStoredSettings(
  values: SettingsRow,
  saveRow: SaveSettingsRow | null = saveToDb(),
  timeoutMs = DB_TIMEOUT_MS,
): Promise<SaveSettingsResult> {
  if (!saveRow) return "no-database";
  try {
    await withTimeout(saveRow(values), timeoutMs);
    return "saved";
  } catch (error) {
    console.error("Instellingen niet opgeslagen:", error);
    return "error";
  }
}
