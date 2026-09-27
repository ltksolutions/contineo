# ADR-019 — Import osôb existujúcim dopĺňa len prázdne polia; prepis je výslovná voľba

> **Stav:** prijaté · **Dátum:** 2026-09-27
> **Zadal a odsúhlasil:** Ján Letko (import 155 osôb SFZ z licenčného
> zoznamu M365; pravidlo aj prepínač odsúhlasené 27. 9. 2026).
> **Nadväzuje na:** D26 (import osôb), D32 (`companyCode` + e-mail ako kľúč),
> D50 (história členstva v skupinách), D83–D86 (osobné údaje), D88
> (doplnenie z adresára M365 — `fillMissing`).
> **Mení:** správanie `upsertPersons()` pri osobe, ktorá už v organizácii je.

---

## 1. Kontext

Import z CSV bol doteraz zároveň **zakladaním** nových ľudí aj **hromadnou
aktualizáciou** existujúcich: stĺpec prítomný v súbore prepísal hodnotu, prázdna
bunka ju vymazala (D50 s tým pri skupinách výslovne počítal). Na obrazovke to
oznamovala veta „Prázdna bunka v stĺpci, ktorý súbor má, hodnotu vymaže".

Pri príprave importu zamestnancov SFZ sa ukázalo, že je to nebezpečné pravidlo
pre bežný prípad: zdrojom je export z M365, ktorý o ľuďoch vie **menej** než
Contineo (nemá pracovisko, mobil ani tituly, pozíciu má u polovice) a obsahuje
zápisy, ktoré si ľudia v Contineu medzitým opravili sami alebo cez Entra.
Personalista, ktorý súbor nahráva, nemá ako vidieť, komu čo prepíše.

Navyše sa v `upsertPersons()` dávali do `$set` polia `department` a `startDate`
aj keď v riadku neboli — ako `undefined`, ktoré driver s predvoleným
`ignoreUndefined: false` uloží ako `null`. Teda aj súbor bez stĺpca oddelenia
existujúcim ľuďom oddelenie (textové) vynuloval, hoci dokumentácia sľubovala
opak.

Jediný spoľahlivý identifikátor osoby je e-mail v rámci `companyCode` (D32);
iný 100 % jedinečný kľúč organizácia nemá.

## 2. Rozhodnutie

### D124 — Existujúcej osobe import dopĺňa len prázdne polia

Kto už v organizácii je (`companyCode` + e-mail), **nezaloží sa znova a nič,
čo už má, sa mu nezmení**. Z riadku sa použijú len hodnoty pre polia, ktoré
sú u osoby prázdne (`undefined`, `null`, prázdny reťazec, prázdny zoznam).
Je to to isté pravidlo, ktoré platí pri doplnení z adresára M365
(`fillMissing`, D88): súbor je zdroj pre ľudí, ktorých systém nepozná, nie
autorita nad tými, ktorých už pozná.

Dôsledky:

- **Skupiny a trasy** sa existujúcemu doplnia len keď nemá žiadne. História
  členstva (D50) sa zapíše práve vtedy — a nikdy inak, inak by vznikol záznam
  o zmene, ktorá sa nestala.
- `fullName`, `personType`, `language`, `status`, `roles` má existujúca osoba
  vždy vyplnené, takže ich import v tomto režime **nikdy** nemení.
- Keď riadok nemá čo doplniť, započíta sa ako „bez zmeny" a do databázy sa
  nezapíše nič.
- Nové osoby sa zakladajú rovnako ako doteraz.

### D125 — Prepis je výslovná voľba, nie vlastnosť súboru

Pôvodné správanie (prítomný stĺpec prepíše, prázdna bunka vymaže) zostáva
dostupné ako režim `overwrite`: na obrazovke prepínač **„Aktualizovať
existujúcich hodnotami zo súboru"** (predvolene vypnutý), v skripte parameter
`--prepisat`. Text nad importom hovorí to, čo práve platí — s prepínačom sa
zmení aj on. Prepis je vedomé rozhodnutie toho, kto súbor nahráva, nie niečo,
čo sa stane, lebo súbor mal o stĺpec viac.

### D126 — `undefined` sa do `$set` nedostane

Oddelenie a dátum nástupu sa do zápisu pridávajú len keď v riadku sú, ako
všetky ostatné polia od D83. Pravidlo „chýbajúce pole = mlčanie" tak platí
v oboch režimoch a bez výnimky.

## 3. Zamietnuté

- **Tvrdé preskočenie existujúcich** (prvý návrh): jednoduchšie, ale súbor by
  nemohol doplniť ani to, čo u osoby chýba — a práve doplnenie prázdnych je
  častý a bezpečný prípad.
- **Ponechať prepis ako predvolený a len lepšie varovať**: personalista aj tak
  nevidí, komu čo prepíše; varovanie nenahradí bezpečné predvolené správanie.

## 4. Dôsledky

- `upsertPersons(rows, actor, mode: "fill" | "overwrite" = "fill")` v
  `lib/persons.ts`; `runImportAction(text, overwrite)`; skript
  `import_persons.mjs` s `--prepisat` (a `--org=KOD`, doplneným v ten deň).
- Hromadná zmena skupín existujúcich ľudí cez CSV vyžaduje zapnutý prepis —
  to je zámerné; D50 zostáva v platnosti pre režim `overwrite`.
- Testy: `tests/personsUpsert.test.ts` (režim dopĺňania aj prepisu, `undefined`
  mimo `$set`).
