// Maakt de plaatjes van het havendesign Harbor Jackpot (versie 3, taak 3) in public/images/haven:
// - achtergrond.jpg: de havenfoto (ECT-terminal Maasvlakte) op 1376x768;
// - kast.png: het rollenhuis met gaas en rode pijlen, uitgeknipt uit voorbeeld/HarborJackpot.png;
// - titel.png: de neonletters HARBOR JACKPOT uit hetzelfde voorbeeld, met transparantie;
// - msc.png, maersk.png, loyd.png: de containers op de rollen (vierkant, getekend als SVG).
// Knoppendek, knoppen, borden en LED-bord zijn CSS (src/app/haven.css).
// Opnieuw maken: node scripts/haven-plaatjes.mjs (sharp komt mee met Next.js).
import sharp from "sharp";

const PHOTO = "voorbeeld/de-ect-terminal-op-de-maasvlakte-in-de-haven-van-rotterdam.jpeg";
const DESIGN = "voorbeeld/HarborJackpot.png";
const OUT = "public/images/haven";

// 1. Achtergrond: de foto (1920x1280) op 1376 breed, 90 px van boven weg (minder lucht, meer water)
await sharp(PHOTO)
  .resize(1376)
  .extract({ left: 0, top: 90, width: 1376, height: 768 })
  .jpeg({ quality: 84, progressive: true })
  .toFile(`${OUT}/achtergrond.jpg`);

// 2. Rollenhuis uit het voorbeeld, met afgeronde hoeken. De rolvensters liggen op x 46, 210 en 373
// (145 breed) en y 36 t/m 291; de CSS legt de rollen erin.
const HOUSING = { x: 406, y: 204, w: 563, h: 328, r: 16 };
const corners = `<svg xmlns="http://www.w3.org/2000/svg" width="${HOUSING.w}" height="${HOUSING.h}"><rect width="${HOUSING.w}" height="${HOUSING.h}" rx="${HOUSING.r}" fill="#fff"/></svg>`;
await sharp(DESIGN)
  .extract({ left: HOUSING.x, top: HOUSING.y, width: HOUSING.w, height: HOUSING.h })
  .ensureAlpha()
  .composite([{ input: Buffer.from(corners), blend: "dest-in" }])
  .png()
  .toFile(`${OUT}/kast.png`);

// 3. Titel: de neon is warm (veel meer rood dan blauw), de lucht erachter donkerblauw en de kraan
// blauw. De dekking volgt hoe warm een pixel is; de kleur wordt teruggerekend zonder de lucht.
const TITLE = { x: 462, y: 28, w: 512, h: 165, craneX: 452 };
const SKY = [18, 26, 44];
const { data } = await sharp(DESIGN)
  .extract({ left: TITLE.x, top: TITLE.y, width: TITLE.w, height: TITLE.h })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const title = Buffer.alloc(TITLE.w * TITLE.h * 4);
for (let y = 0; y < TITLE.h; y++) {
  for (let x = 0; x < TITLE.w; x++) {
    const i = y * TITLE.w + x;
    const [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
    const warm = Math.max(0, r - Math.max(b, SKY[0]) * 0.9);
    let a = Math.min(1, Math.max(0, (warm - 22) / 120));
    if (x > TITLE.craneX) a *= Math.max(0, 1 - (x - TITLE.craneX) / 12); // stukje kraan rechts weg
    const color = (p, sky) => (a > 0.02 ? Math.min(255, Math.max(0, (p - sky * (1 - a)) / a)) : 0);
    title.set([color(r, SKY[0]), color(g, SKY[1]), color(b, SKY[2]), Math.round(a * 255)], i * 4);
  }
}
await sharp(title, { raw: { width: TITLE.w, height: TITLE.h, channels: 4 } }).trim().png().toFile(`${OUT}/titel.png`);

// 4. Containers: een 10ft-container (bijna vierkant) in lichte 3D, met ribbels, hoekstukken en de naam.
// Volgorde in het spel (designs.ts): MSC = shot, MAERSK = kakkerlak, Loyd = vraagteken.
const CONTAINERS = {
  msc: { body: "#f1df9b", dark: "#c9b46a", light: "#fbf0c4", text: "MSC", ink: "#1d1a12", size: 64 },
  maersk: { body: "#9fd2ea", dark: "#6fa9c4", light: "#cdeaf7", text: "MAERSK", ink: "#0d2a40", size: 37 },
  loyd: { body: "#d8a032", dark: "#a8761c", light: "#ecc062", text: "Loyd", ink: "#1e1406", size: 60 },
};
const [x0, x1, y0, y1, depth] = [22, 206, 62, 226, 28]; // voorkant; boven- en zijkant naar rechtsboven
for (const [name, c] of Object.entries(CONTAINERS)) {
  const ribs = [];
  for (let x = x0 + 14; x < x1 - 8; x += 12) {
    ribs.push(`<rect x="${x}" y="${y0 + 8}" width="5" height="${y1 - y0 - 16}" fill="${c.dark}" opacity=".35"/>`);
  }
  const sideRibs = [1, 2, 3, 4, 5].map((k) => {
    const y = y0 + 8 + k * 25;
    return `<line x1="${x1 + 4}" y1="${y}" x2="${x1 + depth - 4}" y2="${y - depth + 8}" stroke="#000" stroke-opacity=".18" stroke-width="3"/>`;
  });
  const castings = [[x0, y0], [x1 - 14, y0], [x0, y1 - 14], [x1 - 14, y1 - 14]].map(
    ([x, y]) => `<rect x="${x}" y="${y}" width="14" height="14" fill="#3a3a3a" opacity=".85"/>`,
  );
  const edge = `stroke="#2a2a2a" stroke-width="3" stroke-linejoin="round"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <polygon points="${x0},${y0} ${x0 + depth},${y0 - depth} ${x1 + depth},${y0 - depth} ${x1},${y0}" fill="${c.light}" ${edge}/>
    <polygon points="${x1},${y0} ${x1 + depth},${y0 - depth} ${x1 + depth},${y1 - depth} ${x1},${y1}" fill="${c.dark}" ${edge}/>
    ${sideRibs.join("")}
    <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${c.body}"/>
    ${ribs.join("")}
    <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="9" fill="${c.dark}"/>
    <rect x="${x0}" y="${y1 - 10}" width="${x1 - x0}" height="10" fill="${c.dark}"/>
    ${castings.join("")}
    <rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" ${edge}/>
    <text x="${(x0 + x1) / 2}" y="${(y0 + y1) / 2 + c.size * 0.36}" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="${c.size}" fill="${c.ink}">${c.text}</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${name}.png`);
}

console.log(`Klaar: ${OUT}/achtergrond.jpg, kast.png, titel.png, msc.png, maersk.png, loyd.png`);
