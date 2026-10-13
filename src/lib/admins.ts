// Beheerders van de game-manager: e-mailadressen in GAME_MANAGER_ADMINS (zie .env.example),
// gescheiden door komma's, puntkomma's of spaties. Lege of ontbrekende lijst → niemand.

type Env = Record<string, string | undefined>;

// " Jan@Example.com, piet@example.com " → ["jan@example.com", "piet@example.com"]
export function parseAdminEmails(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes("@"));
}

export function isAdmin(email: string | null | undefined, env: Env = process.env): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return parseAdminEmails(env.GAME_MANAGER_ADMINS).includes(normalized);
}
