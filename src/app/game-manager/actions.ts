"use server";

// Formulieren van de game-manager: inloggen, uitloggen en de spelinstellingen opslaan
import { revalidatePath } from "next/cache";
import { signIn, signOut } from "@/auth";
import { checkAdmin } from "@/lib/dal";
import { parseSettingsForm, type SettingsFormKey } from "@/lib/settings";
import { saveStoredSettings } from "@/lib/settingsStore";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/game-manager" });
}

export async function signOutAdmin() {
  await signOut({ redirectTo: "/game-manager/inloggen" });
}

export type SettingsFormState = {
  status: "idle" | "saved" | "invalid" | "error";
  message?: string;
  errors?: Partial<Record<SettingsFormKey, string>>;
};

export async function updateSettings(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  // Server actions zijn ook los aan te roepen: hier opnieuw controleren, niet alleen op de pagina
  const admin = await checkAdmin();
  if (admin.status !== "admin") return { status: "error", message: "Geen toegang." };

  const parsed = parseSettingsForm(formData);
  if (!parsed.ok) return { status: "invalid", message: "Niet opgeslagen: controleer de invoer.", errors: parsed.errors };

  const result = await saveStoredSettings(parsed.values);
  if (result === "no-database") return { status: "error", message: "Niet opgeslagen: er is geen database ingesteld." };
  if (result === "error") return { status: "error", message: "Niet opgeslagen: de database gaf een fout. Probeer het opnieuw." };

  // Het spel leest de instellingen per verzoek; dit ververst ook de game-manager zelf
  revalidatePath("/");
  revalidatePath("/game-manager");
  return { status: "saved", message: "Opgeslagen. Het spel gebruikt de nieuwe waarden bij het volgende laden." };
}
