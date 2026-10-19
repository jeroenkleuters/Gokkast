import { describe, expect, it } from "vitest";
import { fitField, LAYOUTS } from "@/lib/designs";
import { READY_MESSAGE } from "@/lib/game";

describe("fitField", () => {
  it("origineel: het speelveld staat in het midden, met balken waar het niet past", () => {
    expect(fitField(1024, 768, LAYOUTS.origineel)).toEqual({ scale: 1, left: 0, top: 0 });
    expect(fitField(2048, 768, LAYOUTS.origineel)).toEqual({ scale: 1, left: 512, top: 0 });
    expect(fitField(512, 768, LAYOUTS.origineel)).toEqual({ scale: 0.5, left: 0, top: 192 });
  });

  it("jungle op 1024x768: precies het speelveld, de schildering valt links en rechts weg", () => {
    expect(fitField(1024, 768, LAYOUTS.jungle)).toEqual({ scale: 1, left: 0, top: 0 });
  });

  it("jungle op een breed venster: de hele schildering in beeld, het speelveld 64 px van links", () => {
    expect(fitField(1376, 768, LAYOUTS.jungle)).toEqual({ scale: 1, left: 64, top: 0 });
    // schaal 2: de schildering is 2752 breed en staat in het midden van 2752
    expect(fitField(2752, 1536, LAYOUTS.jungle)).toEqual({ scale: 2, left: 128, top: 0 });
  });

  it("jungle: het speelveld blijft altijd helemaal in beeld", () => {
    for (const [w, h] of [[1100, 768], [1920, 1080], [390, 844], [3000, 768], [800, 1200]]) {
      const { scale, left, top } = fitField(w, h, LAYOUTS.jungle);
      expect(left, `${w}x${h}`).toBeGreaterThanOrEqual(0);
      expect(left + 1024 * scale, `${w}x${h}`).toBeLessThanOrEqual(w + 1e-9);
      expect(top, `${w}x${h}`).toBeGreaterThanOrEqual(0);
      expect(top + 768 * scale, `${w}x${h}`).toBeLessThanOrEqual(h + 1e-9);
    }
  });

  it("jungle op een zeer breed venster: de schildering zo veel mogelijk in het midden", () => {
    // 3000 breed: de schildering (1376) past ruim; het speelveld begint 64 px na de linkerrand ervan
    expect(fitField(3000, 768, LAYOUTS.jungle).left).toBe((3000 - 1376) / 2 + 64);
  });
});

describe("LAYOUTS", () => {
  it("speelknop en beginbericht per design", () => {
    expect(LAYOUTS.origineel.playLabel).toBe("SPEEL");
    expect(LAYOUTS.origineel.readyMessage).toBe(READY_MESSAGE);
    expect(LAYOUTS.jungle.playLabel).toBe("DRAAI");
    expect(LAYOUTS.jungle.readyMessage).toBe("DRUK OP DRAAI OF TREK DE HENDEL!");
  });
});
