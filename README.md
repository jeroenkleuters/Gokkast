# Gokkast — Eenarmige Bandiet

Een webbased eenarmige bandiet (1024x768) gebouwd met Next.js, React en TypeScript.
Drie rollen, standaard drie pogingen per spel, rollen los vast te zetten en een instelbare winkans
(standaard 1 op 30). De instellingen staan in een `.env`-bestand.

## Vereisten

- [Node.js](https://nodejs.org/) 20.9 of nieuwer (ontwikkeld met Node 26)
- npm (wordt meegeleverd met Node.js)

## Lokale server starten

```bash
# 1. Afhankelijkheden installeren (eenmalig, of na wijzigingen in package.json)
npm install

# 2. (Optioneel) instellingen aanpassen, zie "Instellingen" hieronder
cp .env.example .env.local

# 3. Ontwikkelserver starten
npm run dev
```

Open daarna [http://localhost:3000](http://localhost:3000) in de browser.
Wijzigingen in de code worden direct zichtbaar (hot reload). Stoppen doe je met `Ctrl+C`.

Draait er al iets op poort 3000? Kies een andere poort:

```bash
npm run dev -- -p 3001
```

## Overige scripts

| Commando        | Wat het doet                                             |
| --------------- | -------------------------------------------------------- |
| `npm run dev`   | Ontwikkelserver met hot reload op poort 3000             |
| `npm run build` | Productiebuild maken in `.next/`                         |
| `npm run start` | De productiebuild serveren (eerst `npm run build` draaien) |
| `npm run lint`  | Code controleren met ESLint                              |
| `npm test`      | Automatische tests (Vitest) één keer draaien             |
| `npm run test:watch` | Tests opnieuw draaien bij elke wijziging            |
| `npm run test:e2e` | Visuele tests (Playwright) in de browser draaien      |
| `npm run test:e2e:ui` | Visuele tests in de Playwright-UI bekijken         |

Productieversie lokaal testen:

```bash
npm run build
npm run start
```

## Tests

De spellogica en de instellingen worden getest met [Vitest](https://vitest.dev/):

```bash
npm test
```

De tests staan naast de code in `src/lib/` (`game.test.ts`, `settings.test.ts`) en controleren onder
andere de winkans per aantal vastgezette rollen, dat een verlies nooit drie gelijke plaatjes geeft,
het aantal pogingen, maximaal 2 rollen vastzetten en het inlezen van de `.env`-instellingen.

### Visuele tests (Playwright)

Het spel zelf wordt in een echte browser (Chromium, 1024x768) getest met
[Playwright](https://playwright.dev/). Eenmalig de browser installeren:

```bash
npx playwright install chromium
```

Daarna:

```bash
npm run test:e2e
```

Playwright bouwt de app en start die zelf op poort 3100 (zie `playwright.config.ts`), met
testinstellingen die alleen voor die server gelden (`GAME_ALLOW_ODDS_URL=true`). De tests in `e2e/`
controleren het laden, draaien met de hendel, rollen vastzetten (maximaal 2), de winst- en
verliesmelding en NIEUW SPEL. De uitkomst is voorspelbaar: `?kans=1` geeft altijd winst, en voor
verlies gebruiken de tests `?kans=100000` met een `Math.random` die nooit onder 0,05 komt.
Draait er al iets op poort 3100, dan gebruikt Playwright die server (behalve op CI).

## Spelen

- **Speelknop / hendel** of `Spatie` / `Enter`: rollen draaien.
- **VAST-knoppen** of toetsen `1`, `2`, `3`: een rol vastzetten (na de eerste draai).
- Je hebt standaard **3 pogingen** per spel (instelbaar); drie dezelfde plaatjes is winst.
- Vastzetten van rollen met hetzelfde plaatje vergroot de winkans.
- Het **tandwiel** toont de huidige instellingen (alleen-lezen).

## Instellingen

De instellingen staan in omgevingsvariabelen. Kopieer [`.env.example`](.env.example) naar
`.env.local` en pas de waarden aan. Echte `.env`-bestanden staan niet in git; op Vercel stel je
dezelfde variabelen in bij de projectinstellingen. Ontbreekt een variabele of is de waarde
ongeldig, dan geldt de standaardwaarde. Na een wijziging de server herstarten.

| Variabele                 | Betekenis                                                    | Toegestaan          | Standaard |
| ------------------------- | ------------------------------------------------------------ | ------------------- | --------- |
| `GAME_ODDS`               | Winkans per draai zonder vastgezette rollen: 1 op deze waarde | 1 t/m 100000        | `30`      |
| `GAME_MAX_TRIES`          | Aantal pogingen per spel                                     | 1 t/m 5             | `3`       |
| `GAME_ROUNDS_PER_PAYMENT` | Speelrondes per betaling (nog niet in gebruik, komt met betalen) | 1 t/m 100       | `1`       |
| `GAME_ALLOW_ODDS_URL`     | Winkans via de adresbalk overschrijven, bijv. `/?kans=1`      | `true`/`1`/`ja`/`aan` | uit     |

Met `GAME_ALLOW_ODDS_URL=true` geeft
[http://localhost:3000/?kans=10](http://localhost:3000/?kans=10) een winkans van 1 op 10. Handig bij
ontwikkelen en testen; laat dit in productie uit.

## Projectstructuur

```
Gokkast/
├── public/images/      plaatjes voor de rollen (beker, kakkerlak, vraagteken)
├── src/
│   ├── app/            layout, pagina en globale CSS (Next.js App Router)
│   ├── components/     SlotMachine, Reel, Lever, InfoPanel, Stats, SettingsDialog, GameClient
│   └── lib/            spellogica (game.ts), instellingen (settings.ts), geluid, opslag, muntenregen, tests (*.test.ts)
├── .env.example        alle instellingen met uitleg (kopiëren naar .env.local)
├── e2e/                visuele tests met Playwright (*.spec.ts)
├── playwright.config.ts instellingen voor de visuele tests
├── vitest.config.mts   instellingen voor de unit-tests
├── v1/                 versie 1: losse HTML/CSS/JS, opent direct in de browser
├── voorbeeld/          ontwerpvoorbeeld (fruitmachine.jpg)
└── project-details/    doelen, to-do, huidige feature en build-log
```

## Versie 1

De oorspronkelijke versie zonder build-stap staat in [`v1/`](v1/). Open
`v1/index.html` direct in de browser om die te spelen.

## Meer informatie

- Doelen en eisen: [`project-details/goals.md`](project-details/goals.md)
- Takenlijst: [`project-details/to-do.md`](project-details/to-do.md)
- Logboek van alle wijzigingen: [`project-details/build-log.md`](project-details/build-log.md)
