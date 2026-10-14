import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isPaymentToken, PAYMENT_COOKIE } from "@/lib/payments";
import { defaultPaymentDeps, getPlayerPayment } from "@/lib/paymentService";
import styles from "./betaald.module.css";

export const metadata: Metadata = { title: "Betaling — Eenarmige Bandiet" };

// Hier stuurt Mollie de speler na het betalen naartoe (redirectUrl).
// Zelfde browser als het spel (cookie): betaald → meteen terug naar het spel.
// Betaald met een telefoon via de QR-code: die heeft geen cookie, dus alleen een bedankje;
// de gokkast ziet de betaling zelf.
export default async function Betaald() {
  await connection();
  const deps = defaultPaymentDeps();
  if (!deps) redirect("/");

  const token = (await cookies()).get(PAYMENT_COOKIE)?.value;
  const payment = await getPlayerPayment(isPaymentToken(token) ? token : undefined, deps);
  if (payment.status === "paid") redirect("/");

  const failed = ["canceled", "expired", "failed"].includes(payment.status);
  const [title, text] =
    payment.status === "none"
      ? ["Bedankt!", "Ga terug naar de gokkast. Zodra je betaling binnen is, staan je spelletjes daar klaar."]
      : failed
        ? ["Betaling niet gelukt", "Er is niets afgeschreven. Ga terug naar het spel om het opnieuw te proberen."]
        : ["Betaling wordt verwerkt", "Dit duurt meestal maar even. Ga terug naar het spel; je spelletjes verschijnen vanzelf."];

  return (
    <main className={styles.screen}>
      <div className={styles.card} data-testid="betaald" data-status={payment.status}>
        <h1 className={styles.title}>{title}</h1>
        <p>{text}</p>
        <Link className={styles.button} href="/">
          Terug naar het spel
        </Link>
      </div>
    </main>
  );
}
