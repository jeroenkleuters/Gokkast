import Link from "next/link";
import { checkAdmin } from "@/lib/dal";
import { parseManagerQuery } from "@/lib/managerQuery";
import { mergeSettings, readSettings } from "@/lib/settings";
import { readStoredSettings } from "@/lib/settingsStore";
import { signOutAdmin } from "./actions";
import ManagerTabs from "./ManagerTabs";
import PaymentsSection from "./PaymentsSection";
import SettingsForm from "./SettingsForm";
import StatsSection from "./StatsSection";
import styles from "./game-manager.module.css";

async function DifficultySection() {
  const defaults = readSettings();
  const stored = await readStoredSettings();
  const row = stored.status === "ok" ? stored.row : null;
  const current = mergeSettings(row, defaults);

  return (
    <section className={styles.card} aria-labelledby="moeilijkheidsgraad">
      <h2 id="moeilijkheidsgraad">Moeilijkheidsgraad</h2>
      <p className={styles.muted} data-testid="current-settings">
        Nu in het spel: winkans 1 op {current.odds}, {current.maxTries} pogingen, {current.roundsPerPayment}{" "}
        speelronde(s) per betaling (bron: {current.source === "database" ? "database" : ".env"}).
      </p>
      {stored.status === "no-database" && (
        <p className={styles.error} role="alert">
          Er is geen database ingesteld (DATABASE_URL): het spel gebruikt de waarden uit .env en opslaan lukt
          hier niet.
        </p>
      )}
      {stored.status === "error" ? (
        // Geen formulier: lege velden zouden bij opslaan alles terugzetten naar de standaard
        <p className={styles.error} role="alert">
          De database is nu niet bereikbaar: het spel gebruikt de waarden uit .env. Probeer het later opnieuw.
        </p>
      ) : (
        <SettingsForm row={row} defaults={defaults} />
      )}
    </section>
  );
}

function SignOutButton() {
  return (
    <form action={signOutAdmin}>
      <button type="submit" className={`${styles.button} ${styles.secondary}`}>
        Uitloggen
      </button>
    </form>
  );
}

export default async function GameManagerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  const query = parseManagerQuery(await searchParams);

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

      <ManagerTabs
        tabs={[
          { id: "moeilijkheidsgraad", label: "Moeilijkheidsgraad", content: <DifficultySection /> },
          { id: "speelrondes", label: "Speelrondes", content: <StatsSection query={query} /> },
          { id: "betalingen", label: "Betalingen", content: <PaymentsSection query={query} /> },
        ]}
      />

      <p>
        <Link href="/" className={styles.link}>
          Naar het spel
        </Link>
      </p>
    </>
  );
}
