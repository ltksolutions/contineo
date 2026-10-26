<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-041 — Dokument pre bežného používateľa: jeden zoznam podľa druhu bez ohľadu na zdroj, čitateľský detail s údajmi a zneniami, Prehľad z úloh a dokumentov

> **Stav:** prijaté · **Dátum:** 2026-10-26
> **Rozhodol:** Ján Letko (2026-10-26) — „bežný používateľ nerozlišuje
> knižnicu a register zdrojov, on registruje len dokumenty a jediné
> zmysluplné delenie je podľa druhu dokumentu (Smernica, Zákon, Manuál
> a podobne)"; „bežný detail dokumentu (hocijakého, akéhokoľvek zdroja) by
> mal obsahovať prepínač verzií, aktuálna default, a hlavičku dokumentu so
> základnými údajmi o verzii a Zodpovedná osoba, Právny základ, Prijal
> (orgán), Autor, Potvrdenia"; „funkcionality content-admin, dpo a podobne
> nech sa bežným používateľom na detaile nezobrazujú, každá rola nech vidí
> iba svoje funkcionality"; k návrhu: „Áno, napíš návrh podľa odporúčania
> B → C → A; v hlavičke bežnému neukazuj Priečinok, Prístup, Značky ani
> počet potvrdení."
> **Čísla rozhodnutí:** D270–D274.
> **Nadväzuje na:** ADR-027 (druh je typ dokumentu, značky sú témy, D179),
> ADR-034 (úloha dokumentu, nadradené dokumenty), ADR-013 a ADR-017 (údaje
> o znení: autor, prijal, právny základ), ADR-023 (zodpovedná osoba,
> D91 kontakt), ADR-024 (znenia v indexe, štítok nad odpoveďou), ADR-039
> (katalóg legislatívy: predpis ako zdieľaný obsah, odber do knižnice),
> ADR-040 (register zdrojov — pohľad správcu), ADR-029 § 7 (D269: otázka
> nad jedným dokumentom, `?doc=`), návrh
> `docs/design/ZAKLAD-prehlad-a-detail-pre-pouzivatela.md`, `CLAUDE.md`
> (verejné cesty sa prekladajú, nepremenúvajú; jedno plné tlačidlo na
> obrazovke; R1 tiché tlačidlá v kartách).
> **Prekonáva:** v `docs/design/PREHLAD.md` riadky „KPI pás, 4 dlaždice"
> a „Dva panely: pozornosť + novinky" (hotové — nerob znova) — nahrádza ich
> D271; v `docs/design/DETAIL-starsie-znenia.md` vetu „Ľudia ich už
> nevidia" ako opis čitateľa — správcovská karta starších znení ostáva,
> čitateľ odteraz zverejnené znenia vidí (D272).
> **Implementácia:** B → C → A, tri PR (§ 3).

---

## 1. Kontext

Prehľad (`/`) má dnes štyri KPI dlaždice, panel „Čo máte k dispozícii"
(#447: Knižnica vľavo, Ďalšie zdroje — predpisy a pripojené systémy —
vpravo), dlaždice sekcií Organizácia a Správa a blok „Pre vás" (Čo vás čaká,
Novinky). Tie isté tri potvrdenia stoja v dlaždici hore aj v zozname dole;
„Novinky" sú knižnica z druhej strany. Delenie Knižnica / Ďalšie zdroje je
delenie podľa toho, **odkiaľ obsah prišiel** — to je pohľad správcu
(ADR-040), nie čitateľa.

Čitateľský detail dokumentu (`/documents/<id>`) ukazuje názov, označenie
znenia, dátum, PDF alebo text, kontakt na zodpovednú osobu a potvrdenie.
Kto dokument prijal, čo je mu nadradené, akého je druhu, to čitateľ nevidí;
staršie znenia nevidí vôbec. Správcovský detail (`/library/<id>`) má
všetko — aj akcie, ktoré čitateľovi nepatria.

