import Link from "next/link";
import { checkAdmin } from "@/lib/dal";
import { signOutAdmin } from "./actions";
import styles from "./game-manager.module.css";

function SignOutButton() {
  return (
    <form action={signOutAdmin}>
      <button type="submit" className={`${styles.button} ${styles.secondary}`}>
        Uitloggen
      </button>
    </form>
  );
}

export default async function GameManagerPage() {
  // Zonder sessie stuurt checkAdmin door naar /game-manager/inloggen
  const admin = await checkAdmin();

  if (admin.status === "forbidden") {
    return (
      <>
        <h1 className={styles.title}>Game-manager</h1>
        <p className={styles.error} role="alert">
          Geen toegang: {admin.email} staat niet in de lijst met beheerders.
        </p>
        <SignOutButton />
      </>
    );
  }

  return (
    <>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Game-manager</h1>
          <p className={styles.muted}>
            Ingelogd als {admin.name ? `${admin.name} (${admin.email})` : admin.email}
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className={styles.card}>
        <h2>Moeilijkheidsgraad</h2>
        <p className={styles.muted}>De winkans instellen komt hier (taak 9).</p>
      </section>

      <section className={styles.card}>
        <h2>Speelrondes en statistieken</h2>
        <p className={styles.muted}>Overzicht van speelrondes en wins/loses per naam komt hier (taak 13).</p>
      </section>

      <section className={styles.card}>
        <h2>Betalingen</h2>
        <p className={styles.muted}>Overzicht van betalingen komt hier (taak 14).</p>
      </section>

      <p>
        <Link href="/" className={styles.link}>
          Naar het spel
        </Link>
      </p>
    </>
  );
}
