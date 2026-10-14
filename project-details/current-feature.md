# Current Feature: Betalen met Mollie (testomgeving)

## Status

Complete

## Goals

- Mollie test-API-key (`test_...`) in `.env` en `.env.example`; er zijn geen echte betalingen mogelijk
- Prijs: 4 spelletjes voor € 1,00 (1 credit = 1 spel van 3 pogingen); `GAME_ROUNDS_PER_PAYMENT` standaard 4, prijs in `.env` (`GAME_PRICE_CENTS=100`)
- Speler zonder credits klikt op speel → popup met een QR-code van een **unieke Mollie-betaling voor deze speler** (Payments API, per klik een nieuwe betaling; QR gemaakt van de checkout-URL) plus een link om op hetzelfde apparaat te betalen
- Na betalen krijgt de speler 4 credits; elk gespeeld spel kost 1 credit; bij 0 credits weer de popup
- Credits staan op de server bij de betaling (niet alleen in de browser); de browser kent alleen het betaal-ID
- Betaalflow: betalen → terug naar het spel (`redirectUrl`) → spel vrijgegeven; de popup ziet ook zelf dat er betaald is (status opvragen) als er op een telefoon betaald wordt
- Webhook (API-route) die de betaalstatus bij Mollie ophaalt en verwerkt; de status nooit uit het verzoek zelf overnemen
- Betaling registreren in de tabel `payments` (Mollie-ID, betaallink, bedrag in centen, status, credits, naam rekeninghouder)
- Naam van de rekeninghouder (`details.consumerName`) koppelen aan de spelletjes die met die betaling gespeeld zijn
- Vitest-tests voor de betaallogica en de webhook; Playwright-tests voor de betaalflow zonder echte Mollie-aanroepen

## Notes

- Taak 10 uit `project-details/to-do.md`. Documentatie: https://docs.mollie.com/docs/getting-started
- Alleen testmodus; live-key en productie volgen in taak 12. Versleuteld opslaan van naam en rekeningnummer volgt in taak 11 — nu nog niet versleutelen, wel zo opzetten dat taak 11 erop kan voortbouwen.
- Overzichten van betalingen en speelrondes in de game-manager volgen in taak 13 en 14.
- Besluit taak 7: geen naam invullen in het spel; de naam komt uit de transactie. `games.name` is optioneel.
- De naam van de rekeninghouder staat bij Mollie in `details.consumerName` (o.a. iDEAL/bankoverboeking), pas na betaling.
- Mollie moet de webhook kunnen bereiken: lokaal niet zonder tunnel; in de Vercel-preview staat Deployment Protection aan. Testen kan ook door de status op te halen bij terugkeer naar het spel.
- Geheimen (`MOLLIE_API_KEY`) alleen op de server; nooit in de browser.
- Besluiten gebruiker (14 oktober 2026):
  - 4 spelletjes voor € 1,00.
  - Mollie-betaling met QR-code tonen in een popup als iemand op speel klikt; de speler krijgt dan 4 credits.
  - Per speler een unieke betaallink van Mollie, opgeslagen in de database met naam en rekeningnummer. Daardoor vervalt het uploaden van een vaste QR-code in de game-manager.
- Rekeningnummer (`details.consumerAccount`): pas in taak 11 opslaan, en dan versleuteld; in taak 10 alleen de naam. Zo komt er nooit een onversleuteld rekeningnummer in de database.
- Naam en rekeningnummer zijn er alleen bij betaalmethoden die ze teruggeven (o.a. iDEAL); anders blijft de naam leeg.
- Keuzes bij de bouw (14 oktober 2026):
  - Zonder `MOLLIE_API_KEY` staat betalen uit en is het spel gratis (ook productie tot taak 12); een `live_`-key wordt geweigerd.
  - Eigen kleine `fetch`-client voor Mollie (twee aanroepen) in plaats van de SDK; `MOLLIE_API_URL` alleen voor de nep-Mollie van Playwright.
  - QR-code door de app gemaakt van de checkout-URL (`qrcode` 1.5.4); de QR van Mollie zelf werkt alleen voor iDEAL/Bancontact/overboeking.
  - Token in httpOnly-cookie `gokkast-betaling`; credits atomair afgeboekt aan het begin van elk spel; betaald is definitief (credits één keer).
  - Playwright: tweede server (poort 3102) met betalen aan en betalingen in het geheugen (`PAYMENTS_TEST_STORE`, nooit in productie of met database).

