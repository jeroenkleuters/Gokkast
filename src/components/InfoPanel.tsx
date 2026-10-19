import Image from "next/image";
import { SYMBOLS } from "@/lib/game";
import type { Design } from "@/lib/settings";

export default function InfoPanel({ design, maxTries }: { design: Design; maxTries: number }) {
  const tries = maxTries === 1 ? "1 poging" : `${maxTries} pogingen`;

  // Jungle: korte tekst op het houten bord; de drie shotjes staan in de achtergrond
  if (design === "jungle") {
    return (
      <div id="info">
        <h2>Hoe Speel Je?</h2>
        <p>
          Druk op <b>DRAAI</b>. Je hebt <b>{maxTries}</b> {maxTries === 1 ? "poging" : "pogingen"} per hand.
        </p>
      </div>
    );
  }

  return (
    <div id="info">
      <h2>Hoe speel je?</h2>
      <p>
        Druk op <b>SPEEL</b> of trek aan de hendel. Je hebt <b>{tries}</b>.
      </p>
      <p>
        Zet een rol vast met de rode knop eronder voordat je opnieuw draait. Twee gelijke plaatjes
        vastzetten vergroot je kans!
      </p>
      <p>
        Drie dezelfde plaatjes op de lijn = <b>JACKPOT!</b>
      </p>
      <div className="pay">
        {[0, 1, 2].map((k) => (
          <Image key={k} src={SYMBOLS[0]} alt="" width={34} height={34} />
        ))}
      </div>
      <p style={{ fontSize: 12, color: "#998fb8" }}>Toetsen: spatie = speel, 1 / 2 / 3 = rol vastzetten</p>
    </div>
  );
}
