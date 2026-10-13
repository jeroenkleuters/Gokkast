# Current Feature: Automatische tests met Vitest

## Status

Complete

## Goals

- Vitest geïnstalleerd als dev-dependency; `npm test` draait de tests één keer (geschikt voor CI in taak 5)
- Tests voor `winChance`: 0 vast = 1 op odds, 1 vast = (1/odds)^(2/3), 2 gelijke vast = (1/odds)^(1/3), 2 verschillende vast = 0
- Tests voor `decideOutcome`: bij winst drie gelijke (met het vastgezette plaatje), bij verlies nooit drie gelijke en vastgezette rollen blijven staan
- Tests voor pogingen in `gameReducer`: `spinStart` verlaagt `triesLeft`, geen draai bij 0 pogingen of tijdens draaien, verlies na de laatste poging, winst eindigt het spel, `newGame` zet alles terug
- Tests voor vastzetten: maximaal 2 rollen vast (`MAX_HELD`), niet vóór de eerste draai, niet tijdens draaien of na afloop, losmaken mag altijd
- Tests voor `src/lib/settings.ts`: standaardwaarden, geldige en ongeldige `.env`-waarden, `GAME_ALLOW_ODDS_URL`
- Lint, typecheck, build en `npm test` zonder fouten

## Notes

- Spellogica in `src/lib/game.ts` is puur TypeScript zonder React/DOM; `decideOutcome` en `initialState` nemen een `random`-functie aan, dus uitkomsten zijn voorspelbaar te maken met een vaste reeks getallen.
- `readSettings(env)` en `oddsFromUrlAllowed(env)` nemen een env-object aan; geen echte `process.env` nodig in tests.
- Testomgeving `node` volstaat (geen jsdom); componenttests vallen buiten deze taak. Visuele tests komen in taak 4 (Playwright).
- Testbestanden naast de code (`src/lib/*.test.ts`) of in een `tests/`-map; zorgen dat ESLint en `tsc` ze accepteren en dat `next build` ze niet meeneemt.
- Controleren welke Vitest-versie werkt met de huidige Node/TypeScript-versie; config in `vitest.config.ts` met het `@/`-pad-alias uit `tsconfig.json` indien gebruikt.
- README bijwerken met `npm test`.

## History

<!-- Afgeronde features worden hier toegevoegd -->

- **Omzetten naar Next.js + React + TypeScript** (13 oktober 2026, taak 1) — Next.js 16 / React 19 / TypeScript; spellogica in `src/lib/game.ts`, gokkast als React-componenten, plaatjes in `public/images/`, versie 1 bewaard in `v1/`. Lint, typecheck en build zonder fouten; in de browser gecontroleerd. Commit `447b89c`.
- **Instellingen in .env-bestanden** (13 oktober 2026, taak 2) — `src/lib/settings.ts` leest `GAME_ODDS` (30), `GAME_MAX_TRIES` (3), `GAME_ROUNDS_PER_PAYMENT` (1) en `GAME_ALLOW_ODDS_URL` per verzoek op de server; `?kans=` alleen met die vlag; tandwiel alleen-lezen; `.env.example` en README bijgewerkt. Lint, typecheck en build zonder fouten; in de browser gecontroleerd met standaard-, test- en ongeldige waarden. Commit `0f5cf02`.
