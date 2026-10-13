import Image from "next/image";
import { SYMBOLS } from "@/lib/game";

export default function InfoPanel({ maxTries }: { maxTries: number }) {
  return (
    <div id="info">
      <h2>Hoe speel je?</h2>
      <p>
        Druk op <b>SPEEL</b> of trek aan de hendel. Je hebt{" "}
        <b>{maxTries === 1 ? "1 poging" : `${maxTries} pogingen`}</b>.
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
