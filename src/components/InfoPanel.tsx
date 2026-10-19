import Image from "next/image";
import { CONTAINERS } from "@/lib/designs";
import { MAX_HELD, SYMBOL_NAMES, SYMBOLS } from "@/lib/game";
import { prizeName } from "@/lib/prizes";
import type { Design } from "@/lib/settings";

export default function InfoPanel({ design, maxTries }: { design: Design; maxTries: number }) {
  const tries = maxTries === 1 ? "1 poging" : `${maxTries} pogingen`;

  // Haven: spelregels op een donker bord, met per container de prijs
  if (design === "haven") {
    return (
      <div id="info" className="board">
        <h2 className="head">SPELREGELS</h2>
        <p>
          Druk op <b>UITHALEN</b>. Je hebt <b>{tries}</b> per spel.
        </p>
        <p>
          Zet tot {MAX_HELD} rollen <b>VAST</b> en haal opnieuw uit: dat vergroot je kans.
        </p>
        <p>
          3 dezelfde containers op de lijn = <b>JACKPOT!</b>
        </p>
        <ul className="pay">
          {SYMBOL_NAMES.map((name, i) => (
            <li key={name}>
              <span>
                {[0, 1, 2].map((k) => (
                  <Image key={k} src={CONTAINERS[i]} alt="" width={24} height={24} />
                ))}
              </span>
              {prizeName(name)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

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
