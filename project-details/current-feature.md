# Current Feature: Game-manager pagina met OAuth

## Status

Complete

## Goals

- Pagina `/game-manager` bestaat en is alleen toegankelijk na inloggen; zonder sessie → doorsturen naar inloggen
- Inloggen via OAuth met Auth.js en Google (keuze gebruiker)
- Alleen beheerders uit een lijst in `.env` (`GAME_MANAGER_ADMINS`, komma-gescheiden) krijgen toegang; andere ingelogde gebruikers krijgen "geen toegang"
- Controle op de server, dicht bij de data (pagina en latere server actions/data-functies), niet alleen in `proxy.ts`
- Uitloggen werkt; de pagina toont wie er is ingelogd
- Eerste opzet van de pagina (titel, ingelogde beheerder, plek voor instellingen/statistieken uit taak 9, 13, 14) — nog zonder beheerfuncties
- Het spel zelf blijft zonder inloggen speelbaar
- Nieuwe variabelen (`AUTH_SECRET`, provider-id/-secret, beheerderslijst) in `.env.example`, README en Vercel per omgeving (Production, Preview, Development)
- Tests: Vitest voor de beheerderscontrole (lijst lezen, hoofdletters/spaties, lege lijst = niemand); Playwright: `/game-manager` zonder sessie stuurt door en het spel blijft werken
- Lint, typecheck, build, Vitest en Playwright zonder fouten; in de browser gecontroleerd (lokaal en preview)

## Notes

- Keuze gebruiker: Google; inloggen alleen lokaal en in productie (geen redirect-proxy voor previews). Beheerderslijst: `GAME_MANAGER_ADMINS`.
- Next.js 16: `middleware.ts` heet nu `proxy.ts`. Geen proxy gebruikt: de echte controle zit in de Data Access Layer (`src/lib/dal.ts`, `checkAdmin`), zoals `authentication.md` aanraadt; het spel hoeft er niet langs. Auth.js `next-auth@5.0.0-beta.32` (peer `next ^16`), versie vastgezet.
- Callback-URL's: OAuth-app moet `localhost:3000`, `gokkast.vercel.app` en preview-URL's toestaan. Preview-URL's wisselen per deploy en Deployment Protection staat aan; mogelijk een vaste redirect-proxy (`AUTH_REDIRECT_PROXY_URL`) of inloggen alleen controleren lokaal en in productie.
- Lege of ontbrekende beheerderslijst = niemand heeft toegang (veilig standaard).
- Sessie liefst als JWT in een cookie, zodat er geen extra databasetabellen nodig zijn; anders Prisma-adapter met migratie.
- Playwright draait zonder database en zonder echte OAuth: test alleen het doorsturen en dat het spel ongewijzigd werkt.
- Volgende taken bouwen hierop voort: 9 (winkans instellen), 13 (statistieken), 14 (betalingen).

## History

<!-- Afgeronde features worden hier toegevoegd -->

