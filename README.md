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
| `npm run db:migrate` | Nieuwe migratie maken en toepassen na een wijziging in `prisma/schema.prisma` |
| `npm run db:deploy` | Bestaande migraties toepassen (zo doet de workflow het ook) |
| `npm run db:seed` | Seed-data voor ontwikkeling (instellingen en voorbeeldrondes) |
| `npm run db:studio` | De database bekijken en bewerken in Prisma Studio   |

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

De spelinstellingen staan in de database (tabel `game_settings`, zie [Database](#database)) en
stel je in via de [game-manager](#game-manager). Zonder database, of als de tabel leeg of
onbereikbaar is, gelden de omgevingsvariabelen hieronder; ook een lege ("standaard") of ongeldige
waarde in de database valt per instelling terug op de variabele. Het tandwiel toont welke bron
gebruikt wordt. `GAME_ALLOW_ODDS_URL` staat alleen in de omgevingsvariabelen.

De omgevingsvariabelen: kopieer [`.env.example`](.env.example) naar
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

## Database

[Neon](https://neon.com/docs/introduction) (serverless Postgres), via [Prisma](https://www.prisma.io/docs) 7.
Het schema staat in [`prisma/schema.prisma`](prisma/schema.prisma), de migraties in `prisma/migrations/`.

| Tabel           | Inhoud                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| `game_settings` | Eén rij (id 1): winkans, pogingen, speelrondes per betaling; leeg = `.env`-waarde |
| `games`         | Gespeelde rondes: uitkomst (`WON`/`LOST`), gebruikte pogingen, datum; naam leeg tot betalen (taak 10/11) |
| `payments`      | Betalingen: naam, bedrag in centen, datum (Mollie en versleuteling volgen in taak 10/11) |

Verbinding via omgevingsvariabelen (zie [`.env.example`](.env.example)):

- `DATABASE_URL`: via de Neon-pooler, gebruikt door de app ([`src/lib/db.ts`](src/lib/db.ts)).
- `DATABASE_URL_UNPOOLED`: directe verbinding, gebruikt door de Prisma CLI voor migraties en seed
  ([`prisma.config.ts`](prisma.config.ts)). Ontbreekt die, dan wordt `DATABASE_URL` gebruikt.

Neon heeft aparte branches: `main` voor productie, `dev` voor ontwikkeling en previews.
Lokaal beginnen:

```bash
npx vercel@60.1.3 env pull .env.local   # haalt de Development-variabelen (dev-branch) op
npm run db:deploy                       # migraties toepassen
npm run db:seed                         # instellingen en voorbeeldrondes
```

Aan het eind van elk spel stuurt de gokkast de ronde naar de server action `saveGame`
([`src/app/actions.ts`](src/app/actions.ts)). De server controleert de invoer
([`src/lib/gameStore.ts`](src/lib/gameStore.ts): uitkomst `WON`/`LOST`, pogingen 1 t/m het
maximum, verlies alleen na alle pogingen) en slaat de ronde op. Zonder database of bij een fout
wordt er niets opgeslagen (waarschuwing in de serverlog) en gaat het spel gewoon door.
Highscores staan niet in het spel, alleen straks in de game-manager.

De Prisma Client wordt gegenereerd in `src/generated/prisma` (niet in git) bij elke `npm install`.
Het schema wijzigen: `prisma/schema.prisma` aanpassen en `npm run db:migrate -- --name <naam>`.
Herstart daarna de dev-server: een draaiende server houdt de oude Prisma Client vast.

## Game-manager

Beheerpagina op [`/game-manager`](http://localhost:3000/game-manager), alleen voor beheerders.
Inloggen gaat met Google via [Auth.js](https://authjs.dev/) ([`src/auth.ts`](src/auth.ts)); de
sessie is een versleutelde cookie (geen databasetabellen). Het spel zelf blijft zonder inloggen speelbaar.

- Alleen e-mailadressen uit `GAME_MANAGER_ADMINS` krijgen een sessie (en alleen als Google het adres
  heeft bevestigd). Een lege lijst betekent: niemand.
- De pagina controleert het zelf nog eens op de server ([`src/lib/dal.ts`](src/lib/dal.ts)). Haal je
  iemand uit de lijst, dan ziet die direct "geen toegang", ook met een oude sessie.
- Zonder sessie stuurt `/game-manager` door naar `/game-manager/inloggen`.

**Moeilijkheidsgraad.** Op de pagina stel je de winkans (snelkeuze makkelijk 1 op 10, normaal 1 op 30,
moeilijk 1 op 100, of een eigen getal), de pogingen per spel en de speelrondes per betaling in.
Opslaan gaat via een server action die opnieuw controleert of je beheerder bent en de invoer op de
server controleert (zelfde grenzen als `.env`). **Terug naar standaard** maakt een veld leeg: dan
geldt weer de `.env`-waarde. Het spel gebruikt de nieuwe waarden bij het volgende laden. Let op: in
productie geldt een wijziging direct voor het echte spel. Zonder database toont de pagina een melding
(opslaan lukt dan niet); is de database even onbereikbaar, dan is het formulier verborgen.

| Variabele             | Betekenis                                                         |
| --------------------- | ----------------------------------------------------------------- |
| `AUTH_SECRET`         | Sleutel voor de sessiecookie; per omgeving een andere (`npx auth secret` of `openssl rand -base64 33`) |
| `AUTH_GOOGLE_ID`      | Client-ID van de Google OAuth-client                              |
| `AUTH_GOOGLE_SECRET`  | Client-secret van de Google OAuth-client                          |
| `GAME_MANAGER_ADMINS` | E-mailadressen van beheerders, gescheiden door komma's            |

Google OAuth-client aanmaken (eenmalig): in de [Google Cloud Console](https://console.cloud.google.com/)
een project kiezen, *APIs & Services → OAuth consent screen* invullen (type *External*, scopes
`openid`, `email`, `profile`) en bij *Credentials → Create credentials → OAuth client ID* een
*Web application* maken met deze *Authorized redirect URIs*:

- `http://localhost:3000/api/auth/callback/google` (lokaal)
- `https://gokkast.vercel.app/api/auth/callback/google` (productie)

Inloggen werkt alleen lokaal en in productie. Preview-URL's wisselen per deploy en staan niet bij
Google; daar stuurt `/game-manager` wel door naar de inlogpagina, maar Google weigert de terugkeer-URL.

## Deployen (Vercel)

Het spel draait op [Vercel](https://vercel.com/). Deployen gaat automatisch via GitHub Actions
([`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml)), bij elke push:

1. **Controles**: lint, typecheck, Vitest en Playwright. Faalt er één, dan wordt er niet gedeployd
   (bij falende Playwright-tests staat het rapport als artifact bij de workflow-run).
   De controles draaien zonder database; het spel gebruikt dan de `.env`-waarden.
2. **Migraties**: `prisma migrate deploy` op de database van de omgeving (GitHub-secret
   `DATABASE_URL_UNPOOLED` van de environment). Zonder secret wordt deze stap overgeslagen.
3. **Deploy** met de Vercel CLI:
   - push op `main` → **productie**;
   - push op een andere branch → **preview** met een eigen URL. Die staat bij de commit en in de
     pull request (onder *Deployments*), en in de samenvatting van de workflow-run.
     Previews zijn beschermd met Vercel Deployment Protection: alleen te openen als je bij Vercel
     bent ingelogd (of met `npx vercel@60.1.3 curl / --deployment <url>`).

Een mislukte deploy onderzoeken: in GitHub *Re-run jobs → Enable debug logging*; de Vercel CLI
logt dan uitgebreid (`--debug`).

Vercels eigen Git-deploys staan uit (`git.deploymentEnabled: false` in [`vercel.json`](vercel.json)),
zodat er nooit iets live gaat zonder geslaagde tests.

### Instellingen per omgeving

De spelinstellingen (zie [Instellingen](#instellingen)) staan in Vercel onder
*Project → Settings → Environment Variables*:

| Variabele                 | Production | Preview | Development |
| ------------------------- | ---------- | ------- | ----------- |
| `GAME_ODDS`               | `30`       | `30`    | `30`        |
| `GAME_MAX_TRIES`          | `3`        | `3`     | `3`         |
| `GAME_ROUNDS_PER_PAYMENT` | `1`        | `1`     | `1`         |
| `GAME_ALLOW_ODDS_URL`     | `false`    | `true`  | `true`      |
| `DATABASE_URL` (+ `_UNPOOLED`) | Neon `main` | Neon `dev` | Neon `dev` |
| `AUTH_SECRET`             | eigen sleutel | eigen sleutel | eigen sleutel |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth-client | idem | idem |
| `GAME_MANAGER_ADMINS`     | beheerders | beheerders | beheerders |

In previews werkt `?kans=` dus wel, in productie niet. Een wijziging geldt vanaf de volgende deploy
(workflow opnieuw draaien via *Actions → CI/CD → Run workflow*). Development-waarden lokaal ophalen:
`npx vercel@60.1.3 env pull .env.local`.

### Eenmalig instellen

1. Project koppelen: `npx vercel@60.1.3 login` en `npx vercel@60.1.3 link`. Dit maakt
   `.vercel/project.json` (niet in git) met `orgId` en `projectId`.
2. Een token maken op [vercel.com/account/tokens](https://vercel.com/account/tokens).
3. GitHub-secrets instellen (*Settings → Secrets and variables → Actions*, of met `gh secret set`):
   `VERCEL_TOKEN`, `VERCEL_ORG_ID` (= `orgId`) en `VERCEL_PROJECT_ID` (= `projectId`).
4. De omgevingsvariabelen uit de tabel hierboven instellen.
5. Neon koppelen via Vercel (*Storage → Neon*), alleen voor **Production** (Neon-branch `main`).
   Vercel zet dan o.a. `DATABASE_URL` en `DATABASE_URL_UNPOOLED` als *sensitive* variabelen.
6. Een Neon-branch `dev` maken en die voor Preview en Development instellen, bijv. met de
   [Neon CLI](https://neon.com/docs/cli/install.md) (project `neon-gokkast`):
   ```bash
   neon branches create --project-id <project-id> --name dev
   neon cs dev --project-id <project-id> --pooled | npx vercel@60.1.3 env add DATABASE_URL preview
   neon cs dev --project-id <project-id> | npx vercel@60.1.3 env add DATABASE_URL_UNPOOLED preview
   # en hetzelfde voor development
   ```
7. GitHub-environment-secret `DATABASE_URL_UNPOOLED` (directe verbinding) voor de migraties:
   environment **Production** = Neon `main`, **Preview** = Neon `dev`
   (`gh secret set DATABASE_URL_UNPOOLED --env Production`). Sensitive Vercel-variabelen komen
   niet mee met `vercel pull`, daarom staat dit secret apart in GitHub.

## Projectstructuur

```
Gokkast/
├── public/images/      plaatjes voor de rollen (beker, kakkerlak, vraagteken)
├── src/
│   ├── app/            layout, pagina, server actions (actions.ts) en globale CSS (Next.js App Router)
│   │   ├── game-manager/  beheerpagina met moeilijkheidsgraad (SettingsForm), server actions en inlogpagina (inloggen/)
│   │   └── api/auth/      Auth.js-routes (inloggen, terugkeer van Google, uitloggen)
│   ├── auth.ts         Auth.js-instellingen (Google, alleen beheerders)
│   ├── components/     SlotMachine, Reel, Lever, InfoPanel, Stats, SettingsDialog, GameClient
│   ├── lib/            spellogica (game.ts), instellingen (settings.ts, settingsStore.ts), database (db.ts), rondes opslaan (gameStore.ts), beheerders (admins.ts, dal.ts), geluid, opslag, muntenregen, tests (*.test.ts)
│   └── generated/      Prisma Client (gegenereerd, niet in git)
├── prisma/             schema.prisma, migrations/, seed.ts
├── prisma.config.ts    instellingen voor de Prisma CLI
├── .mcp.json           Neon MCP-server voor coding agents (aanmelden met OAuth, geen sleutel)
├── .env.example        alle instellingen met uitleg (kopiëren naar .env.local)
├── .github/workflows/  CI/CD: controles en deploy naar Vercel (ci-cd.yml)
├── vercel.json         Vercel-instellingen (eigen Git-deploys uit)
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
