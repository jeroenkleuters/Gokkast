// Data Access Layer: de echte toegangscontrole voor de game-manager, op de server.
// Elke pagina en server action van de game-manager roept dit aan vóór hij data leest of wijzigt.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admins";

export type AdminCheck = { status: "admin"; email: string; name: string | null } | { status: "forbidden"; email: string };

// Geen sessie → naar de inlogpagina. Wel een sessie maar (niet meer) in de beheerderslijst → "forbidden".
// Eén keer per verzoek, ook als meerdere componenten het vragen.
export const checkAdmin = cache(async (): Promise<AdminCheck> => {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/game-manager/inloggen");
  if (!isAdmin(email)) return { status: "forbidden", email };
  return { status: "admin", email, name: session.user?.name ?? null };
});
