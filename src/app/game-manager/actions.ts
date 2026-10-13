"use server";

// Inloggen en uitloggen voor de game-manager (formulieren op de pagina's)
import { signIn, signOut } from "@/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/game-manager" });
}

export async function signOutAdmin() {
  await signOut({ redirectTo: "/game-manager/inloggen" });
}
