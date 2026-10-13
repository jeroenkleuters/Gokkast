-- AlterTable
ALTER TABLE "game_settings" ALTER COLUMN "odds" DROP NOT NULL,
ALTER COLUMN "max_tries" DROP NOT NULL,
ALTER COLUMN "rounds_per_payment" DROP NOT NULL;
