// Maten per design (versie 3, taak 1). Het speelveld is altijd 1024x768 en wordt passend
// geschaald naar het venster. Het jungle-design heeft daarachter een bredere schildering
// (1376x768) die mee schaalt: op een breder venster is daar meer van te zien.
import { READY_MESSAGE } from "@/lib/game";
import type { Design } from "@/lib/settings";

export const FIELD_W = 1024;
export const FIELD_H = 768;

export interface DesignLayout {
  sceneWidth: number; // breedte van de achtergrond (zelfde hoogte als het speelveld)
  sceneOffset: number; // zoveel px van de achtergrond ligt links van het speelveld
  cell: number; // hoogte van een plaatje op de rol (incl. rand), zie Reel.tsx en de CSS
  reelHeight: number; // binnenhoogte van een rol
  playLabel: string; // tekst op de speelknop
  readyMessage: string; // berichtenbord bij het begin van een spel
}

export const LAYOUTS: Record<Design, DesignLayout> = {
  origineel: {
    sceneWidth: FIELD_W,
    sceneOffset: 0,
    cell: 104,
    reelHeight: 296,
    playLabel: "SPEEL",
    readyMessage: READY_MESSAGE,
  },
  jungle: {
    sceneWidth: 1376,
    sceneOffset: 64,
    cell: 90,
    reelHeight: 268,
    playLabel: "DRAAI",
    readyMessage: "DRUK OP DRAAI OF TREK DE HENDEL!",
  },
};

export interface FieldFit {
  scale: number;
  left: number; // positie van het speelveld in het venster (px)
  top: number;
}

// Het hele speelveld past altijd in het venster. Is er ruimte over, dan staat de achtergrond
// zo veel mogelijk in het midden, maar het speelveld schuift nooit buiten beeld.
export function fitField(width: number, height: number, layout: DesignLayout): FieldFit {
  const scale = Math.min(width / FIELD_W, height / FIELD_H);
  const centered = (width - layout.sceneWidth * scale) / 2 + layout.sceneOffset * scale;
  const left = Math.min(Math.max(centered, 0), width - FIELD_W * scale);
  return { scale, left, top: (height - FIELD_H * scale) / 2 };
}
