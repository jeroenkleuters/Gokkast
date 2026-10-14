import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isFinalStatus, isPaymentToken, PAYMENT_COOKIE, type PaymentStatus } from "@/lib/payments";
import { defaultPaymentDeps, getPlayerPayment, getReturnPayment } from "@/lib/paymentService";
import styles from "./betaald.module.css";

export const metadata: Metadata = { title: "Betaling — Eenarmige Bandiet" };

const REFRESH_SECONDS = 3; // zolang de betaling nog verwerkt wordt

// Hier stuurt Mollie de speler na het betalen naartoe (redirectUrl, met ?ref= van de betaling).
// Zelfde browser als het spel (cookie): betaald → meteen terug naar het spel.
// Betaald met een telefoon via de QR-code: die heeft geen cookie; de referentie laat zien of
// het gelukt is en wat er betaald is. De gokkast ziet de betaling zelf.
export default async function Betaald({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  await connection();
  const deps = defaultPaymentDeps();
  if (!deps) redirect("/");

  const token = (await cookies()).get(PAYMENT_COOKIE)?.value;
  const own = await getPlayerPayment(isPaymentToken(token) ? token : undefined, deps);
  if (own.status === "paid") redirect("/");

  const { ref } = await searchParams;
  const returned = await getReturnPayment(typeof ref === "string" ? ref : undefined, deps);
  const status: PaymentStatus | "none" = returned?.status ?? own.status;
  const sameBrowser = own.status !== "none"; // dan kan de speler hier terug naar het spel

  const failed = ["canceled", "expired", "failed"].includes(status);
  const [title, text] =
    status === "paid" && returned
      ? [
          "Betaald!",
          `${returned.amount} is betaald voor ${returned.credits} ${returned.credits === 1 ? "spel" : "spelletjes"}. Ga terug naar de gokkast: je spelletjes staan klaar.`,
        ]
      : status === "none"
        ? ["Bedankt!", "Ga terug naar de gokkast. Zodra je betaling binnen is, staan je spelletjes daar klaar."]
        : failed
          ? ["Betaling niet gelukt", "Er is niets afgeschreven. Ga terug naar de gokkast om het opnieuw te proberen."]
          : ["Betaling wordt verwerkt", "Dit duurt meestal maar even. Deze pagina ververst vanzelf."];
  const waiting = status !== "none" && !isFinalStatus(status);

  return (
    <main className={styles.screen}>
      {waiting && <meta httpEquiv="refresh" content={String(REFRESH_SECONDS)} />}
      <div className={styles.card} data-testid="betaald" data-status={status}>
        {status === "paid" && (
          <div className={styles.check} aria-hidden="true">
            ✓
          </div>
        )}
        <h1 className={styles.title}>{title}</h1>
        <p>{text}</p>
        {(sameBrowser || !returned) && (
          <Link className={styles.button} href="/">
            Terug naar het spel
          </Link>
        )}
      </div>
    </main>
  );
}
