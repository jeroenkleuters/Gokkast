# Current Feature: Instellingen in .env-bestanden

## Status

Complete

## Goals

- Winkans komt uit `.env` (standaard 30 als de variabele ontbreekt of ongeldig is)
- Aantal pogingen per spel komt uit `.env` (standaard 3)
- Aantal speelrondes per betaling komt uit `.env` (standaard 1); nog niet gebruikt in het spel, wel ingelezen en gevalideerd zodat taak 10 erop kan bouwen
- Alle instellingen worden op één plek ingelezen en gevalideerd (bijv. `src/lib/settings.ts`), zodat taak 6 die bron later kan vervangen door de database
- `.env.example` in de projectroot met alle variabelen en uitleg
- Echte `.env`-bestanden (`.env`, `.env.local`, `.env.*.local`) staan niet in git
- Tandwiel-instellingen voor de winkans vervallen of worden alleen-lezen (toont de waarde uit `.env`)
- Spel werkt zoals voorheen met de standaardwaarden; lint, typecheck en build zonder fouten
- README bijgewerkt met de nieuwe variabelen

## Notes

- Taak 2 uit `project-details/to-do.md` (tekst aangepast op 13 oktober 2026: speelrondes per betaling toegevoegd).
- Nu staan de waarden vast in `src/lib/game.ts`: `DEFAULT_ODDS = 30` en `MAX_TRIES = 3`.
- `SlotMachine.tsx` leest de winkans nu uit `?kans=` in de adresbalk, daarna `localStorage`, daarna `DEFAULT_ODDS`; `SettingsDialog.tsx` slaat de winkans op in `localStorage`. Beslissen wat er met `?kans=` gebeurt (Playwright-tests in taak 4 willen de uitkomst kunnen forceren).
- `SlotMachine` is een client component: variabelen zijn daar alleen beschikbaar met `NEXT_PUBLIC_`-prefix (ingebakken bij build), of ze worden op de server gelezen in `page.tsx` en als props doorgegeven (runtime, prettiger voor Vercel in taak 5 en voor de database in taak 6). Eerst de env-docs in `node_modules/next/dist/docs/` lezen (zie AGENTS.md).
- Waarden valideren: gehele getallen ≥ 1; `MAX_HELD = 2` blijft vast.
- Speelrondes per betaling: betalen bestaat nog niet (taak 10) en de open vraag "waarvoor wordt betaald" staat nog in `to-do.md`. Standaard 1 is een aanname; aanpassen als die vraag beantwoord is.
- Taak 6 haalt deze instellingen later uit de database-tabel `game-settings`, taak 9 maakt de winkans instelbaar in de game-manager; `.env` blijft dan de standaardwaarde.

## History

<!-- Afgeronde features worden hier toegevoegd -->

- **Omzetten naar Next.js + React + TypeScript** (13 oktober 2026, taak 1) — Next.js 16 / React 19 / TypeScript; spellogica in `src/lib/game.ts`, gokkast als React-componenten, plaatjes in `public/images/`, versie 1 bewaard in `v1/`. Lint, typecheck en build zonder fouten; in de browser gecontroleerd. Commit `447b89c`.
