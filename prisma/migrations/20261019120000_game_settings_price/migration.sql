-- Prijs van één betaling instellen in de game-manager (versie 3, taak 2), in centen.
-- Leeg = standaard (GAME_PRICE_CENTS, anders 100 = € 1,00).

-- AlterTable
ALTER TABLE "game_settings" ADD COLUMN     "price_cents" INTEGER;
