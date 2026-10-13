# Current Feature: Visuele tests met Playwright

## Status

Complete

## Goals

- Playwright (`@playwright/test`) geïnstalleerd en ingesteld, met een npm-script (bijv. `npm run test:e2e`)
- Playwright start zelf de app (`webServer` in de config) en test in een browservenster van 1024x768
- Test: het spel laadt op 1024x768 (kast, drie rollen, hendel en berichtenbord zichtbaar)
- Test: draaien met de hendel verbruikt een poging en verandert de rollen
- Test: een rol vastzetten met de VAST-knop (en maximaal 2 rollen vast)
- Test: winstmelding verschijnt bij een gewonnen draai
- Test: verliesmelding verschijnt als alle pogingen op zijn zonder winst
- Test: "NIEUW SPEL" zet het spel terug naar de beginstand
- Uitkomst voorspelbaar gemaakt in de tests (bijv. winkans 1 via een testinstelling), zodat de tests niet toevallig slagen of falen
- `npm test` (Vitest) blijft los van Playwright werken; lint, typecheck en build zonder fouten

## Notes

- Taak 4 uit `to-do.md`; bouwt voort op taak 1 (Next.js-app), taak 2 (`.env`-instellingen) en taak 3 (Vitest).
- Uitkomst forceren: `GAME_ALLOW_ODDS_URL=true` met `?kans=1` geeft altijd winst; voor verlies is een andere aanpak nodig (bijv. `Math.random` in de test vastzetten via `page.addInitScript`, of een zeer hoge `GAME_ODDS`). Testinstellingen alleen voor de testserver, niet in de standaard `.env`.
- Vitest zoekt in `src/**/*.test.ts`; Playwright-tests apart houden (bijv. map `e2e/` met `*.spec.ts`) zodat de twee elkaar niet oppakken.
- Rekening houden met animaties (draaien, munten) en geluid: wachten op de melding in plaats van vaste pauzes.
- Testresultaten en -rapporten (`test-results/`, `playwright-report/`) in `.gitignore`.
- Taak 5 (CI/CD met Vercel) gaat deze tests later vóór een deploy draaien.
- Next.js 16 heeft breaking changes: eerst de docs in `node_modules/next/dist/docs/` raadplegen (o.a. over testen met Playwright).

## History

<!-- Afgeronde features worden hier toegevoegd -->

- **Omzetten naar Next.js + React + TypeScript** (13 oktober 2026, taak 1) — Next.js 16 / React 19 / TypeScript; spellogica in `src/lib/game.ts`, gokkast als React-componenten, plaatjes in `public/images/`, versie 1 bewaard in `v1/`. Lint, typecheck en build zonder fouten; in de browser gecontroleerd. Commit `447b89c`.
- **Instellingen in .env-bestanden** (13 oktober 2026, taak 2) — `src/lib/settings.ts` leest `GAME_ODDS` (30), `GAME_MAX_TRIES` (3), `GAME_ROUNDS_PER_PAYMENT` (1) en `GAME_ALLOW_ODDS_URL` per verzoek op de server; `?kans=` alleen met die vlag; tandwiel alleen-lezen; `.env.example` en README bijgewerkt. Lint, typecheck en build zonder fouten; in de browser gecontroleerd met standaard-, test- en ongeldige waarden. Commit `0f5cf02`.
- **Automatische tests met Vitest** (13 oktober 2026, taak 3) — Vitest 5 met `npm test` en `npm run test:watch`; `vitest.config.mts` (node, `src/**/*.test.ts`, `@/`-paden). `game.test.ts` (30 tests: winkans, uitkomst, pogingen, vastzetten, nieuw spel) en `settings.test.ts` (9 tests: `.env`-waarden, grenzen, `GAME_ALLOW_ODDS_URL`). Lint, typecheck, build en 39 tests zonder fouten; foutcontrole met een tijdelijk kapotte `game.ts`. Commit `f1b4ee1`.
