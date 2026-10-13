import { beforeEach, describe, expect, it, vi } from "vitest";

// De server action zonder Next.js, Auth.js of database: alleen de beslissingen testen
// (toegang, controle, opslaan, verversen). De losse onderdelen hebben eigen tests.
const checkAdmin = vi.fn();
const saveStoredSettings = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/dal", () => ({ checkAdmin }));
vi.mock("@/lib/settingsStore", () => ({ saveStoredSettings }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));

const { updateSettings } = await import("./actions");

const idle = { status: "idle" } as const;
const admin = { status: "admin", email: "beheerder@example.test", name: null };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("updateSettings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    checkAdmin.mockResolvedValue(admin);
    saveStoredSettings.mockResolvedValue("saved");
  });

  it("slaat geldige waarden op en ververst het spel en de game-manager", async () => {
    const state = await updateSettings(idle, form({ odds: "100", maxTries: "4", roundsPerPayment: "" }));

    expect(state.status).toBe("saved");
    expect(saveStoredSettings).toHaveBeenCalledWith({ odds: 100, maxTries: 4, roundsPerPayment: null });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/game-manager");
  });

  it("slaat lege velden op als null (terug naar standaard)", async () => {
    await updateSettings(idle, form({ odds: "", maxTries: "", roundsPerPayment: "" }));

    expect(saveStoredSettings).toHaveBeenCalledWith({ odds: null, maxTries: null, roundsPerPayment: null });
  });

  it("slaat niets op voor een niet-beheerder", async () => {
    checkAdmin.mockResolvedValue({ status: "forbidden", email: "iemand@example.test" });

    const state = await updateSettings(idle, form({ odds: "1" }));

    expect(state).toEqual({ status: "error", message: "Geen toegang." });
    expect(saveStoredSettings).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("slaat niets op zonder sessie (checkAdmin stuurt door naar inloggen)", async () => {
    checkAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(updateSettings(idle, form({ odds: "1" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(saveStoredSettings).not.toHaveBeenCalled();
  });

  it("geeft per veld een fout bij ongeldige invoer en slaat niets op", async () => {
    const state = await updateSettings(idle, form({ odds: "0", maxTries: "9", roundsPerPayment: "2" }));

    expect(state.status).toBe("invalid");
    expect(Object.keys(state.errors ?? {}).sort()).toEqual(["maxTries", "odds"]);
    expect(saveStoredSettings).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["no-database", "Niet opgeslagen: er is geen database ingesteld."],
    ["error", "Niet opgeslagen: de database gaf een fout. Probeer het opnieuw."],
  ])("meldt %s zonder te verversen", async (result, message) => {
    saveStoredSettings.mockResolvedValue(result);

    expect(await updateSettings(idle, form({ odds: "30" }))).toEqual({ status: "error", message });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