Predpis zo Slov-Lexu (ADR-039) má detail so zneniami a celým textom
(#446), ale len pre **správcu osôb** pod Organizácia → Zdroje; bežný
človek ide z Prehľadu na portál Slov-Lex.

## 2. Rozhodnutia

### D270 — Bežný používateľ vidí dokumenty, nie zdroje; delia sa podľa druhu

Pre čitateľa existuje **jeden zoznam dokumentov organizácie**: platné
znenia dokumentov knižnice a predpisy, ktoré má organizácia odobrané
z katalógu legislatívy — bez ohľadu na to, odkiaľ prišli. Jediné členenie,
ktoré sa čitateľovi ponúka, je **druh** (číselník `category`, ADR-027);
predpis z katalógu má druh **Zákon** (`zakon`), aj keď nie je v knižnici.
Pripojené systémy (MCP konektory) v zozname nie sú — pre čitateľa to nie sú
dokumenty; ostávajú vo výbere zdrojov na Opýtať sa a v registri správcu.

Register zdrojov (ADR-040) sa tým nemení: je to pohľad správcu na to isté.

### D271 — Prehľad bežného používateľa: Moje úlohy, Dokumenty, Organizácia

Prehľad má tri bloky: **Moje úlohy** (čo odo mňa niekto čaká: potvrdenia
s termínom, kolá schválenia, kurzy a testy s termínom; počet v hlavičke),
**Dokumenty** (zoznam podľa D270, najnovšie znenia, chip `nové` a `končí`,
akcia Opýtať sa, päta do Knižnice na čítanie) a **Organizácia** (dlaždice
bez zmeny). **Správa** ostáva rolám bez zmeny.

KPI dlaždice a blok „Pre vás" zanikajú; ich čísla sa nestrácajú — sú
v hlavičkách a chipoch týchto dvoch panelov. Knižnica na čítanie (`/library`
bez roly) dostane prepínač pohľadu podľa druhu (`?kind=`), v ktorom sú aj
predpisy z katalógu.

### D272 — Čitateľský detail má hlavičku údajov a prepínač znení

`/documents/<id>` dostane nad text **riadok** druh · označenie znenia ·
platí od, **kartu údajov** s poľami Zodpovedná osoba, Právny základ,
Prijal (orgán), Autor, Nadradené, Jazyk, Pôvod a *moje* Potvrdenie
(dátum a znenie), a **kartu znení** (pri dvoch a viac zverejnených) s
prepínaním cez `?version=`; predvolené je platné znenie. Čitateľ vidí
**len zverejnené** znenia (staršie aj s účinnosťou v budúcnosti), nikdy
koncept; potvrdzuje sa stále len platné znenie.

**Nekreslí sa** Priečinok, Prístup, Značky ani počet potvrdení iných ľudí —
sú to pojmy správcu obsahu, prihlásenému človeku nič nepovedia a cudzie
potvrdenia nie sú jeho vec. Prázdne pole sa vynechá.

### D273 — Zákon má čitateľskú adresu `/documents/law/<actId>`

Predpis z katalógu má pre každého prihláseného človeka organizácie, ktorá
ho má odobraný, čitateľský detail `/documents/law/<actId>[?version=]`
v tvare D272 (druh Zákon, karta údajov len z toho, čo katalóg má, karta
znení, celý text). Správcovská adresa
`/organisation/sources/web/slov-lex/<actId>` ostáva pre správu zdroja
(posledná kontrola, chyba, odber, PDF) — verejné cesty sa neprejmenúvajú.
Z Prehľadu, Knižnice na čítanie a z citácií vedie čitateľská adresa; odkaz
na portál Slov-Lex je v karte údajov ako Pôvod.

### D274 — Každá rola vidí na detaile len svoje; správca jeden tichý odkaz

Čitateľský detail nemá žiadnu správcovskú akciu. Kto má rolu správcu
obsahu, vidí navyše **jediný tichý odkaz** „Upraviť v knižnici" →
`/library/<id>`; správca osôb na čitateľskom detaile zákona „Spravovať
zdroj" → správcovská adresa. DPO, HR, hodnotiteľ a ostatní na čitateľskom
detaile nič navyše nemajú — ich práca je na vlastných obrazovkách. Kto má
všetky role, má všetky tieto odkazy, nič viac.

## 3. Poradie

1. **B** — čitateľský detail (D272, D274 pre knižnicu).
2. **C** — čitateľská adresa zákona (D273, D274 pre zdroj).
3. **A** — Prehľad a Knižnica na čítanie podľa druhu (D270, D271).

Prehľad odkazuje na detaily, tak nech má kam. Každý krok vlastná vetva
a PR; ani jeden nemení schému.

## 4. Dôsledky

- `docs/design/PREHLAD.md` a `docs/design/DETAIL-starsie-znenia.md` sa
  v uvedených bodoch prekonávajú (hlavička).
- `overview.available.*` z #447 a `overview.tiles.*` v i18n zanikajú s A;
  do zlúčenia A platí dnešný Prehľad.
- `?version=` na `/documents/<id>` a `?kind=` na `/library` sú nové kľúče
  adresy (anglicky, `lib/urlParams.ts` nič neprekladá).
- Zodpovedná osoba pri zákone ostáva otvorená (Q3 návrhu): katalóg ju
  nemá, doplnenie k odberu je zmena schémy a vlastné rozhodnutie.
- Rozsah Opýtať sa na jeden predpis (`?doc=` pre zákon) ostáva otvorený
  v ADR-029 § 7; dovtedy vedie akcia pri zákone na `?src=slov-lex`.
