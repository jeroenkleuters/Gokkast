# Doelen — Eenarmige Bandiet

## Hoofddoel

Een webbased eenarmige bandiet die direct in de browser speelt, zonder installatie of server.

## Werkwijze

- lees .claude/skills/feature/SKILL.mb en volg deze werkwijze

## Eisen versie 1

- Speelveld van 1024x768.
- Uiterlijk gebaseerd op het voorbeeld in `voorbeeld/fruitmachine.jpg`.
- Drie rollen met de plaatjes uit `images/` (beker, kakkerlak, vraagteken).
- De rollen draaien als je op de speelknop drukt.
- Je mag 3 keer proberen per spel.
- Elke rol kun je los vastzetten.
- Vastzetten kan de kans op winst verhogen.
- De winkans is standaard 1 op 30 en is instelbaar.

## Eisen versie 2
- zet het project om in react / nextjs / typescript
- automatische testen met Vitest, maak zelf tests aan  https://vitest.dev/guide/ 
- visueel testen met Playwright MCP, maak zelf tests aan  https://playwright.dev/docs/intro
- settings zetten wij in .env bestanden
- CI/CD met Vercel  https://vercel.com/
- een configuratie pagina met OAuth en moem het game-manager
    - op deze pagina is het mogelijk de moeilijkheidsgraad aan te passen

- payment met mollie, documentatie hier https://docs.mollie.com/docs/getting-started
    - ik wil een test opgeving zonder echte betalingen
    - ik wil een productie omgeving met echte betalingen
- database met Neon https://neon.com/docs/introduction 
    - gebruik prisma.io  https://www.prisma.io/docs  
    - in database worden de betalingen versleutelt opgeslagen. naam, rekeningnummer, bedrag
    - in de database worden de spelletjes opgeslagen en gekoppeld aan betalingen 
- werk de game-manager bij met de volgende data uit de database
    - speelrondes en statistieken aantal wins/loses per naam
    - betalingen naam, bedrag