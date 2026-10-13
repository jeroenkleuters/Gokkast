-- Uitkomst met het gewonnen plaatje ("WON shot", "WON kakkerlak", "WON vraagteken") in plaats van "WON".
-- Oude winstrondes zonder plaatje worden verwijderd (de geschiedenis is niet belangrijk).
DELETE FROM "games" WHERE "outcome" = 'WON';

ALTER TYPE "GameOutcome" RENAME TO "GameOutcome_old";
CREATE TYPE "GameOutcome" AS ENUM ('WON shot', 'WON kakkerlak', 'WON vraagteken', 'LOST');
ALTER TABLE "games" ALTER COLUMN "outcome" TYPE "GameOutcome" USING ("outcome"::text::"GameOutcome");
DROP TYPE "GameOutcome_old";
