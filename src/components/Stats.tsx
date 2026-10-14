interface StatsProps {
  played: number;
  won: number;
  odds: number;
  chanceNow: string;
  credits: number | null; // null: betalen staat uit
}

export default function Stats({ played, won, odds, chanceNow, credits }: StatsProps) {
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
    </div>
  );
}
