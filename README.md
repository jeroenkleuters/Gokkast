# Jackpot — Eenarmige Bandiet

Een webbased eenarmige bandiet (1024x768) gebouwd met Next.js, React en TypeScript.
Drie rollen, standaard drie pogingen per spel, rollen los vast te zetten en een instelbare winkans
(standaard 1 op 30). De instellingen staan in een `.env`-bestand.

Er zijn drie designs, te kiezen in de game-manager: het **jungle-design** (standaard, een
geschilderde houten kast "CASINO — Kakkelakken Kasino" in een jungle met insecten), het
**havendesign Harbor Jackpot** (een metalen kast met neontitel voor een foto van de ECT-terminal op
de Maasvlakte, met containers op de rollen) en het **originele design** (de neon-kast "JACKPOT").
Het speelveld is in alle drie 1024x768 en schaalt mee met het venster; de jungle-schildering en de
havenfoto zijn breder en vullen op een breder of hoger venster de rest.

Productie: **https://jackpot.broadsight.nl** (ook nog bereikbaar op `https://gokkast.vercel.app`).
Bij Vercel, Neon, PayPal, Mollie en Google heet het project nog **Gokkast** (de werktitel), net als
de map, de package en interne namen zoals de cookie `gokkast-betaling`.

## Vereisten

