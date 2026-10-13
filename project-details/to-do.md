# To-do — Eenarmige Bandiet

Werkwijze: elke taak is één feature voor `/feature` (load → start → test → review → complete).
De taken staan in volgorde: latere taken bouwen voort op eerdere.

## Versie 2 — Open

### Basis

- [x] **1. Omzetten naar Next.js + React + TypeScript**
  - Nieuw Next.js-project (App Router, TypeScript) in de projectmap
  - Spellogica (`winChance`, uitkomst bepalen, pogingen, vastzetten) naar losse TypeScript-module
  - Gokkast als React-componenten (kast, rollen, VAST-knoppen, hendel, berichtenbord)
  - Plaatjes naar `public/images/`; uiterlijk en gedrag gelijk aan versie 1
  - Git-repository opzetten (nodig voor de feature-werkwijze en Vercel)

- [x] **2. Instellingen in .env-bestanden**
  - Winkans aantal pogingen, aantal speelrondes per betaling opslaan in .env bestand, 
  - later bij 6 halen wij dit uit de database en is het confugureerbaar in game-manager

- [x] **3. Automatische tests met Vitest**
  - Vitest installeren en `npm test` instellen
  - Tests voor de spellogica: winkans per aantal vastgezette rollen, nooit drie gelijke bij verlies, pogingen, maximaal 2 rollen vast

- [ ] **4. Visuele tests met Playwright**
  - Playwright installeren en instellen
  - Tests: spel laadt op 1024x768, draaien, rol vastzetten, winst- en verliesmelding, nieuw spel
  - Uitkomst forceren in de test (bijv. winkans 1 via testinstelling) zodat de tests voorspelbaar zijn

- [ ] **5. CI/CD met Vercel**
  - Repository koppelen aan Vercel
  - Preview-deploy per branch, productie-deploy vanaf `main`
  - Vitest (en Playwright) draaien vóór een deploy
  - Omgevingsvariabelen per omgeving in Vercel instellen

### Database

- [ ] **6. Database met Neon en Prisma**
  - Neon-project met aparte branches voor ontwikkeling en productie
  - Prisma installeren en koppelen via `DATABASE_URL` in `.env`
  - Winkans aantal pogingen, aantal speelrondes per betaling uit in database tabel game-settings
  - Schema: `Game` (speelrondes: naam, uitkomst, aantal pogingen, datum) en `Payment`
  - Eerste migratie en seed-data voor ontwikkeling

- [ ] **7. Spelletjes opslaan in de database**
  - Na elk spel de ronde opslaan (naam, gewonnen/verloren, pogingen, datum)
  - Opslaan via server action of API-route, niet vanuit de browser direct

### Game-manager

- [ ] **8. Game-manager pagina met OAuth**
  - Pagina `/game-manager`, alleen toegankelijk na inloggen
  - OAuth via Auth.js (provider kiezen, bijv. Google of GitHub)
  - Alleen toegestane beheerders (lijst in `.env`)

- [ ] **9. Moeilijkheidsgraad aanpassen in de game-manager**
  - Winkans instellen vanuit de game-manager
  - Waarde opslaan in de database; `.env` blijft de standaardwaarde
  - Spel gebruikt de ingestelde waarde

### Betalingen

- [ ] **10. Betalen met Mollie (testomgeving)**
  - Mollie test-API-key in `.env`, geen echte betalingen
  - Betaalflow: betalen → terug naar het spel → spel vrijgegeven
  - Webhook die de betaalstatus verwerkt

- [ ] **11. Betalingen versleuteld opslaan en koppelen aan spelletjes**
  - Naam, rekeningnummer en bedrag versleuteld opslaan (sleutel in `.env`)
  - Spelletjes koppelen aan de betaling waarmee ze gespeeld zijn
  - Tests voor versleutelen en ontsleutelen

- [ ] **12. Mollie productieomgeving**
  - Live-API-key alleen in de productie-omgeving van Vercel
  - Controleren dat preview/ontwikkeling altijd de testmodus gebruikt

### Game-manager uitbreiden

- [ ] **13. Speelrondes en statistieken in de game-manager**
  - Overzicht van speelrondes
  - Aantal wins/loses per naam

- [ ] **14. Betalingen in de game-manager**
  - Overzicht van betalingen: naam en bedrag (ontsleuteld weergegeven)

## Open vragen

- Waarvoor wordt betaald: per spel van 3 pogingen, of een tegoed voor meerdere spellen? Wat kost het?
- Waar komt de naam van de speler vandaan: invullen in het spel of uit de Mollie-betaling?
- Welke OAuth-provider voor de game-manager (Google, GitHub, Microsoft)?
- Moet het rekeningnummer getoond worden in de game-manager, of alleen naam en bedrag?

## Ideeën

- [ ] Het spel volledig doorspelen in de browser en testen (draaien, vastzetten, winnen, verliezen)
- [ ] Winkans per spel van 3 pogingen in plaats van per draai (optie)
- [ ] `build-log.md` eventueel hernoemen

## Klaar (versie 1)

- [x] Gokkast gebouwd (1024x768, 3 rollen, 3 pogingen, rollen vastzetten)
- [x] Winkans instelbaar (standaard 1 op 30)
- [x] Vastzetten verhoogt de kans
- [x] CSS en JavaScript in losse bestanden
- [x] Teksten bij winst/verlies en "NIEUW SPEL" 15% kleiner
- [x] Map `build-log` hernoemd naar `project-details`
