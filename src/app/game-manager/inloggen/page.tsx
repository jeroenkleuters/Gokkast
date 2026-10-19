import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admins";
import { signInWithGoogle } from "../actions";
import styles from "../game-manager.module.css";

// Foutcodes die Auth.js meegeeft in ?error=
function errorMessage(error: string | undefined): string | null {
  if (!error) return null;
  if (error === "AccessDenied") return "Geen toegang: dit Google-account staat niet in de lijst met beheerders.";
  return "Inloggen is mislukt. Probeer het opnieuw.";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Al ingelogd als beheerder → direct door
  const session = await auth();
  if (isAdmin(session?.user?.email)) redirect("/game-manager");

  const error = (await searchParams).error;
  const message = errorMessage(Array.isArray(error) ? error[0] : error);

  return (
    <>
      <h1 className={styles.title}>Game-manager</h1>
      <section className={styles.card}>
        <h2>Inloggen</h2>
        <p className={styles.muted}>Alleen voor beheerders van Jackpot.</p>
        {message && (
          <p className={styles.error} role="alert">
            {message}
          </p>
        )}
        <form action={signInWithGoogle}>
          <button type="submit" className={styles.button}>
            Inloggen met Google
          </button>
        </form>
      </section>
      <p>
        <Link href="/" className={styles.link}>
          Naar het spel
        </Link>
      </p>
    </>
  );
}
