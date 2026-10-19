-- Design kiezen in de game-manager (versie 3, taak 1): het nieuwe jungle-design of het originele.
-- Leeg = standaard (GAME_DESIGN, anders jungle).

-- CreateEnum
CREATE TYPE "GameDesign" AS ENUM ('jungle', 'origineel');

-- AlterTable
ALTER TABLE "game_settings" ADD COLUMN     "design" "GameDesign";
