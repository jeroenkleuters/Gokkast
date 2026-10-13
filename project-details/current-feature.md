# Current Feature

## Status

Not Started

## Goals

<!-- Doelen van de feature, in te vullen met /feature load -->

## Notes

<!-- Extra context, beperkingen of details uit de spec -->

## History

<!-- Afgeronde features worden hier toegevoegd -->

- **Omzetten naar Next.js + React + TypeScript** (13 oktober 2026, taak 1) — Next.js 16 / React 19 / TypeScript; spellogica in `src/lib/game.ts`, gokkast als React-componenten, plaatjes in `public/images/`, versie 1 bewaard in `v1/`. Lint, typecheck en build zonder fouten; in de browser gecontroleerd. Commit `447b89c`.
- **Instellingen in .env-bestanden** (13 oktober 2026, taak 2) — `src/lib/settings.ts` leest `GAME_ODDS` (30), `GAME_MAX_TRIES` (3), `GAME_ROUNDS_PER_PAYMENT` (1) en `GAME_ALLOW_ODDS_URL` per verzoek op de server; `?kans=` alleen met die vlag; tandwiel alleen-lezen; `.env.example` en README bijgewerkt. Lint, typecheck en build zonder fouten; in de browser gecontroleerd met standaard-, test- en ongeldige waarden. Commit `0f5cf02`.
- **Automatische tests met Vitest** (13 oktober 2026, taak 3) — Vitest 5 met `npm test` en `npm run test:watch`; `vitest.config.mts` (node, `src/**/*.test.ts`, `@/`-paden). `game.test.ts` (30 tests: winkans, uitkomst, pogingen, vastzetten, nieuw spel) en `settings.test.ts` (9 tests: `.env`-waarden, grenzen, `GAME_ALLOW_ODDS_URL`). Lint, typecheck, build en 39 tests zonder fouten; foutcontrole met een tijdelijk kapotte `game.ts`. Commit `f1b4ee1`.
- **Visuele tests met Playwright** (13 oktober 2026, taak 4) — `@playwright/test` 1.64 met `npm run test:e2e` en `test:e2e:ui`; `playwright.config.ts` (Chromium 1024x768, `e2e/*.spec.ts`, `webServer` bouwt en start de app op poort 3100 met `GAME_ALLOW_ODDS_URL=true`). `e2e/gokkast.spec.ts` (6 tests: laden, hendel, vastzetten max 2, winst, verlies, nieuw spel); voorspelbaar via `?kans=1` (winst) en `?kans=100000` met `Math.random` ≥ 0,05 (verlies). 30/30 bij 5x herhalen; foutcontrole met tijdelijk `MAX_HELD = 3`; lint, typecheck, build en 39 Vitest-tests zonder fouten. Commit `7762a9a`.
- **CI/CD met Vercel** (13 oktober 2026, taak 5) — aanpak A: `.github/workflows/ci-cd.yml` draait bij elke push lint, typecheck, Vitest en Playwright en deployt daarna pas met de Vercel CLI 60.1.3 (`pull`/`build`/`deploy --prebuilt`; preview per branch, `--prod` op `main`, URL als GitHub-environment); `vercel.json` zet Vercels eigen Git-deploys uit. Secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; Vercel-variabelen per omgeving (`GAME_ALLOW_ODDS_URL` alleen aan in Preview/Development). Debug-runs geven `--debug` aan de CLI. Preview gecontroleerd met `vercel curl` (Deployment Protection aan). README-sectie Deployen. Commit `698444a`.
