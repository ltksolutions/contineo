---
name: osobne-udaje-d83
description: "Evidencia osoby po D83–D88 — meno/priezvisko, tituly, mobil, pracovisko, interný adresár; ako sa skladá fullName a kde sa to validuje"
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

# Osobné údaje osoby (D83–D88, 2026-09-14)

Plán a odôvodnenia: `docs/D83_plan_osobne_udaje.md`. Commit `8fac7ce`.

## Pravidlá, ktoré sa nesmú stratiť

- **`fullName` sa skladá, nezadáva** (D83). `composeFullName(givenName, surname)`
  v `lib/personFields.ts`. Potvrdenia a audit si `fullName` ďalej zamrazujú ako
  kópiu v čase — preto sa nesmie dať prepísať nezávisle od častí.
- **Tituly (`titleBefore`/`titleAfter`) do `fullName` nevstupujú** (D84). Skladá
  ich `displayName()` len na zobrazenie. Titul pribudne počas života a starý
  záznam o potvrdení by inak niesol iné meno než nový.
- **Pracovisko je kľúč z číselníka `workplace`** na tenanta (D85), nie voľný
  text. `CUSTOM_CODELISTS` je prvý číselník o ľuďoch, nie o obsahu — preto má
  `codelistsTenant.ts` mapu `CODELIST_COLLECTION` (documents vs persons).
- **Mobil sa ukladá v E.164** (D86), predvoľba je `Tenant.phonePrefix`
  (chýbajúca = `+421`). Číslo s `+` sa predvoľbou nedopĺňa; holé číslice bez
  nuly aj bez `+` sa **odmietnu** — krajina sa nehádže.
- **`directorySyncedAt` je známka doplnenia z adresára** (D88), nie `givenName`.
  Odkedy `givenName` vypĺňa aj personalista, stará otázka „má prázdny
  givenName?" znamenala, že ručne založená osoba by si z Graphu nikdy
  nevypýtala pozíciu, mobil ani pracovisko. Známka sa zapisuje **aj keď adresár
  nič nedal** — práve to je tá informácia.
- **Interný adresár `/adresar`** (D87) vidí každý prihlásený vo vlastnej
  organizácii. `lib/directory.ts` má `companyCode` v podmienke dotazu, nie
  v kontrole nad ňou (D32), vyradených vylučuje a roly/trasy/skupiny von
  nepúšťa — overené v `tests/directory.test.ts`.

## Pasca v CSV importe

O tom, či je stĺpec „Meno" krstné meno alebo celé meno, rozhoduje **prítomnosť
stĺpca „Priezvisko"** — a rozhodnúť sa to dá jedine v `rowToPerson()`, kde vidno
stĺpce. Bez toho by starý súbor s jediným stĺpcom „Meno" zapísal celé meno ako
krstné meno a celá organizácia by mala priezviská prázdne.

Nové polia sa v `upsertPersons()` zapisujú **len keď v riadku naozaj sú** —
rovnaká pasca ako pri jazyku: súbor spred zmeny tie stĺpce nemá a bezpodmienečný
zápis by ich ticho vymazal celej organizácii.

Neznáme pracovisko a nečitateľné číslo **pole nevyplnia a riadok nezahodia**;
vypíše ich `RowNotes` v náhľade importu. Číselník sa importom nezakladá.

## Stav (2026-09-14)

Hotové a commitnuté: knižnica, obrazovky HR, CSV import, Graph, migračný skript,
`/adresar`, GDPR kap. 2.1. `tsc` čisto, lint 0 chýb, **1253 testov** zelených,
`next build` prejde.

**Otvorené — čaká na Jánovo slovo:**

1. **Migrácia `npm run migrate:personname` bežala LEN NASUCHO.** Testovacia
   databáza: 3 osoby, 2 už rozdelené adresárom, 1 na rozdelenie (správca →
   krstné meno / priezvisko), 0 nerozdeliteľných. Zápis (`--zapis`) je zmena
   dát a bez výslovného súhlasu sa nespúšťa.
2. **Pracoviská v číselníku sú prázdne.** Kým ich SFZ nedoplní v Organizácia →
   Číselníky, pole pracoviska sa nedá vyplniť ani ručne, ani importom.
3. **`Tenant.phonePrefix` nemá obrazovku** — dá sa nastaviť len v databáze.
   Kým chýba, platí `+421`.
4. Adresár nebol vyskúšaný v prehliadači na telefóne (len `next build`).