- [Node.js](https://nodejs.org/) 20.9 of nieuwer (ontwikkeld met Node 26)
- npm (wordt meegeleverd met Node.js)

## Lokale server starten

```bash
# 1. Afhankelijkheden installeren (eenmalig, of na wijzigingen in package.json)
npm install

# 2. (Optioneel) instellingen aanpassen, zie "Instellingen" hieronder
cp .env.example .env.local

# 3. Ontwikkelserver starten
npm run dev
```

Open daarna [http://localhost:3000](http://localhost:3000) in de browser.
Wijzigingen in de code worden direct zichtbaar (hot reload). Stoppen doe je met `Ctrl+C`.

Draait er al iets op poort 3000? Kies een andere poort:

```bash
npm run dev -- -p 3001
```

## Overige scripts

| Commando        | Wat het doet                                             |
| --------------- | -------------------------------------------------------- |
| `npm run dev`   | Ontwikkelserver met hot reload op poort 3000             |
| `npm run build` | Productiebuild maken in `.next/`                         |
| `npm run start` | De productiebuild serveren (eerst `npm run build` draaien) |
| `npm run lint`  | Code controleren met ESLint                              |
| `npm test`      | Automatische tests (Vitest) één keer draaien             |
| `npm run test:watch` | Tests opnieuw draaien bij elke wijziging            |
| `npm run test:e2e` | Visuele tests (Playwright) in de browser draaien      |
| `npm run test:e2e:ui` | Visuele tests in de Playwright-UI bekijken         |
| `npm run db:migrate` | Nieuwe migratie maken en toepassen na een wijziging in `prisma/schema.prisma` |
| `npm run db:deploy` | Bestaande migraties toepassen (zo doet de workflow het ook) |
| `npm run db:seed` | Seed-data voor ontwikkeling (instellingen en voorbeeldrondes) |
| `npm run db:studio` | De database bekijken en bewerken in Prisma Studio   |

Productieversie lokaal testen:

```bash
npm run build
npm run start
```

## Tests

De spellogica en de instellingen worden getest met [Vitest](https://vitest.dev/):

```bash
npm test
```

De tests staan naast de code in `src/lib/` (`game.test.ts`, `settings.test.ts`) en controleren onder
andere de winkans per aantal vastgezette rollen, dat een verlies nooit drie gelijke plaatjes geeft,
het aantal pogingen, maximaal 2 rollen vastzetten en het inlezen van de `.env`-instellingen.

### Visuele tests (Playwright)

Het spel zelf wordt in een echte browser (Chromium, 1024x768) getest met
[Playwright](https://playwright.dev/). Eenmalig de browser installeren:

```bash
npx playwright install chromium
```

Daarna:

```bash
npm run test:e2e
```

Playwright bouwt de app en start die zelf op poort 3100 (zie `playwright.config.ts`), met
testinstellingen die alleen voor die server gelden (`GAME_ALLOW_ODDS_URL=true`). De tests in `e2e/`
controleren het laden, draaien met de hendel, rollen vastzetten (maximaal 2), de winst- en
verliesmelding en NIEUW SPEL. De uitkomst is voorspelbaar: `?kans=1` geeft altijd winst, en voor
verlies gebruiken de tests `?kans=100000` met een `Math.random` die nooit onder 0,05 komt.
Draait er al iets op poort 3100, dan gebruikt Playwright die server (behalve op CI).

Voor betalen (`e2e/betalen.spec.ts`) start Playwright er nog twee servers bij: een nep-Mollie op
poort 3101 (`e2e/mollie-mock.ts`, met een betaalpagina waarop je de uitkomst kiest, net als de
testpagina van Mollie) en dezelfde build op poort 3102 met betalen aan, winkans 1 en de betalingen
in het geheugen (`PAYMENTS_TEST_STORE=true`, er is geen database). Er gaat niets naar Mollie.
Voor PayPal (`e2e/paypal.spec.ts`) komen er nog twee bij: een nep-PayPal op poort 3103
(`e2e/paypal-mock.ts`, facturen, QR-code en een betaalpagina) en dezelfde build op poort 3104 met
`GAME_PAYMENT_PROVIDER=paypal`. Er gaat niets naar PayPal.

## Spelen

- **Speelknop / hendel** of `Spatie` / `Enter`: rollen draaien.
- **VAST-knoppen** of toetsen `1`, `2`, `3`: een rol vastzetten (na de eerste draai).
- Je hebt standaard **3 pogingen** per spel (instelbaar); drie dezelfde plaatjes is winst.
- Vastzetten van rollen met hetzelfde plaatje vergroot de winkans. De winkans zelf zien spelers niet;
  die staat alleen in de [game-manager](#game-manager) (tab Instellingen, "Nu in het spel").
- Staat [betalen](#betalen) aan, dan kost elk spel één credit; zonder credits opent de speelknop de betaalpopup.
- De speelknop heet **DRAAI** in het jungle-design, **UITHALEN** in het havendesign en **SPEEL** in het
  originele; na een spel **NIEUW SPEL**. Het jungle-design heeft geen lampjes voor de pogingen: het
  berichtenbord meldt hoeveel er nog over zijn. Het havendesign heeft geen hendel; het POGING-bord met de
  lampjes staat links naast de VAST-knoppen.
- In het havendesign staan containers op de rollen. Achter de schermen zijn het dezelfde plaatjes:
  **MSC** = shot (gratis shotje), **MAERSK** = kakkerlak (kakkerlak om te blingen), **Loyd** = vraagteken
  (vrije keuze). Uitkomsten, prijzen en statistieken zijn dus in elk design gelijk.

## Instellingen

De spelinstellingen staan in de database (tabel `game_settings`, zie [Database](#database)) en
stel je in via de [game-manager](#game-manager). Zonder database, of als de tabel leeg of
onbereikbaar is, gelden de omgevingsvariabelen hieronder; ook een lege ("standaard") of ongeldige
waarde in de database valt per instelling terug op de variabele. "Nu in het spel" in de
game-manager toont welke bron gebruikt wordt. `GAME_ALLOW_ODDS_URL` staat alleen in de omgevingsvariabelen.

De omgevingsvariabelen: kopieer [`.env.example`](.env.example) naar
`.env.local` en pas de waarden aan. Echte `.env`-bestanden staan niet in git; op Vercel stel je
dezelfde variabelen in bij de projectinstellingen. Ontbreekt een variabele of is de waarde
ongeldig, dan geldt de standaardwaarde. Na een wijziging de server herstarten.

| Variabele                 | Betekenis                                                    | Toegestaan          | Standaard |
| ------------------------- | ------------------------------------------------------------ | ------------------- | --------- |
| `GAME_ODDS`               | Winkans per draai zonder vastgezette rollen: 1 op deze waarde | 1 t/m 100000        | `30`      |
| `GAME_MAX_TRIES`          | Aantal pogingen per spel                                     | 1 t/m 5             | `3`       |
| `GAME_ROUNDS_PER_PAYMENT` | Spelletjes (credits) per betaling, zie [Betalen](#betalen)  | 1 t/m 100           | `4`       |
| `GAME_PRICE_CENTS`        | Prijs van één betaling in centen (in de game-manager in euro's) | 1 t/m 10000      | `100`     |
| `GAME_DESIGN`             | Design als er in de game-manager niets gekozen is            | `jungle`/`haven`/`origineel` | `jungle` |
| `GAME_ALLOW_ODDS_URL`     | Winkans en design via de adresbalk overschrijven, bijv. `/?kans=1` | `true`/`1`/`ja`/`aan` | uit     |

Met `GAME_ALLOW_ODDS_URL=true` geeft
[http://localhost:3000/?kans=10](http://localhost:3000/?kans=10) een winkans van 1 op 10 en
[http://localhost:3000/?design=origineel](http://localhost:3000/?design=origineel) het originele
design (of `?design=haven` het havendesign). Handig bij ontwikkelen en testen; laat dit in productie uit.

**Jungle-design maken.** De plaatjes in `public/images/jungle/` (achtergrond en de hendel als losse
bal en stang) komen uit de schildering `voorbeeld/voorbeeld-nieuw-design.jpeg`. Het script
`node scripts/jungle-achtergrond.mjs` haalt de voorbeeldteksten en -knoppen weg, zet "GRAND JACKPOT"
in het midden, schuift het statistiekenbord binnen het speelveld en knipt de hendel uit. De posities
van rollen, knoppen en borden staan in `src/app/jungle.css` (speelveld-px = schildering-px − 64).

**Havendesign maken.** Het script `node scripts/haven-plaatjes.mjs` maakt de plaatjes in
`public/images/haven/`: de achtergrond uit de havenfoto
(`voorbeeld/de-ect-terminal-op-de-maasvlakte-in-de-haven-van-rotterdam.jpeg`, 1376x768), het
rollenhuis met gaas en de neontitel HARBOR JACKPOT uit het ontwerp `voorbeeld/HarborJackpot.png` (de
titel met transparantie, zodat de foto erachter doorloopt) en de drie containers (getekend als SVG).
Knoppendek, knoppen, borden en LED-bord zijn CSS in `src/app/haven.css`; het speelveld staat in het
midden van de foto (speelveld-px = foto-px − 176).

## Betalen

Betalen gaat via [Mollie](https://docs.mollie.com/docs/getting-started) of
[PayPal](https://developer.paypal.com/api/invoicing/v2/) (zie [Betalen met PayPal](#betalen-met-paypal)),
Beide zijn **live in productie** en draaien overal anders in de testmodus. Mollie: in productie alleen
een live-key `live_...` (een test-key zet Mollie daar uit), elders alleen een test-key `test_...` (een
live-key wordt geweigerd) (taak 12a). PayPal: live in productie met `PAYPAL_ENV=live` en overal anders
de sandbox (taak 12b). Zo wordt er buiten productie nooit echt geld geïnd, en in productie nooit
zonder.
De betaalpopup zegt "Testomgeving: er wordt geen echt geld afgeschreven" alleen bij een testbetaling.
Welke methode spelers gebruiken kies je in de game-manager (tab Instellingen); standaard is dat Mollie.
Bij Mollie staan de terugkeer- en webhook-URL niet in het dashboard: de app geeft ze per betaling mee,
op het adres waarop het spel geopend is (`/betaald` en `/api/mollie/webhook`). Het websiteprofiel in
het Mollie-dashboard (*Settings → Website profiles*) staat op `https://jackpot.broadsight.nl`.

- Een speler zonder credits klikt op **SPEEL** → een popup met een QR-code. Die hoort bij een eigen
  Mollie-betaling voor deze speler (per speler een unieke betaallink). Scannen met de telefoon, of
  "Of betaal op dit apparaat".
- Na betalen krijgt de speler **4 spelletjes voor € 1,00** (`GAME_ROUNDS_PER_PAYMENT` en
  `GAME_PRICE_CENTS`, allebei ook in te stellen in de game-manager). Elk nieuw spel kost één credit.
  Een nieuwe prijs geldt voor nieuwe betalingen; een betaling houdt haar eigen bedrag
  (`payments.amount_cents`). Een open betaling met een oude prijs wordt vervangen door een nieuwe.
- De credits staan op de server bij de betaling (tabel `payments`); de browser heeft alleen een
  willekeurige sleutel in een httpOnly-cookie. De naam van de rekeninghouder (van Mollie, o.a. bij
  iDEAL) komt bij de betaling en bij elke ronde die ermee gespeeld is (`games.name`, `games.payment_id`).
- Het rekeningnummer van de rekeninghouder staat alleen versleuteld in de database
  (`payments.account_encrypted`, AES-256-GCM met `PAYMENT_ENCRYPTION_KEY`, zie
  `src/lib/encryption.ts`). Het wordt nooit gelogd en nooit naar het spel gestuurd; alleen beheerders
  zien het ontsleuteld in de game-manager (tab Betalingen). Zonder
  (geldige) sleutel wordt het niet opgeslagen; de betaling gaat dan gewoon door, met een
  waarschuwing in de serverlog.
- De status komt altijd van Mollie zelf: de popup vraagt die elke 3 seconden op, de pagina `/betaald`
  (terugkeer na betalen) ook, en Mollie meldt elke wijziging via de webhook
  `POST /api/mollie/webhook`. Die krijgt alleen het ID en haalt de status zelf op bij Mollie.

| Variabele          | Betekenis                                                   | Standaard        |
| ------------------ | ----------------------------------------------------------- | ---------------- |
| `MOLLIE_API_KEY`   | Key uit het Mollie-dashboard (*Developers → API keys*): live-key in productie, test-key elders. Leeg = Mollie uit (zonder PayPal is het spel gratis) | leeg |
| `GAME_PRICE_CENTS` | Prijs van één betaling in centen (1 t/m 10000); de game-manager gaat voor | `100` (€ 1,00)   |
| `PAYMENT_ENCRYPTION_KEY` | Sleutel voor het rekeningnummer: 32 willekeurige bytes als base64. Leeg = rekeningnummer niet opslaan | leeg |

Sleutel maken: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
Bewaar de sleutel goed: zonder dezelfde sleutel zijn opgeslagen rekeningnummers niet meer te lezen.
Gebruik per database één sleutel (Production een eigen, Preview en Development samen, want die
delen Neon-branch `dev`).

Betalen werkt alleen met een database. Lokaal kan Mollie de webhook niet bereiken (localhost); de app
stuurt dan geen webhook mee en ziet de betaling via de popup of `/betaald`. In previews staat Vercel
Deployment Protection aan; de app zet daarom het bypass-geheim van Vercel (`VERCEL_AUTOMATION_BYPASS_SECRET`,
zie [Deployen](#deployen-vercel)) in de webhook-URL, zodat Mollie er wel door komt. Nooit in productie.

Zelf proberen: zet de test-key in `.env.local`, herstart `npm run dev`, klik op SPEEL en kies op de
testpagina van Mollie een betaalmethode en de status *Paid*.

### Betalen met PayPal

Met PayPal krijgt elke speler een eigen **factuur** (PayPal Invoicing v2, `src/lib/paypal.ts`): de
app maakt de factuur, verstuurt die zonder e-mail (alleen te betalen via de link) en toont in de
popup de QR-code die PayPal zelf maakt
([generate-qr-code](https://developer.paypal.com/api/invoicing/v2/invoices-generate-qr-code)). Lukt
die QR-code niet, dan maakt de app er zelf een van de betaallink.

- **Live alleen in productie** (taak 12b): met `PAYPAL_ENV=live` en `VERCEL_ENV=production` gebruikt
  de app `https://api-m.paypal.com` en wordt er echt betaald. Zonder die vlag staat PayPal in productie
  **uit** (nooit de sandbox in productie). Lokaal, in previews en in de tests altijd de sandbox
  (`https://api-m.sandbox.paypal.com`); `PAYPAL_ENV=live` of een live-URL wordt daar geweigerd.
- PayPal stuurt de betaler na betalen **niet terug** naar het spel. "Of betaal op dit apparaat" opent
  daarom een nieuw tabblad; de popup in het spel ziet de betaling zelf (elke 3 seconden).
- **Geen naam en geen rekeningnummer.** Een betaalde factuur bevat de naam van de betaler niet (getest in
  de sandbox); alleen de Transaction Search-API heeft die, met tot 3 uur vertraging. Besluit: PayPal-
  betalingen en hun rondes staan in de game-manager als "Zonder naam", en de score-popup toont geen
  naam. Geeft PayPal toch een naam mee (in de betaling op de factuur), dan wordt die opgeslagen.
- Elke betaling weet met welke methode hij gemaakt is (`payments.provider`, `mollie_id` of
  `paypal_id`); de game-manager toont dat in de kolom Methode.
- De webhook `POST /api/paypal/webhook` laat de handtekening eerst door PayPal controleren
  (`PAYPAL_WEBHOOK_ID`) en haalt daarna de status zelf op. Zonder webhook-ID worden webhooks geweigerd;
  de popup werkt dan nog steeds.
- Is PayPal gekozen maar niet ingesteld (geen sleutels), dan gebruikt het spel Mollie, met een
  waarschuwing in de serverlog en een melding in de game-manager (en andersom).

| Variabele               | Betekenis                                                           | Standaard |
| ----------------------- | ------------------------------------------------------------------- | --------- |
| `PAYPAL_ENV`            | `live` = echte betalingen, alleen in productie; anders de sandbox | leeg (sandbox) |
| `PAYPAL_CLIENT_ID`      | Client-ID van de app op developer.paypal.com (sandbox, of live in productie). Leeg = PayPal uit | leeg |
| `PAYPAL_CLIENT_SECRET`  | Secret van dezelfde app                                             | leeg      |
| `PAYPAL_WEBHOOK_ID`     | ID van de webhook in die app (events *Invoice paid* en *Invoice cancelled*) | leeg |
| `GAME_PAYMENT_PROVIDER` | Standaard betaalmethode als er in de game-manager niets gekozen is: `mollie` of `paypal` | `mollie` |

Sandbox-app maken (eenmalig): log in op [developer.paypal.com](https://developer.paypal.com/), kies
*Apps & Credentials → Sandbox → Create App* en kopieer de client-ID en het secret. Zet in de app
bij *Features* **Invoicing** aan en sla op: zonder dat recht geeft PayPal `403 Authorization failed
due to insufficient permissions` en toont de popup "Betalen lukt nu niet". Bij *Sandbox
accounts* staat een persoonlijk testaccount (e-mail en wachtwoord) waarmee je een factuur betaalt.
Webhook: in de sandbox-app staat één webhook (events *Invoice paid* en *Invoice cancelled*) op het vaste
preview-adres, met het bypass-geheim van Vercel erbij:
`https://gokkast-preview.vercel.app/api/paypal/webhook?x-vercel-protection-bypass=<geheim>`. Het ID
ervan staat als `PAYPAL_WEBHOOK_ID` in `.env.local` en in Vercel (Preview). Lokaal komt de webhook
dus niet aan; wil je dat wel, dan kan het met een tijdelijke tunnel (`cloudflared tunnel --url
http://localhost:3000`) en de webhook-URL tijdelijk op dat adres. Let op: client-ID, secret en
webhook-ID moeten van dezelfde **Sandbox**-app zijn (niet Live), anders weigert PayPal de handtekening.

**Live (productie, taak 12b).** In de *Live*-app op developer.paypal.com (zakelijk account, feature
**Invoicing** aan) staat een eigen webhook op `https://jackpot.broadsight.nl/api/paypal/webhook`
(events *Invoice paid* en *Invoice cancelled*). In Vercel staan alleen voor **Production** `PAYPAL_ENV=live`
en de client-ID, het secret en het webhook-ID van die live-app. Live-sleutels nooit in `.env.local`:
lokaal weigert de app ze toch (`PAYPAL_ENV=live` mag alleen in productie). Verandert het domein, pas
dan de URL van de bestaande webhook aan (*Edit*): het webhook-ID blijft dan hetzelfde.

## Database

[Neon](https://neon.com/docs/introduction) (serverless Postgres), via [Prisma](https://www.prisma.io/docs) 7.
Het schema staat in [`prisma/schema.prisma`](prisma/schema.prisma), de migraties in `prisma/migrations/`.

| Tabel           | Inhoud                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| `game_settings` | Eén rij (id 1): winkans, pogingen, speelrondes en prijs (`price_cents`) per betaling, betaalmethode, design; leeg = `.env`-waarde |
| `games`         | Gespeelde rondes: uitkomst (`WON shot`, `WON kakkerlak`, `WON vraagteken` of `LOST`), gebruikte pogingen, datum; naam leeg tot betalen (taak 10/11) |
| `payments`      | Betalingen: naam, bedrag in centen, datum (Mollie en versleuteling volgen in taak 10/11) |

Verbinding via omgevingsvariabelen (zie [`.env.example`](.env.example)):

- `DATABASE_URL`: via de Neon-pooler, gebruikt door de app ([`src/lib/db.ts`](src/lib/db.ts)).
- `DATABASE_URL_UNPOOLED`: directe verbinding, gebruikt door de Prisma CLI voor migraties en seed
  ([`prisma.config.ts`](prisma.config.ts)). Ontbreekt die, dan wordt `DATABASE_URL` gebruikt.

Neon heeft aparte branches: `main` voor productie, `dev` voor ontwikkeling en previews.
Lokaal beginnen:

```bash
npx vercel@60.1.3 env pull .env.local   # haalt de Development-variabelen (dev-branch) op
npm run db:deploy                       # migraties toepassen
npm run db:seed                         # instellingen en voorbeeldrondes
```

Aan het eind van elk spel stuurt de gokkast de ronde naar de server action `saveGame`
([`src/app/actions.ts`](src/app/actions.ts)). De server controleert de invoer
([`src/lib/gameStore.ts`](src/lib/gameStore.ts): uitkomst `WON <plaatje>` of `LOST`, pogingen 1 t/m het
maximum, verlies alleen na alle pogingen) en slaat de ronde op. Zonder database of bij een fout
wordt er niets opgeslagen (waarschuwing in de serverlog) en gaat het spel gewoon door.
Highscores staan niet in het spel, alleen in de [game-manager](#game-manager) (speelrondes en statistieken).

De Prisma Client wordt gegenereerd in `src/generated/prisma` (niet in git) bij elke `npm install`.
Het schema wijzigen: `prisma/schema.prisma` aanpassen en `npm run db:migrate -- --name <naam>`.
Herstart daarna de dev-server: een draaiende server houdt de oude Prisma Client vast.

## Game-manager

Beheerpagina op [`/game-manager`](http://localhost:3000/game-manager), alleen voor beheerders.
Inloggen gaat met Google via [Auth.js](https://authjs.dev/) ([`src/auth.ts`](src/auth.ts)); de
sessie is een versleutelde cookie (geen databasetabellen). Het spel zelf blijft zonder inloggen speelbaar.

- Alleen e-mailadressen uit `GAME_MANAGER_ADMINS` krijgen een sessie (en alleen als Google het adres
  heeft bevestigd). Een lege lijst betekent: niemand.
- De pagina controleert het zelf nog eens op de server ([`src/lib/dal.ts`](src/lib/dal.ts)). Haal je
  iemand uit de lijst, dan ziet die direct "geen toegang", ook met een oude sessie.
- Zonder sessie stuurt `/game-manager` door naar `/game-manager/inloggen`.

De pagina heeft drie tabs: **Speelrondes**, **Betalingen** en **Instellingen** (pijltjes,
Home en End wisselen ook). De gekozen tab blijft staan bij bladeren, sorteren en filteren, maar staat
niet in de URL: na herladen zie je weer de eerste tab.

Alle tabellen tonen 15 rijen per pagina. Klik op een kolomkop om daarop te sorteren (tekst eerst A-Z,
getallen en datums eerst het grootst of nieuwst; nog een keer klikken draait de volgorde om). Lege
waarden, zoals "Zonder naam", staan altijd onderaan. **Naam bevat** filtert op een deel van de naam,
zonder op hoofdletters te letten. Elke tabel heeft eigen parameters in de URL
([`src/lib/managerQuery.ts`](src/lib/managerQuery.ts)), bijvoorbeeld
`?periode=vandaag&naam=jan&rondes_sorteer=-pogingen&betalingen_pagina=2`.

**Speelrondes en statistieken.** Per naam (de rekeninghouder van de betaling, A-Z) staat hoe vaak
er gespeeld is, wat er gewonnen is per plaatje (shot, kakkerlak, vraagteken) en hoe vaak er verloren
is; rondes zonder betaling staan onderaan als "Zonder naam", met een regel Totaal. Daaronder de
speelrondes zelf (datum, naam, uitkomst, pogingen), standaard nieuwste eerst. **Vandaag** toont
alleen de rondes vanaf 00:00 Nederlandse tijd, **Alles** alle rondes. Het filter op naam geldt voor
beide tabellen; Totaal telt alle namen die bij het filter passen, niet alleen die op de pagina.
Dezelfde persoon kan onder verschillende schrijfwijzen staan (zoals Mollie de naam doorgeeft).
Rekeningnummers staan hier niet. Zonder database of als die onbereikbaar is, toont de tab een melding
([`src/lib/gameStats.ts`](src/lib/gameStats.ts)).

**Betalingen.** Per betaling de datum, de naam van de rekeninghouder (of PayPal-betaler), de
betaalmethode (Mollie of PayPal), het rekeningnummer (alleen Mollie), het bedrag,
de status (open, betaald, verlopen, ...) en hoeveel van de spelletjes er gespeeld zijn, standaard
nieuwste eerst ([`src/lib/paymentOverview.ts`](src/lib/paymentOverview.ts)). Het rekeningnummer
wordt alleen op de server en alleen voor beheerders ontsleuteld met `PAYMENT_ENCRYPTION_KEY`. Zonder
geldige sleutel staat er "Geen sleutel" met een melding erboven; met een andere sleutel "Niet te
ontsleutelen" (een waarschuwing in de serverlog, zonder nummers). Om op het rekeningnummer te kunnen
sorteren, worden de betalingen in het geheugen gesorteerd en verdeeld over pagina's.

**Instellingen.** Hier stel je de winkans (snelkeuze makkelijk 1 op 10, normaal 1 op 30,
moeilijk 1 op 100, of een eigen getal), de pogingen per spel, de speelrondes per betaling, de prijs
per betaling (in euro's, bijv. `1,50`; opgeslagen in centen, € 0,01 t/m € 100,00), de
betaalmethode (Mollie, PayPal of de standaard uit `GAME_PAYMENT_PROVIDER`) en het design (Jungle,
Harbor Jackpot, Origineel of de standaard uit `GAME_DESIGN`) in. Een methode zonder
sleutels op deze server staat erbij als "niet ingesteld"; wordt die toch gekozen, dan meldt de
pagina welke methode het spel echt gebruikt.
Opslaan gaat via een server action die opnieuw controleert of je beheerder bent en de invoer op de
server controleert (zelfde grenzen als `.env`). **Terug naar standaard** maakt een veld leeg: dan
geldt weer de `.env`-waarde. Het spel gebruikt de nieuwe waarden bij het volgende laden. Let op: in
productie geldt een wijziging direct voor het echte spel. Zonder database toont de pagina een melding
(opslaan lukt dan niet); is de database even onbereikbaar, dan is het formulier verborgen.

| Variabele             | Betekenis                                                         |
| --------------------- | ----------------------------------------------------------------- |
| `AUTH_SECRET`         | Sleutel voor de sessiecookie; per omgeving een andere (`npx auth secret` of `openssl rand -base64 33`) |
| `AUTH_GOOGLE_ID`      | Client-ID van de Google OAuth-client                              |
| `AUTH_GOOGLE_SECRET`  | Client-secret van de Google OAuth-client                          |
| `GAME_MANAGER_ADMINS` | E-mailadressen van beheerders, gescheiden door komma's            |

Google OAuth-client aanmaken (eenmalig): in de [Google Cloud Console](https://console.cloud.google.com/)
een project kiezen, *APIs & Services → OAuth consent screen* invullen (type *External*, scopes
`openid`, `email`, `profile`) en bij *Credentials → Create credentials → OAuth client ID* een
*Web application* maken met deze *Authorized redirect URIs*:

- `http://localhost:3000/api/auth/callback/google` (lokaal)
- `https://jackpot.broadsight.nl/api/auth/callback/google` (productie)
- `https://gokkast.vercel.app/api/auth/callback/google` (productie, oud adres)

Bij *Branding → Authorized domains* staat `broadsight.nl`. `AUTH_URL` is niet nodig: Auth.js neemt op
Vercel het adres van het verzoek, dus inloggen werkt op elk domein dat hierboven staat.

Inloggen werkt alleen lokaal en in productie. Preview-URL's wisselen per deploy en staan niet bij
Google; daar stuurt `/game-manager` wel door naar de inlogpagina, maar Google weigert de terugkeer-URL.

## Deployen (Vercel)

Het spel draait op [Vercel](https://vercel.com/). Deployen gaat automatisch via GitHub Actions
([`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml)), bij elke push:

1. **Controles**: lint, typecheck, Vitest en Playwright. Faalt er één, dan wordt er niet gedeployd
   (bij falende Playwright-tests staat het rapport als artifact bij de workflow-run).
   De controles draaien zonder database; het spel gebruikt dan de `.env`-waarden.
2. **Migraties**: `prisma migrate deploy` op de database van de omgeving (GitHub-secret
   `DATABASE_URL_UNPOOLED` van de environment). Zonder secret wordt deze stap overgeslagen.
3. **Deploy** met de Vercel CLI:
   - push op `main` → **productie**;
   - push op een andere branch → **preview** met een eigen URL. Die staat bij de commit en in de
     pull request (onder *Deployments*), en in de samenvatting van de workflow-run.
     Previews zijn beschermd met Vercel Deployment Protection: alleen te openen als je bij Vercel
     bent ingelogd (of met `npx vercel@60.1.3 curl / --deployment <url>`).
     De laatste preview krijgt ook het vaste adres **https://gokkast-preview.vercel.app** (stap
     "Vast preview-adres"), voor de webhook van de PayPal-sandbox. Webhooks komen door
     Deployment Protection met het geheim van *Settings → Deployment Protection → Protection Bypass
     for Automation*; Vercel geeft dat aan de app als `VERCEL_AUTOMATION_BYPASS_SECRET`.

Een mislukte deploy onderzoeken: in GitHub *Re-run jobs → Enable debug logging*; de Vercel CLI
logt dan uitgebreid (`--debug`).

Vercels eigen Git-deploys staan uit (`git.deploymentEnabled: false` in [`vercel.json`](vercel.json)),
zodat er nooit iets live gaat zonder geslaagde tests.

### Domein

Productie draait op **jackpot.broadsight.nl**, als domein van het Vercel-project `gokkast`
(*Settings → Domains*; toegevoegd met `npx vercel@60.1.3 domains add jackpot.broadsight.nl gokkast`).
`gokkast.vercel.app` blijft daarnaast werken, zonder doorverwijzing. De DNS van broadsight.nl staat
niet bij Vercel maar bij de eigen hoster (nameservers `webhostingserver.g1-dns.one` en `.com`). Daar
staat één record:

| Type  | Naam      | Waarde                                 |
| ----- | --------- | -------------------------------------- |
| CNAME | `jackpot` | `bbc7e97c480826fb.vercel-dns-017.com.` |

Het CNAME-record gaat voor het wildcard-record (`*`) van de hoster. Een TXT-record is niet nodig:
broadsight.nl is al van dit Vercel-account. Controleren: `npx vercel@60.1.3 domains verify
jackpot.broadsight.nl`; zodra de DNS klopt, maakt Vercel zelf het HTTPS-certificaat.

Na een domeinwissel ook aanpassen: de webhook van de PayPal-live-app (zie
[Betalen met PayPal](#betalen-met-paypal)), de redirect-URI bij Google (zie
[Game-manager](#game-manager)) en het websiteprofiel bij Mollie (zie [Betalen](#betalen)).

### Instellingen per omgeving

De spelinstellingen (zie [Instellingen](#instellingen)) staan in Vercel onder
*Project → Settings → Environment Variables*:

| Variabele                 | Production | Preview | Development |
| ------------------------- | ---------- | ------- | ----------- |
| `GAME_ODDS`               | `30`       | `30`    | `30`        |
| `GAME_MAX_TRIES`          | `3`        | `3`     | `3`         |
| `GAME_ROUNDS_PER_PAYMENT` | `4`        | `4`     | `4`         |
| `GAME_ALLOW_ODDS_URL`     | `false`    | `true`  | `true`      |
| `DATABASE_URL` (+ `_UNPOOLED`) | Neon `main` | Neon `dev` | Neon `dev` |
| `AUTH_SECRET`             | eigen sleutel | eigen sleutel | eigen sleutel |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth-client | idem | idem |
| `GAME_MANAGER_ADMINS`     | beheerders | beheerders | beheerders |
| `MOLLIE_API_KEY`          | Mollie live-key (`live_...`) | Mollie test-key | Mollie test-key |
| `PAYPAL_ENV`              | `live`     | leeg (sandbox) | leeg (sandbox) |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal-live-app | PayPal-sandbox-app | PayPal-sandbox-app |
| `PAYPAL_WEBHOOK_ID`       | webhook-ID live-app | webhook-ID sandbox-app | leeg |
| `GAME_PAYMENT_PROVIDER`   | leeg (Mollie) | leeg (Mollie) | leeg (Mollie) |
| `GAME_DESIGN`             | leeg (jungle) | leeg (jungle) | leeg (jungle) |
| `GAME_PRICE_CENTS`        | `150` (€ 1,50) | leeg (€ 1,00) | leeg (€ 1,00) |
| `PAYMENT_ENCRYPTION_KEY`  | eigen sleutel | sleutel `dev` | sleutel `dev` (zelfde als Preview) |

In previews werkt `?kans=` dus wel, in productie niet. Een wijziging geldt vanaf de volgende deploy
(workflow opnieuw draaien via *Actions → CI/CD → Run workflow*). Development-waarden lokaal ophalen:
`npx vercel@60.1.3 env pull .env.local`.

### Eenmalig instellen

1. Project koppelen: `npx vercel@60.1.3 login` en `npx vercel@60.1.3 link`. Dit maakt
   `.vercel/project.json` (niet in git) met `orgId` en `projectId`.
2. Een token maken op [vercel.com/account/tokens](https://vercel.com/account/tokens).
3. GitHub-secrets instellen (*Settings → Secrets and variables → Actions*, of met `gh secret set`):
   `VERCEL_TOKEN`, `VERCEL_ORG_ID` (= `orgId`) en `VERCEL_PROJECT_ID` (= `projectId`).
4. De omgevingsvariabelen uit de tabel hierboven instellen.
5. Neon koppelen via Vercel (*Storage → Neon*), alleen voor **Production** (Neon-branch `main`).
   Vercel zet dan o.a. `DATABASE_URL` en `DATABASE_URL_UNPOOLED` als *sensitive* variabelen.
6. Een Neon-branch `dev` maken en die voor Preview en Development instellen, bijv. met de
   [Neon CLI](https://neon.com/docs/cli/install.md) (project `neon-gokkast`):
   ```bash
   neon branches create --project-id <project-id> --name dev
   neon cs dev --project-id <project-id> --pooled | npx vercel@60.1.3 env add DATABASE_URL preview
   neon cs dev --project-id <project-id> | npx vercel@60.1.3 env add DATABASE_URL_UNPOOLED preview
   # en hetzelfde voor development
   ```
7. GitHub-environment-secret `DATABASE_URL_UNPOOLED` (directe verbinding) voor de migraties:
   environment **Production** = Neon `main`, **Preview** = Neon `dev`
   (`gh secret set DATABASE_URL_UNPOOLED --env Production`). Sensitive Vercel-variabelen komen
   niet mee met `vercel pull`, daarom staat dit secret apart in GitHub.

## Projectstructuur

```
Gokkast/
├── public/images/      plaatjes voor de rollen (shot, kakkerlak, vraagteken); jungle/: achtergrond en hendel van het jungle-design; haven/: achtergrond, rollenhuis, titel en containers van het havendesign
├── src/
│   ├── app/            layout, pagina, server actions (actions.ts) en CSS: globals.css (origineel design), jungle.css en haven.css (Next.js App Router)
│   │   ├── game-manager/  beheerpagina met tabs (ManagerTabs): speelrondes en statistieken (StatsSection), betalingen (PaymentsSection), instellingen (SettingsForm), sorteren/bladeren/filteren (TableParts), server actions en inlogpagina (inloggen/)
│   │   ├── betaald/       terugkeer na betalen bij Mollie
│   │   ├── api/auth/      Auth.js-routes (inloggen, terugkeer van Google, uitloggen)
│   │   ├── api/mollie/webhook/  webhook van Mollie (betaalstatus)
│   │   └── api/paypal/webhook/  webhook van PayPal (betaalde of geannuleerde factuur)
│   ├── auth.ts         Auth.js-instellingen (Google, alleen beheerders)
│   ├── components/     SlotMachine, Reel, Lever, InfoPanel, Stats, PaymentDialog, PrizeDialog, GameClient
│   ├── lib/            spellogica (game.ts), maten per design en schalen (designs.ts), instellingen (settings.ts, settingsStore.ts), database (db.ts), rondes opslaan en lezen (gameStore.ts, gameStats.ts), tabellen en URL van de game-manager (tables.ts, managerQuery.ts), betalen (payments.ts, mollie.ts, paypal.ts, paymentStore.ts, paymentService.ts, paymentOverview.ts, qr.ts), beheerders (admins.ts, dal.ts), geluid, opslag, muntenregen, tests (*.test.ts)
│   └── generated/      Prisma Client (gegenereerd, niet in git)
├── prisma/             schema.prisma, migrations/, seed.ts
├── prisma.config.ts    instellingen voor de Prisma CLI
├── .mcp.json           Neon MCP-server voor coding agents (aanmelden met OAuth, geen sleutel)
├── .env.example        alle instellingen met uitleg (kopiëren naar .env.local)
├── .github/workflows/  CI/CD: controles en deploy naar Vercel (ci-cd.yml)
├── vercel.json         Vercel-instellingen (eigen Git-deploys uit)
├── e2e/                visuele tests met Playwright (*.spec.ts), de nep-Mollie (mollie-mock.ts) en de nep-PayPal (paypal-mock.ts)
├── playwright.config.ts instellingen voor de visuele tests
├── vitest.config.mts   instellingen voor de unit-tests
├── scripts/            jungle-achtergrond.mjs en haven-plaatjes.mjs: plaatjes van het jungle- en havendesign maken
├── voorbeeld/          ontwerpvoorbeelden (fruitmachine.jpg, design1.png, design2.png, voorbeeld-nieuw-design.jpeg, redesign-voorbeeld-*.png, HarborJackpot.png, RandomRunner.png, de havenfoto, haven-voorbeeld-*.png)
└── project-details/    doelen, to-do, huidige feature en build-log
```

## Meer informatie

- Doelen en eisen: [`project-details/goals.md`](project-details/goals.md)
- Takenlijst: [`project-details/to-do.md`](project-details/to-do.md)
- Logboek van alle wijzigingen: [`project-details/build-log.md`](project-details/build-log.md)
