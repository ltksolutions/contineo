# ADR-024 — Asistent odpovedá podľa znenia platného k dňu otázky

> **Stav:** prijaté · **Dátum:** 2026-09-29
> **Rozhodol:** Ján Letko — plán „Asistent: znenia v indexe" (`docs/TODO.md`)
> schválený 2026-09-28; po krokoch: index upraviť na mieste (krok 0),
> osirelé úseky zmazať, `sourceType` do indexu (krok 4, „zdrojov bude
> viac"), rok bez dňa = 31. 12. a dnešný názov pri starom znení zatiaľ
> ponechať (krok 6), výber dvojice znení a limit 8 článkov (krok 7),
> testovací dokument cez kartu so schválením kolegom (krok 8).
> **Nadväzuje na:** D6 (platnosť znenia), D11 (overené odpovede), D24, D27,
> D28, D57, ADR-013, ADR-015, ADR-016, ADR-023 (D143 — nahradené znenie
> platí do účinnosti nového)
> **Implementácia:** hotová — PR #170 (kroky 0–3), #171 (4), #172 (5),
> #173 (6), #174 a #175 (7), krok 8 (testovací dokument, skúšobné otázky,
> tento záznam).

---

## 1. Kontext

Asistent hľadal len v **aktívnych úsekoch** (`isActive`) a model pri úseku
nevidel, z ktorého znenia je ani odkedy platí. Tri dôsledky:

- **Novela zverejnená vopred** mala aktívne úseky hneď po zverejnení, hoci
  ešte neplatila — asistent citoval text, ktorý platí až o mesiace.
- **Nahradené znenie** platí do účinnosti nového (D143), ale jeho úseky
  aktívne neboli — otázka „čo platilo vlani" nemala odpoveď.
- Otázka „čo sa zmenilo" sa riešila ako bežná otázka nad dnešným textom.

`isActive` je stav **úseku** (patrí k práve zverejnenému členeniu), nie
platnosť **znenia**. Tieto dve veci sa rozišli v okamihu, keď D143
dovolilo nahradenému zneniu platiť ďalej.

## 2. Rozhodnutie

### D144 — Hľadá sa v zneniach platných k dňu otázky, spočítaných z `documents`

- Úsek nesie `versionId`; hľadanie filtruje `versionId ∈ znenia platné
  k dňu` a `superseded: false` (`vectorFilter()`, `searchFilterClauses()`).
- Platné znenia sa počítajú **z `documents` cez `effectiveVersion()`** —
  tým istým pravidlom, podľa ktorého sa potvrdzuje a prideľuje
  (`searchVersions.ts`). **Dátumy na úsekoch sa nepoužívajú**: boli
  nekonzistentné (krok 0) a boli by druhým zdrojom pravdy (D27).
- `isActive` na úsekoch sa nemení — čítajú ho kontrola, kurácia
  a preindexovanie.
- **Overené odpovede** (`sourceType: "qa"`) nemajú znenie; berú sa cez
  `isActive` a **len pri otázke na dnešok** — vznikli nad dnešným textom.
- Bez platného znenia a bez overených odpovedí sa nehľadá vôbec
  (`hasSearchScope()`); prázdne `$in` nie je „bez obmedzenia".

### D145 — Príznak nahradeného členenia `superseded` na úseku

Preindexovanie toho istého znenia vyrobí nové členenie s tým istým textom.
Bez rozlíšenia by sa v hľadaní k dátumu objavil text dvakrát. `superseded:
true` = členenie nahradené preindexovaním, `false` = platné členenie svojho
znenia (aj keď znenie samo už neplatí). **Uložený stav, nie odvodený** —
výnimka z D27 z toho istého dôvodu ako `isActive`: filter `$vectorSearch`
vie filtrovať len podľa polí úseku uvedených v indexe (`chunkSuperseded.ts`).

### D146 — Search indexy sa menia na mieste

`updateSearchIndex` (`atlas_init.mjs --upravit`), nie nový index vedľa
starého: Atlas stavia novú definíciu na pozadí a dovtedy odpovedá stará
(overené trikrát naostro — bez výpadku); názvy indexov v `mongoSearch.ts`
zostávajú; návrat = ďalšia úprava so starou definíciou. Definície sú na
jednom mieste (`scripts/lib/searchIndexes.mjs`) a test stráži, že každé
pole z filtrov hľadania v oboch indexoch je. Do indexov pribudli
`versionId`, `superseded`, `sourceType`; `sectionKey` odišiel (nemal ho
žiadny úsek).

### D147 — Model aj čitateľ vidia znenie a deň odpovede

- Pri úseku „znenie X · účinné od … [do …]" — v Anthropicu v `context`
  dokumentového bloku, aby text úseku a citácie zostali doslovné.
- V pokyne deň, ku ktorému sa odpovedá (Europe/Bratislava), a čo robiť so
  známym koncom účinnosti; **kedy účinnosť nekomentovať** — prvý pokus
  bez toho pridával nevyžiadané „overte si novšie znenie".
