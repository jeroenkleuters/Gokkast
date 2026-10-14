-- Betalingen versleuteld (taak 11): rekeningnummer van de rekeninghouder, alleen versleuteld
-- (AES-256-GCM, sleutel PAYMENT_ENCRYPTION_KEY). Optioneel: niet elke betaalmethode geeft er een.

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "account_encrypted" TEXT;
