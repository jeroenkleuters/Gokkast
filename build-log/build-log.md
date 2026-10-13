# Build-log — Eenarmige Bandiet

Datum: 11 oktober 2026
Project: `C:\Users\j_kle\Documents\Apps\Games\Gokkast`

---

## Stap 1 — Opdracht: webbased gokkast maken

**Vraag:**
> Maak een webbased videospelletje, formaat 1024x768. Het is een eenarmige bandiet.
> De winkans is 1 op 30, maar dit moet instelbaar zijn. De drie plaatjes uit `images`
> staan op de drie rollen die ronddraaien als er op de speelknop gedrukt wordt.
> Je mag 3 keer proberen. Je kunt de rollen onafhankelijk vastzetten.
> In de map `/voorbeeld` staat een voorbeeld.

**Uitgevoerde handelingen:**
1. Projectmap bekeken. Gevonden bestanden:
   - `images/beker.png`
   - `images/kakkerlak.png`
   - `images/vraagteken.png`
   - `voorbeeld/fruitmachine.jpg`
2. Het voorbeeld (`fruitmachine.jpg`) en de drie plaatjes bekeken. Het voorbeeld is een
   casino-gokkast met een verlichte kop, neon-zijpanelen, drie rollen, rode knoppen
   onder de rollen en een hendel met rode bol.
3. `index.html` aangemaakt (alles in één bestand) met:
   - Speelveld van vast 1024x768, dat meeschaalt met het browservenster.
   - Kast in de stijl van het voorbeeld: verlichte "JACKPOT"-kop, neon-zijpanelen,
     drie rollen met rode winlijn, hendel, rooster en berichtenbord.
   - Drie rollen met de plaatjes uit `images/`, met draai-animatie (rollen stoppen na elkaar).
   - 3 pogingen per spel, weergegeven met lampjes.
   - Per rol een rode VAST-knop (na de eerste draai, maximaal 2 tegelijk).
   - Winst bij drie dezelfde plaatjes: melding, geluid en muntenregen. Daarna knop "NIEUW SPEL".
   - Winkans standaard 1 op 30, instelbaar via het tandwiel (opgeslagen in de browser)
     of via de adresbalk (`index.html?kans=10`).
   - Geluidseffecten via Web Audio, met aan/uit-knop.
   - Sneltoetsen: spatie = speel, 1/2/3 = rol vastzetten.
   - Statistieken: gespeeld, gewonnen, winkans.
4. Python bleek niet beschikbaar; correcties daarom met de editor gedaan:
   - Breedte van de rollenkast aangepast (348 → 356px) zodat drie rollen passen.
   - Binnenhoogte van de rol gecorrigeerd (300 → 296px) en winlijn/pijlen uitgelijnd.
   - Hendel-animatie vervangen: stang wordt korter en bol zakt naar beneden.
5. Screenshot gemaakt met headless Microsoft Edge om de opmaak te controleren.
6. VAST-knoppen precies onder de bijbehorende rol gezet en SPEEL-knop rechts ernaast
   (breedte 100px; tekst "NIEUW SPEL" 13px).
7. Opnieuw een screenshot gemaakt ter controle.

---

## Stap 2 — Vastzetten verhoogt de kans

**Vraag:**
> Vastzetten kan de kans verhogen.

**Uitgevoerde handelingen:**
1. Functie `winChance()` toegevoegd. Elke draaiende rol valt goed met kans
   (1/winkans)^(1/3), zodat 3 vrije rollen precies de ingestelde winkans geven.
   - Bij 1 op 30: niets vast = 1 op 30, 1 rol vast = 1 op 9,7,
     2 gelijke rollen vast = 1 op 3,1, 2 verschillende rollen vast = geen kans.
2. `decideOutcome()` gebruikt nu `winChance()`.
3. In het statistiekenvak de regel "Deze draai" toegevoegd met de actuele kans.
4. Uitleg links en de tekst bij het tandwiel bijgewerkt.
5. Screenshot gemaakt ter controle.

---

## Stap 3 — CSS en JavaScript in losse bestanden

**Vraag:**
> Zet de CSS en JavaScript in losse files.

**Uitgevoerde handelingen:**
1. Reservekopie van `index.html` gemaakt als `index.backup.html` in de tijdelijke map (`%TEMP%`).
2. Inhoud van `<style>` verplaatst naar `style.css`.
3. Inhoud van `<script>` verplaatst naar `game.js`.
4. `index.html` verwijst nu naar `style.css` (via `<link>`) en `game.js` (via `<script src>`).
5. Screenshot gemaakt: het spel ziet er hetzelfde uit en de bestanden laden goed.

Resultaat:
- `index.html`: HTML-structuur (97 regels)
- `style.css`: opmaak (341 regels)
- `game.js`: spellogica (325 regels)

---

## Stap 4 — Teksten bij winst/verlies 15% kleiner

**Vraag:**
> De teksten als je hebt gewonnen of verloren mogen 15% kleiner.

**Uitgevoerde handelingen:**
1. In `style.css` de regel `#display.win, #display.lose { font-size: 22px; }` toegevoegd
   (was 26px; 26 × 0,85 ≈ 22).

---

## Stap 5 — Tekst "NIEUW SPEL" op de knop ook kleiner

**Vraag:**
> De tekst nieuw spel op de knop ook.

**Uitgevoerde handelingen:**
1. In `style.css` bij `#playbtn.new` de lettergrootte aangepast van 13px naar 11px
   (13 × 0,85 ≈ 11).

---

## Stap 6 — Build-log bewaren

**Vraag:**
> Bewaar alle handelingen die je hebt uitgevoerd in de map build-log.

**Uitgevoerde handelingen:**
1. Map `build-log` aangemaakt met dit bestand (`build-log.md`).

---

## Huidige bestandsstructuur

```
Gokkast/
├── index.html
├── style.css
├── game.js
├── images/
│   ├── beker.png
│   ├── kakkerlak.png
│   └── vraagteken.png
├── voorbeeld/
│   └── fruitmachine.jpg
└── build-log/
    └── build-log.md
```
