import type { Design } from "@/lib/settings";

interface StatsProps {
  design: Design;
  played: number;
  won: number;
  credits: number | null; // null: betalen staat uit
  offer: { credits: number; price: string } | null; // wat een betaling oplevert (jungle- en havendesign)
}

export default function Stats({ design, played, won, credits, offer }: StatsProps) {
  // Haven: donker bord met de credits als LED-getal; zonder betalen alleen de stand
  if (design === "haven") {
    const rows: [string, string | number][] = [
      ["Gespeeld", played],
      ["Gewonnen", won],
    ];
    return (
      <div id="stats" className="board">
        <h2 className="head">{credits !== null ? "CREDITS" : "STAND"}</h2>
        {credits !== null && (
          <div className="led" data-testid="credits">
            {credits}
          </div>
        )}
        {offer && (
          <div className="offer">
            {offer.credits} Credits: <b data-testid="offer">{offer.price}</b>
          </div>
        )}
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  // Jungle: de regels staan in het midden van het geschilderde bord (vaste hoogte, zie jungle.css)
  return (
    <div id="stats">
      <div>
        Gespeeld: <b>{played}</b>
        <br />
        Gewonnen: <b>{won}</b>
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
    </div>
  );
}
