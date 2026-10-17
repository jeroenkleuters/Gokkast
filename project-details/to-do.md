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

- [x] **4. Visuele tests met Playwright**
  - Playwright installeren en instellen
  - Tests: spel laadt op 1024x768, draaien, rol vastzetten, winst- en verliesmelding, nieuw spel
  - Uitkomst forceren in de test (bijv. winkans 1 via testinstelling) zodat de tests voorspelbaar zijn

- [x] **5. CI/CD met Vercel**
  - Repository koppelen aan Vercel
  - Preview-deploy per branch, productie-deploy vanaf `main`
  - Vitest (en Playwright) draaien vóór een deploy
  - Omgevingsvariabelen per omgeving in Vercel instellen

### Database

- [x] **6. Database met Neon en Prisma**
  - Neon-project met aparte branches voor ontwikkeling en productie
  - Prisma installeren en koppelen via `DATABASE_URL` in `.env`
  - Winkans aantal pogingen, aantal speelrondes per betaling uit in database tabel game-settings
  - Schema: `Game` (speelrondes: naam, uitkomst, aantal pogingen, datum) en `Payment`
  - Eerste migratie en seed-data voor ontwikkeling

- [x] **7. Spelletjes opslaan in de database**
  - Na elk spel de ronde opslaan (naam, gewonnen/verloren, pogingen, datum)
  - Opslaan via server action of API-route, niet vanuit de browser direct

### Game-manager

- [x] **8. Game-manager pagina met OAuth**
  - Pagina `/game-manager`, alleen toegankelijk na inloggen
  - OAuth via Auth.js (provider kiezen, bijv. Google of GitHub)
  - Alleen toegestane beheerders (lijst in `.env`)

- [x] **9. Moeilijkheidsgraad aanpassen in de game-manager**
  - Winkans instellen vanuit de game-manager
  - Waarde opslaan in de database; `.env` blijft de standaardwaarde
  - Spel gebruikt de ingestelde waarde

- [x] **9b. Gewonnen plaatje opslaan in de uitkomst**
  - In de tabel `games` in de kolom `outcome` opslaan wat er gewonnen is: `WON shot`, `WON kakkerlak` of `WON vraagteken`
  - `LOST` blijft `LOST`

### Betalingen

- [x] **10. Betalen met Mollie (testomgeving)**
  - Mollie test-API-key in `.env`, geen echte betalingen
  - 4 spelletjes voor € 1,00: na betalen krijgt de speler 4 credits
  - Klik op speel zonder credits → popup met QR-code van een unieke Mollie-betaallink per speler (vervangt het uploaden van een vaste QR-code)
  - Betaalflow: betalen → terug naar het spel → spel vrijgegeven
  - Webhook die de betaalstatus verwerkt
  - betaling registreren in de database. Naam rekeninghouder koppelen aan de uitkomst van de spelletjes van deze persoon

- [x] **10b. betaald pagina en score popup **
  - maak een pagina op /betaald zodat op de mobiel zichtbaar is dat het gelukt is
  - maak een popup met een overzicht van de scores als men minstens 1 maal gewonnen hebben. Wij kunnen dan de prijs(en) uitdelen: 1 of meer gratis shotjes,  1 of meer kakkelakken om te blingen of vrije keuze bij vraagteken.

- [x] **11. Betalingen versleuteld opslaan en koppelen aan spelletjes**
  - Naam, rekeningnummer en bedrag  opslaan (sleutel in `.env`)
  - rekeningnummer versleuteld
  - Spelletjes met naam koppelen aan de betaling waarmee ze gespeeld zijn
  - Tests voor versleutelen en ontsleutelen

- [ ] **12a. Mollie productieomgeving**
  - Live-API-key alleen in de productie-omgeving van Vercel
  - Controleren dat preview/ontwikkeling altijd de testmodus gebruikt

- [ ] **12b. PayPal productieomgeving** (na 13b)
  - Live-app aanmaken op developer.paypal.com (zakelijk PayPal-account nodig), client-ID en secret van de live-app
  - Live-client-ID/secret alleen in de productie-omgeving van Vercel; Preview en Development houden de sandbox-gegevens
  - Code: live-URL `https://api-m.paypal.com` alleen toestaan in productie (zoals 12a voor Mollie); controleren dat preview/ontwikkeling altijd de sandbox gebruiken
  - Webhook in de live-app aanmaken op `https://gokkast.vercel.app/api/paypal/webhook` met het event voor betaalde facturen (en annuleren); het webhook-ID als `PAYPAL_WEBHOOK_ID` in Production
  - Factuurgegevens van de verkoper (naam, e-mail, logo) in het live-account controleren: die ziet de speler bij het betalen
  - Eén echte betaling van € 1,00 doen in productie: QR scannen, betalen, credits ontvangen, naam in de game-manager; daarna terugbetalen via PayPal

### Game-manager uitbreiden

- [x] **13. Speelrondes en statistieken in de game-manager**
  - Overzicht van speelrondes
  - Aantal wins/loses per naam

- [x] **13b. Paypall**
  - richt een tweede betalingsmogelijkheid in met Paypall
  - ik wil een test, preview en productie omgeving
  - in de game mangers instellingen wil ik kunnen selecteren welke betaalmode gebruikt wordt.
  - gebruik hiervoor de Generate QR code van de paypall api, documentatie https://developer.paypal.com/api/invoicing/v2/invoices-generate-qr-code
  - pas alleen de code aan die noodszakelijk is voor het betaal gedeelte

- [x] **14. Betalingen in de game-manager**
  - Overzicht van betalingen: naam en bedrag (ontsleuteld weergegeven)
  - de moeilijkheidsgraad, speelronders/statistieken en betalingen panels wil ik in 3 tabs kunnen switchen zodat het niet zoveel hoogte in neemt
  - maximaal 15 rijen, rest met paginatie
  - ik wil kunnen sorteren op alle kolommen
  - ik wil kunnen filteren op kolom naam 

  - [x] **15. Instellingen**
    - Hernoem tablad Moeilijkheidsgraad naar Instellingen
    - zet instellingen als derde tablad

- [ ] ** Domein en naamspel **
  - het domein wordt jackpot.broadsight.nl
  - hernoem het spel naar Jackpot
  - in vercel, neon, paypall, molie, google auth houden wij de oude naam

## Versie 3 — Open
- [ ] **Redesign**

## Open vragen

- ~~Waarvoor wordt betaald: per spel van 3 pogingen, of een tegoed voor meerdere spellen? Wat kost het?~~ Besloten (taak 10): 4 spelletjes (credits) voor € 1,00.
- ~~Waar komt de naam van de speler vandaan?~~ Besloten (taak 7): uit de transactie als er betaald wordt via een QR-code; geen naam invullen in het spel. Highscores alleen in de game-manager, niet in het spel.
- ~~Welke OAuth-provider voor de game-manager?~~ Besloten (taak 8): Google; inloggen alleen lokaal en in productie.
- ~~Moet het rekeningnummer getoond worden in de game-manager, of alleen naam en bedrag?~~ Besloten (taak 14): rekeningnummer ontsleuteld tonen, alleen voor beheerders.

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
