-- PayPal als tweede betaalmethode (taak 13b): elke betaling weet met welke methode hij gemaakt is
-- (bestaande betalingen zijn Mollie), het factuur-ID van PayPal staat naast het Mollie-ID, en de
-- game-manager kan de betaalmethode kiezen (leeg = standaard, Mollie).

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('mollie', 'paypal');

-- AlterTable
ALTER TABLE "game_settings" ADD COLUMN     "payment_provider" "PaymentProvider";

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "paypal_id" TEXT,
ADD COLUMN     "provider" "PaymentProvider" NOT NULL DEFAULT 'mollie',
ALTER COLUMN "mollie_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payments_paypal_id_key" ON "payments"("paypal_id");
