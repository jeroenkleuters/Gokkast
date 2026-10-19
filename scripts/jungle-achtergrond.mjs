// Maakt de plaatjes van het jungle-design (versie 3, taak 1) uit de schildering
// voorbeeld/voorbeeld-nieuw-design.jpeg (1376x768):
// - public/images/jungle/achtergrond.jpg: zonder de voorbeeldteksten, knoppen en hendel,
//   "GRAND JACKPOT" in het midden van de banner (dubbele punt en vakje weg), en het
//   statistiekenbord 50 px naar rechts zodat het binnen het speelveld van 1024 breed valt;
// - public/images/jungle/hendel-bal.png en hendel-stang.png: de hendel als losse plaatjes,
//   zodat hij kan bewegen.
// Opnieuw maken: node scripts/jungle-achtergrond.mjs (sharp komt mee met Next.js).
// De posities hieronder zijn opgemeten in de schildering; de CSS (src/app/jungle.css) gebruikt dezelfde.
import sharp from "sharp";

const SRC = "voorbeeld/voorbeeld-nieuw-design.jpeg";
const OUT = "public/images/jungle";

const { data: orig, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const img = Buffer.from(orig);
const at = (x, y) => (y * W + x) * C;
const copyPixel = (from, fx, fy, tx, ty) => from.copy(img, at(tx, ty), at(fx, fy), at(fx, fy) + C);

// Per rij lineair invullen tussen de kleur links (x0 - 1) en rechts (x1 + 1)
function fillRow(y, x0, x1) {
  const a = at(x0 - 1, y);
  const b = at(x1 + 1, y);
  const n = x1 - x0 + 2;
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0 + 1) / n;
    const p = at(x, y);
    for (let c = 0; c < C; c++) img[p + c] = Math.round(img[a + c] * (1 - t) + img[b + c] * t);
  }
}
const fillRect = (x0, y0, x1, y1) => {
  for (let y = y0; y <= y1; y++) fillRow(y, x0, x1);
};

// 1. Banner: "GRAND JACKPOT" 63 px naar rechts (midden van de banner), dubbele punt en vakje weg
const BANNER = { y0: 272, y1: 319, x0: 455, x1: 798, shift: 63, right: 937 };
for (let y = BANNER.y0; y <= BANNER.y1; y++) {
  for (let x = BANNER.x1; x >= BANNER.x0; x--) copyPixel(orig, x, y, x + BANNER.shift, y);
  fillRow(y, BANNER.x0, BANNER.x0 + BANNER.shift - 1);
  fillRow(y, BANNER.x1 + BANNER.shift + 1, BANNER.right);
}

// 2. Knoppen VAST / DRAAI / VAST weg (het spel tekent eigen knoppen)
fillRect(488, 620, 892, 688);
// 3. Tekst op het berichtenbord weg
fillRect(422, 712, 958, 749);
// 4. Tekst op het bord "Hoe Speel Je?" weg (de drie shotjes blijven)
fillRect(122, 384, 342, 478);

// 5. Statistiekenbord 50 px naar rechts; de vrijgekomen strook vullen met de jungle erboven,
// gespiegeld zodat hij naadloos aansluit (de bamboe loopt verticaal door), daarna de tekst op het bord weg
const STATS = { x0: 21, y0: 569, x1: 272, y1: 759, move: 50 }; // alleen het bord zelf
for (let y = STATS.y0; y <= STATS.y1; y++) {
  for (let x = STATS.x0; x <= STATS.x1; x++) copyPixel(orig, x, y, x + STATS.move, y);
  for (let x = STATS.x0; x < STATS.x0 + STATS.move; x++) copyPixel(orig, x, 2 * STATS.y0 - 1 - y, x, y);
}
fillRect(32 + STATS.move, 584, 258 + STATS.move, 746);

// 6. Hendel: bal en stang uitknippen (uit het origineel), daarna weg uit de achtergrond
const BALL = { cx: 1053, cy: 409, r: 30 };
const ROD = { x: 1020, y: 430, w: 42, h: 166, points: [[1042, 434], [1058, 434], [1041, 594], [1022, 594]] };

async function cut(left, top, width, height, shape, file) {
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shape}</svg>`);
  await sharp(orig, { raw: { width: W, height: H, channels: C } })
    .extract({ left, top, width, height })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toFile(`${OUT}/${file}`);
}

const ballBox = BALL.r + 2;
await cut(BALL.cx - ballBox, BALL.cy - ballBox, 2 * ballBox, 2 * ballBox,
  `<circle cx="${ballBox}" cy="${ballBox}" r="${BALL.r}" fill="#fff"/>`, "hendel-bal.png");
const rodPoints = ROD.points.map(([x, y]) => `${x - ROD.x},${y - ROD.y}`).join(" ");
await cut(ROD.x, ROD.y, ROD.w, ROD.h, `<polygon points="${rodPoints}" fill="#fff"/>`, "hendel-stang.png");

for (let y = BALL.cy - BALL.r - 3; y <= BALL.cy + BALL.r + 3; y++) fillRow(y, 1023, 1086);
for (let y = 436; y <= 588; y++) {
  const cx = Math.round(1050 - 18.5 * ((y - 434) / 160)); // de stang loopt schuin naar links
  fillRow(y, cx - 12, cx + 12);
}

await sharp(img, { raw: { width: W, height: H, channels: C } })
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(`${OUT}/achtergrond.jpg`);
console.log(`Klaar: ${OUT}/achtergrond.jpg (${W}x${H}), hendel-bal.png, hendel-stang.png`);
