import type { Design } from "@/lib/settings";

interface StatsProps {
  design: Design;
  played: number;
  won: number;
  odds: number;
  chanceNow: string;
  credits: number | null; // null: betalen staat uit
  offer: { credits: number; price: string } | null; // wat een betaling oplevert (jungle-design)
}

export default function Stats({ design, played, won, odds, chanceNow, credits, offer }: StatsProps) {
  return (
    <div id="stats">
      Gespeeld: <b>{played}</b>
      <br />
      Gewonnen: <b>{won}</b>
      <br />
      Winkans: <b>1 op {odds}</b>
      <br />
      Deze draai: <b>{chanceNow}</b>
      {credits !== null && (
        <>
          <br />
          Credits: <b data-testid="credits">{credits}</b>
        </>
      )}
      {design === "jungle" && offer && (
        <>
          <br />
          {offer.credits} Credits: <b data-testid="offer">{offer.price}</b>
        </>
      )}
    </div>
  );
}
