interface StatsProps {
  played: number;
  won: number;
  odds: number;
  chanceNow: string;
}

export default function Stats({ played, won, odds, chanceNow }: StatsProps) {
  return (
    <div id="stats">
      Gespeeld: <b>{played}</b>
      <br />
      Gewonnen: <b>{won}</b>
      <br />
      Winkans: <b>1 op {odds}</b>
      <br />
      Deze draai: <b>{chanceNow}</b>
    </div>
  );
}
