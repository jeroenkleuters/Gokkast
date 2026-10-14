-- Betaald-pagina (taak 10b): eigen referentie per betaling in de terugkeer-URL van Mollie,
-- zodat /betaald ook op een telefoon (zonder de cookie van het spel) de betaling kan tonen.
-- Optioneel: oudere betalingen hebben er geen.

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "reference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");
