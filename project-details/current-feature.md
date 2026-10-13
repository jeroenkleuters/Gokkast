# Current Feature: Omzetten naar Next.js + React + TypeScript

## Status

In Progress

## Goals

- Nieuw Next.js-project (App Router, TypeScript) in de projectmap
- Spellogica (`winChance`, uitkomst bepalen, pogingen, vastzetten) in een losse TypeScript-module zonder React-afhankelijkheden
- Gokkast als React-componenten: kast, rollen, VAST-knoppen, hendel, berichtenbord, info en statistieken, instellingen
- Plaatjes in `public/images/`
- Uiterlijk en gedrag gelijk aan versie 1: 1024x768 schalend, 3 pogingen, max. 2 rollen vast, vastzetten verhoogt de kans, winkans standaard 1 op 30 en instelbaar (tandwiel en `?kans=`), geluid aan/uit, sneltoetsen, muntenregen
- `npm run dev`, `npm run build` en `npm run lint` werken zonder fouten
- Git-repository opgezet met `.gitignore` (o.a. `node_modules`, `.next`, `.env*`)

## Notes

- Taak 1 uit `project-details/to-do.md` (versie 2).
- Versie 1 staat in `index.html`, `style.css` en `game.js`; die dienen als referentie en worden na de omzetting verwijderd of verplaatst (bijv. naar een map `v1/`).
- De winkans-formule blijft: elke draaiende rol valt goed met kans (1/winkans)^(1/3); vastgezette rollen met verschillende plaatjes geven kans 0.
- Instellingen via `.env` horen bij taak 2, tests bij taak 3 en 4; die vallen buiten deze feature.
- Git bestond al (remote `origin` = github.com/jeroenkleuters/Gokkast, commit `version1` op `main`); branch `feature/nextjs-react-typescript` aangemaakt.

## History

<!-- Afgeronde features worden hier toegevoegd -->
