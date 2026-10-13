# Current Feature: CI/CD met Vercel

## Status

In Progress

## Goals

- Repository `jeroenkleuters/Gokkast` gekoppeld aan een Vercel-project (Next.js-preset)
- Productie-deploy vanaf `main`; preview-deploy per andere branch (en per pull request), met de preview-URL zichtbaar in GitHub
- Vitest (`npm test`) en Playwright (`npm run test:e2e`) draaien automatisch vóór een deploy; falen de tests, dan wordt er niet gedeployd
- Lint en typecheck draaien mee in dezelfde controle
- Omgevingsvariabelen per omgeving in Vercel: `GAME_ODDS`, `GAME_MAX_TRIES`, `GAME_ROUNDS_PER_PAYMENT` voor Production, Preview en Development; `GAME_ALLOW_ODDS_URL` alleen aan in Preview/Development, uit in Production
- Werkwijze vastgelegd in de README (waar het draait, hoe een deploy verloopt, waar de instellingen staan)
- Gecontroleerd: een preview-deploy van de feature-branch en een productie-deploy na de merge werken in de browser

## Notes

- Taak 5 uit `to-do.md`; bouwt voort op taak 2 (`.env`-instellingen), 3 (Vitest) en 4 (Playwright).
- Aanpak voor "tests vóór deploy" (te kiezen bij start):
  - **A — GitHub Actions + Vercel CLI**: een workflow in `.github/workflows/` draait lint, typecheck, Vitest en Playwright en deployt daarna met `vercel pull/build/deploy --prebuilt` (`--prod` op `main`). Automatische Git-deploys van Vercel dan uit (`git.deploymentEnabled: false` in `vercel.json`). Nodig: GitHub-secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
  - **B — Vercel Git-integratie + GitHub-check**: Vercel deployt zelf per push; een GitHub Actions-workflow draait de tests, en een branch-protection-regel / Vercel "Deployment Checks" houdt promotie naar productie tegen bij falen.
  - Alleen `npm test && next build` als build-commando in Vercel kan ook, maar Playwright in de Vercel-build is onpraktisch (geen browsers).
- Playwright op CI: `npx playwright install --with-deps chromium`; de config gebruikt al `CI` (`forbidOnly`, 1 retry, HTML-rapport, geen `reuseExistingServer`). Rapport als artifact uploaden bij falen.
- De Playwright-`webServer` zet zijn eigen testinstellingen (`GAME_ALLOW_ODDS_URL=true`), dus CI heeft geen `.env` nodig voor de tests.
- Vercel-account en koppeling met GitHub moet de gebruiker zelf aanmaken/autoriseren; tokens nooit in de repo. `.vercel/` staat al in `.gitignore`.
- Taak 12 zet later de Mollie live-key alleen in Production; deze taak legt de scheiding per omgeving vast.
- Next.js 16 heeft breaking changes: eerst de docs in `node_modules/next/dist/docs/` raadplegen (o.a. over deployen).

## History

<!-- Afgeronde features worden hier toegevoegd -->

- **Omzetten naar Next.js + React + TypeScript** (13 oktober 2026, taak 1) — Next.js 16 / React 19 / TypeScript; spellogica in `src/lib/game.ts`, gokkast als React-componenten, plaatjes in `public/images/`, versie 1 bewaard in `v1/`. Lint, typecheck en build zonder fouten; in de browser gecontroleerd. Commit `447b89c`.
- **Instellingen in .env-bestanden** (13 oktober 2026, taak 2) — `src/lib/settings.ts` leest `GAME_ODDS` (30), `GAME_MAX_TRIES` (3), `GAME_ROUNDS_PER_PAYMENT` (1) en `GAME_ALLOW_ODDS_URL` per verzoek op de server; `?kans=` alleen met die vlag; tandwiel alleen-lezen; `.env.example` en README bijgewerkt. Lint, typecheck en build zonder fouten; in de browser gecontroleerd met standaard-, test- en ongeldige waarden. Commit `0f5cf02`.
- **Automatische tests met Vitest** (13 oktober 2026, taak 3) — Vitest 5 met `npm test` en `npm run test:watch`; `vitest.config.mts` (node, `src/**/*.test.ts`, `@/`-paden). `game.test.ts` (30 tests: winkans, uitkomst, pogingen, vastzetten, nieuw spel) en `settings.test.ts` (9 tests: `.env`-waarden, grenzen, `GAME_ALLOW_ODDS_URL`). Lint, typecheck, build en 39 tests zonder fouten; foutcontrole met een tijdelijk kapotte `game.ts`. Commit `f1b4ee1`.
- **Visuele tests met Playwright** (13 oktober 2026, taak 4) — `@playwright/test` 1.64 met `npm run test:e2e` en `test:e2e:ui`; `playwright.config.ts` (Chromium 1024x768, `e2e/*.spec.ts`, `webServer` bouwt en start de app op poort 3100 met `GAME_ALLOW_ODDS_URL=true`). `e2e/gokkast.spec.ts` (6 tests: laden, hendel, vastzetten max 2, winst, verlies, nieuw spel); voorspelbaar via `?kans=1` (winst) en `?kans=100000` met `Math.random` ≥ 0,05 (verlies). 30/30 bij 5x herhalen; foutcontrole met tijdelijk `MAX_HELD = 3`; lint, typecheck, build en 39 Vitest-tests zonder fouten. Commit `7762a9a`.
