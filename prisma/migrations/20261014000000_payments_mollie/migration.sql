-- Betalen met Mollie (taak 10): per speler een eigen Mollie-betaling met credits, en gespeelde
-- rondes gekoppeld aan de betaling. Oude betalingen zonder Mollie-gegevens worden verwijderd
-- (er waren alleen voorbeeldrijen; de nieuwe kolommen zijn verplicht).
DELETE FROM "payments";

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('open', 'pending', 'authorized', 'paid', 'canceled', 'expired', 'failed');

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "payment_id" INTEGER;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "checkout_url" TEXT NOT NULL,
ADD COLUMN     "credits" INTEGER NOT NULL,
ADD COLUMN     "credits_left" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mollie_id" TEXT NOT NULL,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'open',
ADD COLUMN     "token" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "games_payment_id_idx" ON "games"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_token_key" ON "payments"("token");

-- CreateIndex
CREATE UNIQUE INDEX "payments_mollie_id_key" ON "payments"("mollie_id");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

