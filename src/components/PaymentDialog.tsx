"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { checkPayment, startPayment } from "@/app/actions";
import type { PaymentView } from "@/lib/paymentService";
import type { PaymentProvider } from "@/lib/settings";

interface PaymentDialogProps {
  price: string; // bijv. "€ 1,00", zoals bij het laden van het spel
  credits: number; // spelletjes per betaling, zoals bij het laden van het spel
  onPaid(payment: PaymentView): void;
  onClose(): void;
}

type Phase =
  | { kind: "loading" }
  | { kind: "ready"; qr: string | null; checkoutUrl: string; provider: PaymentProvider; testMode: boolean }
  | { kind: "failed"; message: string };

const POLL_MS = 3000;
const FAILED = ["canceled", "expired", "failed"];

// Popup bij speel zonder credits: QR-code van een eigen betaling voor deze speler (Mollie of PayPal).
// De popup vraagt elke paar seconden of er betaald is (bijv. met een telefoon) en geeft dan de credits door.
export default function PaymentDialog({ price: loadedPrice, credits: loadedCredits, onPaid, onClose }: PaymentDialogProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  // Prijs en spelletjes van de betaling zelf: de beheerder kan ze sinds het laden veranderd hebben
  const [offer, setOffer] = useState<{ price: string; credits: number } | null>(null);
  const price = offer?.price ?? loadedPrice;
  const credits = offer?.credits ?? loadedCredits;
  const [attempt, setAttempt] = useState(0); // "Opnieuw proberen" start een nieuwe betaling

  const paid = useEffectEvent((payment: PaymentView) => onPaid(payment));

  // Betaling starten (of de lopende betaling van deze speler tonen)
  useEffect(() => {
    let active = true;
    startPayment()
      .then((result) => {
        if (!active) return;
        if (!result.ok) return setPhase({ kind: "failed", message: result.error });
        if (result.payment.creditsLeft > 0) return paid(result.payment);
        setOffer({ price: result.price, credits: result.credits });
        if (!result.payment.checkoutUrl) throw new Error("geen betaallink");
        setPhase({
          kind: "ready",
          qr: result.qr,
          checkoutUrl: result.payment.checkoutUrl,
          provider: result.provider,
          testMode: result.testMode,
        });
      })
      .catch(() => active && setPhase({ kind: "failed", message: "Betalen lukt nu niet. Probeer het later opnieuw." }));
    return () => {
      active = false;
    };
  }, [attempt]);

  // Wachten op de betaling
  useEffect(() => {
    if (phase.kind !== "ready") return;
    const timer = setInterval(async () => {
      const payment = await checkPayment().catch(() => null);
      if (!payment) return;
      if (payment.status === "paid" && payment.creditsLeft > 0) paid(payment);
      else if (FAILED.includes(payment.status)) setPhase({ kind: "failed", message: "De betaling is niet gelukt of afgebroken." });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [phase.kind]);

  function retry() {
    setPhase({ kind: "loading" });
    setAttempt((n) => n + 1);
  }

  return (
    <div id="payment" role="dialog" aria-modal="true" aria-labelledby="payment-title" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <h3 id="payment-title">Betalen</h3>
        <p className="offer">
          <b>{credits}</b> {credits === 1 ? "spel" : "spelletjes"} voor <b>{price}</b>
        </p>

        {phase.kind === "loading" && <p className="status">Betaling klaarzetten...</p>}

        {phase.kind === "ready" && (
          <>
            {phase.qr && (
              // eslint-disable-next-line @next/next/no-img-element -- data-URL van de server, geen optimalisatie nodig
              <img className="qr" src={phase.qr} alt="QR-code om te betalen" width={220} height={220} />
            )}
            <p className="hint">
              Scan de QR-code met je telefoon en betaal met {phase.provider === "paypal" ? "PayPal" : "iDEAL"}.
            </p>
            {phase.provider === "paypal" ? (
              // PayPal stuurt de betaler niet terug naar het spel: in een nieuw tabblad, dan blijft deze popup wachten
              <a className="paylink" href={phase.checkoutUrl} target="_blank" rel="noopener noreferrer">
                Of betaal op dit apparaat (nieuw tabblad)
              </a>
            ) : (
              <a className="paylink" href={phase.checkoutUrl}>
                Of betaal op dit apparaat
              </a>
            )}
            <p className="status" aria-live="polite">
              Wachten op je betaling...
            </p>
          </>
        )}

        {phase.kind === "failed" && (
          <>
            <p className="status error" role="alert">
              {phase.message}
            </p>
            <button className="ok" onClick={retry}>
              Opnieuw proberen
            </button>
          </>
        )}

        {/* Alleen bij een testbetaling; bij live PayPal wordt er echt betaald (taak 12b) */}
        {phase.kind === "ready" && phase.testMode && (
          <p className="testmode">Testomgeving: er wordt geen echt geld afgeschreven.</p>
        )}
        <div className="row">
          <button className="cancel" autoFocus onClick={onClose}>
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
