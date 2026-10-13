// Inloggen voor de game-manager met Auth.js (Google OAuth).
// Sleutels uit de omgeving: AUTH_SECRET, AUTH_GOOGLE_ID en AUTH_GOOGLE_SECRET (zie .env.example).
// De sessie is een versleutelde JWT in een cookie; er zijn geen extra databasetabellen nodig.
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAdmin } from "@/lib/admins";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/game-manager/inloggen",
    error: "/game-manager/inloggen", // bijv. ?error=AccessDenied voor een niet-beheerder
  },
  callbacks: {
    // Alleen beheerders met een door Google bevestigd adres krijgen een sessie.
    // De pagina controleert het daarna zelf nog eens (zie lib/dal.ts).
    signIn({ profile }) {
      return profile?.email_verified === true && isAdmin(profile.email);
    },
  },
});
