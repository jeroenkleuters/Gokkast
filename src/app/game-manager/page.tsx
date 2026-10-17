import Link from "next/link";
import { checkAdmin } from "@/lib/dal";
import { parseManagerQuery } from "@/lib/managerQuery";
import { readMollieConfig, readPayPalConfig } from "@/lib/payments";
import {
  mergeSettings,
  PAYMENT_PROVIDER_LABELS,
  readDefaultPaymentProvider,
  readSettings,
  type PaymentProvider,
} from "@/lib/settings";
import { readStoredSettings } from "@/lib/settingsStore";
import { signOutAdmin } from "./actions";
import ManagerTabs from "./ManagerTabs";
import PaymentsSection from "./PaymentsSection";
import SettingsForm from "./SettingsForm";
import StatsSection from "./StatsSection";
import styles from "./game-manager.module.css";

async function SettingsSection() {
  const defaults = readSettings();
  const stored = await readStoredSettings();
  const row = stored.status === "ok" ? stored.row : null;
  const current = mergeSettings(row, defaults);
  // Betaalmethode (taak 13b): welke zijn ingesteld, en welke het spel nu echt gebruikt
  const available: Record<PaymentProvider, boolean> = { mollie: !!readMollieConfig(), paypal: !!readPayPalConfig() };
  const defaultProvider = readDefaultPaymentProvider();
  const chosen = row?.paymentProvider ?? defaultProvider;
  const used: PaymentProvider | null = available[chosen] ? chosen : available.mollie ? "mollie" : available.paypal ? "paypal" : null;

  return (
    <section className={styles.card} aria-labelledby="instellingen">
      <h2 id="instellingen">Instellingen</h2>
      <p className={styles.muted} data-testid="current-settings">
        Nu in het spel: winkans 1 op {current.odds}, {current.maxTries} pogingen, {current.roundsPerPayment}{" "}
        speelronde(s) per betaling (bron: {current.source === "database" ? "database" : ".env"}).{" "}
        {used ? `Betalen met ${PAYMENT_PROVIDER_LABELS[used]}.` : "Betalen staat uit: het spel is gratis."}
      </p>
      {used && used !== chosen && (
        <p className={styles.error} role="alert">
          {PAYMENT_PROVIDER_LABELS[chosen]} is gekozen maar niet ingesteld op deze server: het spel gebruikt{" "}
          {PAYMENT_PROVIDER_LABELS[used]}.
        </p>
      )}
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
        <SettingsForm row={row} defaults={defaults} payment={{ available, defaultProvider }} />
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
          { id: "speelrondes", label: "Speelrondes", content: <StatsSection query={query} /> },
          { id: "betalingen", label: "Betalingen", content: <PaymentsSection query={query} /> },
          { id: "instellingen", label: "Instellingen", content: <SettingsSection /> },
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