- Zdroj pod odpoveďou nesie znenie ako **kópiu** do hodnotení — o rok musí
  byť čitateľné, z ktorého znenia odpoveď bola (D28).

### D148 — Deň otázky rozpoznávajú pravidlá, model je záloha

- Pravidlá (`queryTime.ts`) bežia **pri každej otázke** — prepis modelom sa
  pri krátkych a fulltextových otázkach nespúšťa. Presný dátum sk/cs/en,
  rok s predložkou (**31. 12.** daného roka), „vlani", „pred rokom",
  porovnávacie výrazy. Holý letopočet („Smernica 2026") dátumom nie je.
- Model vracia `time` v prepise; pravidlá majú prednosť, nezmysel sa zahodí.
- **Dátum sa pred klasifikáciou a hľadaním z otázky vyberá**
  (`withoutTimePhrase()`) — heuristika berie rok za kód normy a posielala
  otázku do fulltextu.
- Štítok nad odpoveďou: dnešok tlmene, iný deň a porovnanie výrazne;
  prichádza v `meta` pred prvým slovom.

### D149 — Porovnanie dvoch znení po článkoch

- Porovnáva sa **jeden** dokument — ten s najlepším výsledkom hľadania.
- Dvojica znení: dátum v otázke → vtedajšie ↔ dnešné; inak novela vopred →
  dnešné ↔ budúce; inak predchádzajúce ↔ dnešné (`comparePair()`).
- Obe znenia sa **narežú nanovo** tým istým chunkerom a profilom, spárujú
  podľa `articleRef` a porovnajú zvlášť. Celé texty naraz nie: `textDiff`
  pri väčšej novele prepadne do hrubého režimu.
- Model dostane podrobne najviac **8 článkov** (najprv tie z hľadania) ako
  staré a nové znenie; prehľad všetkých zmien je v pokyne, nie medzi zdrojmi.
- Staršiemu zneniu sa nepodstrčí text najnovšieho (`versionText()`); texty
  sa načítajú až vtedy, keď je čo porovnať.

## 3. Zvažované a zamietnuté

- **Nový index vedľa starého a prepnutie** — dvojité vektory na M10,
  prepojenie názvu indexu z profilu tenanta; úprava na mieste to nepotrebuje.
- **Dátumy účinnosti na úsekoch a filter podľa nich** — druhý zdroj pravdy,
  ktorý sa pri oprave dátumu znenia rozíde s `documents`.
- **Porovnanie celých textov jedným `textDiff`** — pri novele s desiatkami
  zmien hrubý režim bez väzby na články.
- **Testovací dokument zapísaný priamo skriptom** alebo schválený skriptom
  v mene Jána — prvé obchádza `publish()` a audit, druhé by bol falošný
  dôkazný záznam. Testovací dokument ide kartou so schválením kolegom.

## 4. Čo sa tým vedome kazí (známe obmedzenia)

- **Názov dokumentu pri minulom znení je dnešný.** Názov sa pri znení
  neukladá (ADR-015); model aj zdroje ho ukazujú v dnešnom tvare. Riešenie
  je zmena dát (názov pri znení), samostatne.
- **Prečíslovaný článok** vyjde pri porovnaní ako zrušený a pridaný.
- **Porovnáva sa jeden dokument** a podrobne najviac 8 článkov; ostatné
  zmeny model pozná len menovite.
- **Dokument bez členenia na články** (celý text v jednom riadku) chunker
  uloží ako preambulu a hľadanie preambuly vynecháva — k asistentovi sa
  nedostane (`sfz:test_onboarding`).
- **Prepis otázky modelom** trvá až 3,7 s (zmerané naostro) — nie je to
  dôsledok tohto rozhodnutia, ale čas po prvý token (D9) zaťažuje.
- **Ostré normy majú zatiaľ po jednom znení** — porovnanie a otázky k dátumu
  sú naostro overené na `sfz:test_znenia`.

## 5. Implementácia

| čo | kde |
|---|---|
| platné znenia, rozsah hľadania | `lib/searchVersions.ts` |
| filtre hľadania | `lib/mongoSearch.ts` |
| príznak členenia, migrácia | `lib/chunkSuperseded.ts`, `scripts/migrate_chunk_superseded.mjs` |
| osirelé úseky | `lib/chunkOrphans.ts`, `scripts/delete_orphan_chunks.mjs` |
| definície indexov, úprava na mieste | `scripts/lib/searchIndexes.mjs`, `scripts/atlas_init.mjs --upravit`, `scripts/atlas_check.mjs` |
| znenie a deň pre model | `lib/versionContext.ts` |
| deň otázky | `lib/queryTime.ts`, `lib/queryPreprocessor.ts` |
| porovnanie | `lib/versionCompare.ts`, `lib/comparison.ts` |
| cesta otázky | `app/api/chat/route.ts` |
| štítok a zdroje | `components/Answer.tsx`, `lib/i18n.ts` (`answer.time*`, `answer.sourceVersion`) |
| testovací dokument, skúšobné otázky | `scripts/seed_version_test.mjs`, `scripts/version_questions.mjs` |