- **Omzetten naar Next.js + React + TypeScript** (13 oktober 2026, taak 1) — Next.js 16 / React 19 / TypeScript; spellogica in `src/lib/game.ts`, gokkast als React-componenten, plaatjes in `public/images/`, versie 1 bewaard in `v1/`. Lint, typecheck en build zonder fouten; in de browser gecontroleerd. Commit `447b89c`.
- **Instellingen in .env-bestanden** (13 oktober 2026, taak 2) — `src/lib/settings.ts` leest `GAME_ODDS` (30), `GAME_MAX_TRIES` (3), `GAME_ROUNDS_PER_PAYMENT` (1) en `GAME_ALLOW_ODDS_URL` per verzoek op de server; `?kans=` alleen met die vlag; tandwiel alleen-lezen; `.env.example` en README bijgewerkt. Lint, typecheck en build zonder fouten; in de browser gecontroleerd met standaard-, test- en ongeldige waarden. Commit `0f5cf02`.
- **Automatische tests met Vitest** (13 oktober 2026, taak 3) — Vitest 5 met `npm test` en `npm run test:watch`; `vitest.config.mts` (node, `src/**/*.test.ts`, `@/`-paden). `game.test.ts` (30 tests: winkans, uitkomst, pogingen, vastzetten, nieuw spel) en `settings.test.ts` (9 tests: `.env`-waarden, grenzen, `GAME_ALLOW_ODDS_URL`). Lint, typecheck, build en 39 tests zonder fouten; foutcontrole met een tijdelijk kapotte `game.ts`. Commit `f1b4ee1`.
- **Visuele tests met Playwright** (13 oktober 2026, taak 4) — `@playwright/test` 1.64 met `npm run test:e2e` en `test:e2e:ui`; `playwright.config.ts` (Chromium 1024x768, `e2e/*.spec.ts`, `webServer` bouwt en start de app op poort 3100 met `GAME_ALLOW_ODDS_URL=true`). `e2e/gokkast.spec.ts` (6 tests: laden, hendel, vastzetten max 2, winst, verlies, nieuw spel); voorspelbaar via `?kans=1` (winst) en `?kans=100000` met `Math.random` ≥ 0,05 (verlies). 30/30 bij 5x herhalen; foutcontrole met tijdelijk `MAX_HELD = 3`; lint, typecheck, build en 39 Vitest-tests zonder fouten. Commit `7762a9a`.
- **CI/CD met Vercel** (13 oktober 2026, taak 5) — aanpak A: `.github/workflows/ci-cd.yml` draait bij elke push lint, typecheck, Vitest en Playwright en deployt daarna pas met de Vercel CLI 60.1.3 (`pull`/`build`/`deploy --prebuilt`; preview per branch, `--prod` op `main`, URL als GitHub-environment); `vercel.json` zet Vercels eigen Git-deploys uit. Secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; Vercel-variabelen per omgeving (`GAME_ALLOW_ODDS_URL` alleen aan in Preview/Development). Debug-runs geven `--debug` aan de CLI. Preview gecontroleerd met `vercel curl` (Deployment Protection aan). README-sectie Deployen. Commit `698444a`.
- **Database met Neon en Prisma** (13 oktober 2026, taak 6) — Prisma 7.10 met `@prisma/adapter-neon`; schema `game_settings` (één rij), `games` (naam, `WON`/`LOST`, pogingen, datum) en `payments` (naam, bedrag in centen); migratie `20261013000000_init` en seed (instellingen + 4 voorbeeldrondes). `loadSettings` leest de database met terugval op `.env` (geen rij, ongeldige waarde, fout of 5 s timeout); tandwiel toont de bron. Neon-project `neon-gokkast`: `main` voor Production (Vercel-integratie), `dev` voor Preview/Development. Workflow past migraties toe vóór de deploy met GitHub-environment-secret `DATABASE_URL_UNPOOLED` (sensitive Vercel-variabelen komen niet mee met `vercel pull`); Playwright zonder database. Neon CLI 6.2.4, MCP-server (OAuth, `.mcp.json`) en skills `neon`, `neon-postgres`, `neon-postgres-branches`. 48 Vitest- en 6 Playwright-tests; lokaal en in de preview gecontroleerd dat de instellingen uit de database komen. Commit `2da2855`.
- **Spelletjes opslaan in de database** (13 oktober 2026, taak 7) — server action `saveGame` (`src/app/actions.ts`) slaat aan het eind van elk spel de ronde op in `games` (uitkomst, pogingen, datum); aanroep één keer vanuit `play()` in `SlotMachine.tsx`. `src/lib/gameStore.ts` controleert de invoer (`WON`/`LOST`, pogingen 1 t/m `maxTries`, verlies alleen na alle pogingen) en slaat op; zonder database of bij een fout gaat het spel door met een waarschuwing in de serverlog. Besluit gebruiker: geen naam in het spel (komt uit de QR-betaling, taak 10/11), highscores alleen in de game-manager; daarom `games.name` optioneel (migratie `20261013163330_games_name_optional`). 57 Vitest- en 8 Playwright-tests; in de `dev`-database gecontroleerd met een gespeelde winst en verlies. Commit `794b201`.