## History

<!-- Afgeronde features worden hier toegevoegd -->

- **Omzetten naar Next.js + React + TypeScript** (13 oktober 2026, taak 1) — Next.js 16 / React 19 / TypeScript; spellogica in `src/lib/game.ts`, gokkast als React-componenten, plaatjes in `public/images/`, versie 1 bewaard in `v1/`. Lint, typecheck en build zonder fouten; in de browser gecontroleerd. Commit `447b89c`.
- **Instellingen in .env-bestanden** (13 oktober 2026, taak 2) — `src/lib/settings.ts` leest `GAME_ODDS` (30), `GAME_MAX_TRIES` (3), `GAME_ROUNDS_PER_PAYMENT` (1) en `GAME_ALLOW_ODDS_URL` per verzoek op de server; `?kans=` alleen met die vlag; tandwiel alleen-lezen; `.env.example` en README bijgewerkt. Lint, typecheck en build zonder fouten; in de browser gecontroleerd met standaard-, test- en ongeldige waarden. Commit `0f5cf02`.
- **Automatische tests met Vitest** (13 oktober 2026, taak 3) — Vitest 5 met `npm test` en `npm run test:watch`; `vitest.config.mts` (node, `src/**/*.test.ts`, `@/`-paden). `game.test.ts` (30 tests: winkans, uitkomst, pogingen, vastzetten, nieuw spel) en `settings.test.ts` (9 tests: `.env`-waarden, grenzen, `GAME_ALLOW_ODDS_URL`). Lint, typecheck, build en 39 tests zonder fouten; foutcontrole met een tijdelijk kapotte `game.ts`. Commit `f1b4ee1`.
- **Visuele tests met Playwright** (13 oktober 2026, taak 4) — `@playwright/test` 1.64 met `npm run test:e2e` en `test:e2e:ui`; `playwright.config.ts` (Chromium 1024x768, `e2e/*.spec.ts`, `webServer` bouwt en start de app op poort 3100 met `GAME_ALLOW_ODDS_URL=true`). `e2e/gokkast.spec.ts` (6 tests: laden, hendel, vastzetten max 2, winst, verlies, nieuw spel); voorspelbaar via `?kans=1` (winst) en `?kans=100000` met `Math.random` ≥ 0,05 (verlies). 30/30 bij 5x herhalen; foutcontrole met tijdelijk `MAX_HELD = 3`; lint, typecheck, build en 39 Vitest-tests zonder fouten. Commit `7762a9a`.
- **CI/CD met Vercel** (13 oktober 2026, taak 5) — aanpak A: `.github/workflows/ci-cd.yml` draait bij elke push lint, typecheck, Vitest en Playwright en deployt daarna pas met de Vercel CLI 60.1.3 (`pull`/`build`/`deploy --prebuilt`; preview per branch, `--prod` op `main`, URL als GitHub-environment); `vercel.json` zet Vercels eigen Git-deploys uit. Secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; Vercel-variabelen per omgeving (`GAME_ALLOW_ODDS_URL` alleen aan in Preview/Development). Debug-runs geven `--debug` aan de CLI. Preview gecontroleerd met `vercel curl` (Deployment Protection aan). README-sectie Deployen. Commit `698444a`.
- **Database met Neon en Prisma** (13 oktober 2026, taak 6) — Prisma 7.10 met `@prisma/adapter-neon`; schema `game_settings` (één rij), `games` (naam, `WON`/`LOST`, pogingen, datum) en `payments` (naam, bedrag in centen); migratie `20261013000000_init` en seed (instellingen + 4 voorbeeldrondes). `loadSettings` leest de database met terugval op `.env` (geen rij, ongeldige waarde, fout of 5 s timeout); tandwiel toont de bron. Neon-project `neon-gokkast`: `main` voor Production (Vercel-integratie), `dev` voor Preview/Development. Workflow past migraties toe vóór de deploy met GitHub-environment-secret `DATABASE_URL_UNPOOLED` (sensitive Vercel-variabelen komen niet mee met `vercel pull`); Playwright zonder database. Neon CLI 6.2.4, MCP-server (OAuth, `.mcp.json`) en skills `neon`, `neon-postgres`, `neon-postgres-branches`. 48 Vitest- en 6 Playwright-tests; lokaal en in de preview gecontroleerd dat de instellingen uit de database komen. Commit `2da2855`.
- **Spelletjes opslaan in de database** (13 oktober 2026, taak 7) — server action `saveGame` (`src/app/actions.ts`) slaat aan het eind van elk spel de ronde op in `games` (uitkomst, pogingen, datum); aanroep één keer vanuit `play()` in `SlotMachine.tsx`. `src/lib/gameStore.ts` controleert de invoer (`WON`/`LOST`, pogingen 1 t/m `maxTries`, verlies alleen na alle pogingen) en slaat op; zonder database of bij een fout gaat het spel door met een waarschuwing in de serverlog. Besluit gebruiker: geen naam in het spel (komt uit de QR-betaling, taak 10/11), highscores alleen in de game-manager; daarom `games.name` optioneel (migratie `20261013163330_games_name_optional`). 57 Vitest- en 8 Playwright-tests; in de `dev`-database gecontroleerd met een gespeelde winst en verlies. Commit `794b201`.
- **Game-manager pagina met OAuth** (13 oktober 2026, taak 8) — `/game-manager` alleen voor beheerders; inloggen met Google via Auth.js (`next-auth@5.0.0-beta.32`, vastgezet), JWT-sessie in een cookie (`src/auth.ts`, route `src/app/api/auth/[...nextauth]`). Beheerderslijst `GAME_MANAGER_ADMINS` (`src/lib/admins.ts`, leeg = niemand); `signIn`-callback geeft alleen een sessie bij een bevestigd adres uit de lijst, en `checkAdmin` in `src/lib/dal.ts` controleert elke pagina op de server (geen sessie → `/game-manager/inloggen`, niet meer in de lijst → geen toegang). Geen `proxy.ts`. Inlogpagina met melding bij `AccessDenied`, uitloggen, plekken voor taak 9, 13 en 14. Keuze gebruiker: Google, inloggen alleen lokaal en in productie. 64 Vitest- en 13 Playwright-tests (Google onderschept, nep-sleutels); lokaal ingelogd en uitgelogd door de gebruiker. Vercel-variabelen door de gebruiker gezet, alleen voor Production. Commit `c6b1e43`.
- **Moeilijkheidsgraad aanpassen in de game-manager** (13 oktober 2026, taak 9) — sectie Moeilijkheidsgraad op `/game-manager` (`SettingsForm.tsx`, `useActionState`): winkans met snelkeuze (makkelijk 1 op 10, normaal 1 op 30, moeilijk 1 op 100) of eigen getal, plus pogingen en speelrondes per betaling (keuze gebruiker: alle drie); per veld "Terug naar standaard". Server action `updateSettings` doet `checkAdmin`, controleert met `parseSettingsForm` (zelfde grenzen als `.env`), slaat op met `saveStoredSettings` (upsert rij 1) en ververst `/` en `/game-manager`. Kolommen van `game_settings` optioneel, leeg = `.env`-waarde (migratie `20261013200000_game_settings_optional`); `mergeSettings` per veld. Zonder database een melding, database onbereikbaar → formulier verborgen. 85 Vitest- en 17 Playwright-tests (ondertekende testsessie in `e2e/auth.ts`); lokaal opgeslagen door de gebruiker in de `dev`-database. Commit `3f1a2d0`.
- **Gewonnen plaatje opslaan in de uitkomst** (13 oktober 2026, taak 9b) — enum `GameOutcome` = `WON_SHOT`/`WON_KAKKERLAK`/`WON_VRAAGTEKEN` (in de database letterlijk `WON shot`, `WON kakkerlak`, `WON vraagteken` via `@map`) en `LOST`; migratie `20261013230000_games_outcome_symbol` verwijdert oude `WON`-rijen zonder plaatje (besluit gebruiker: geschiedenis niet belangrijk). `SYMBOL_NAMES` in `src/lib/game.ts`; `SlotMachine.tsx` stuurt `WON <plaatje>` mee; `parseGameResult` accepteert alleen de vier waarden, `DB_OUTCOMES` zet om naar de Prisma-enum. Plaatje beker hernoemd naar shot. 86 Vitest- en 17 Playwright-tests; in `dev` gecontroleerd met gespeelde winsten (`WON shot`, `WON vraagteken`) na herstart van de dev-server (oude Prisma Client in het geheugen). Commit `00f52cc`.
