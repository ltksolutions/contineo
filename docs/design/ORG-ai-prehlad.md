# ORG-ai-prehlad — Prehľad spotreby AI

Referencia: artefakt typu *Design* „ORG-ai-prehlad — Prehľad spotreby AI"
https://claude.ai/artifact/3o62dJ7okSqCEi9v3skJTA (prvý návrh po novom:
`docs/DESIGN.md`, „Prechod do Claude"; design system je naň napojený ako
kópia artefaktu „Contineo — design system", verzia 1792842500-5549).
Zadanie: `docs/design/ORG-ai-prehlad-zadanie.md`. Kód: `app/organisation/[section]/page.tsx`
(blok `aiView === "usage"`), `lib/aiUsage.ts`, `lib/pricing.ts` (`formatUsd`),
`globals.css` (blok „Spotreba AI (ADR-026)").
Rámy: 390 / 834 / 1440, svetlá aj tmavá. 24. 10. 2026.

## Čo je na plátne

| rám | čo ukazuje |
|---|---|
| `Main` 1440 | predvolený stav: **október 2026**, pohľad Osoby — rebríček a matica Osoba × (Suma, Podiel, Volaní, Tokeny) |
| `Month-834`, `Month-390`, `Month-390-dark` | ten istý stav na tablete a telefóne (karty), tmavá s pohľadom Účely |
| `Year-1440` | rozsah 1. 1. – 31. 12. 2026: graf 12 stĺpcov a matica Osoba × I–XII + Spolu + tokeny |
| `Year-1440-dark-purposes` | tmavá téma, pohľad Účely |
| `Year-1440-models` | pohľad Modely: pod sumou modelu tri riadky vstup / výstup / cache po mesiacoch |
| `Year-390-dark` | rok na telefóne: karty s malým grafom 12 mesiacov a posledným mesiacom |
| `Empty-834` | rok bez volaní: `.empty` s tichým odkazom na Nastavenie |
| `Usage-fix-1440` | dnešná Spotreba s opravou stĺpca OSOBA (Q6) |

Všetky rámy kreslí jeden zdroj (`Main.dc.html`), ostatné ho len vkladajú
s parametrami `view`, `range` a `accent` — rovnako ako to bude v kóde: jedna
stránka, stav v adrese. Farba organizácie je tweak `accent` (v kóde
`tenantStyle`); v návrhu je `#2443c4` / tmavá `#7d93ff`, ako v starších rámoch.

## Čo sa navrhuje

1. **Tretia položka podmenu** `Nastavenie | Spotreba | Prehľad`
   (`/organisation/ai/overview`), `.tabs` s farbou organizácie.
2. **Obdobie je voliteľný rozsah Od–Do, predvolený aktuálny mesiac**
   (Ján 24. 10. 2026, mení Q2): karta `.ai-filter` s dvoma dátumovými poľami
   (prázdne = aktuálny mesiac, nápoveda `.field-hint`), tichým „Použiť"
   a riadkom *Rýchly výber: tento mesiac · rok 2026 · posledných
   12 mesiacov · rok 2025* — sú to odkazy, takže funguje bez JavaScriptu
   (`?from=&to=`; prázdne = `dateTrunc` aktuálneho mesiaca v UTC).
3. **Prepínač pohľadu** `.view-switch.view-switch--full` Osoby | Účely |
   Modely — sivý, `?view=people|purposes|models`, pod súčtami, lebo súčty
   od pohľadu nezávisia a graf s maticou áno.
4. **Súčty** v `.usage-summary.card` (rovnaký blok ako Spotreba): Suma
   s porovnaním „+12 % oproti I–X 2025" / „+8 % oproti októbru 2025"
   (`.quiet.ai-delta`, len keď má rovnaké obdobie pred rokom dáta),
   Priemer na mesiac (len pri ≥ 2 mesiacoch), Volaní, Tokeny
   vstup / výstup / cache.
5. **Upozornenie** `.lnote.lnote--warn`, keď sú v období volania
   s `unknownModel`: „Suma je neúplná: 37 volaní použilo model mimo cenníka
   a je započítaných s $0." Počet je odkaz do Spotreby.
6. **Graf** v `.card` s nadpisom `.page-head--section`:
   - rozsah ≥ 2 mesiace: 12 stĺpcov (CSS mriežka `.ai-chart`, žiadna
     knižnica), stĺpec zložený z 5 najväčších položiek pohľadu a „Ostatné (n)",
     súčet nad stĺpcom (od 640 px), dve pomocné čiary s hodnotou, legenda
     `.ai-legend`; budúce mesiace sú prázdne miesto s bodkovanou základňou;
     stĺpec je odkaz do Spotreby na ten mesiac;
   - jeden mesiac: **rebríček** `.ai-bars` (5 najväčších + Ostatné) — stĺpec
     za jediný mesiac by nič nepovedal, rebríček odpovie na „kto minul
     najviac" rovno;
   - textová alternatíva `p.sr-only` (mesiace a sumy, resp. poradie)
     a `aria-hidden` na kresbe.
7. **Matica** položka × mesiac (`.ai-matrix`, `role="table"` z `div`ov ako
   dnešná `.usage-table`), od 1024 px: Osoba | I … XII | Spolu | Tokeny
   vstup / výstup / cache; pri jednom mesiaci Osoba | Suma | Podiel | Volaní
   | Tokeny. Riadky zoradené podľa sumy, posledný je Spolu. **Každá bunka je
   odkaz** do Spotreby s filtrom (`from`, `to` mesiaca + `person` / `purpose`
   / `model`). Práca na pozadí má štítok `.tag.tag--archived` „na pozadí".
   Pod 1024 px karty `.ai-card`: názov (odkaz), suma, podiel a počet volaní,
   pri ≥ 2 mesiacoch malý graf `.ai-spark` a „október: $7.80" (odkaz),
   tokeny v riadku pod tým; na konci karta Spolu.
8. **Pohľad Modely**: riadok modelu so sumou po mesiacoch a pod ním tri tiché
   riadky `.ai-row-sub` vstup / výstup / cache v tokenoch (tis. / mil.).
9. **Export Excel** matice — tiché `.button--quiet.button--sm` v `.page-tools`,
   tie isté parametre (`/api/ai-overview?format=xlsx&view=&from=&to=`).
10. **Prázdny stav** `.empty`: „V období … sa AI nevolala", vysvetlenie od
    kedy sa volania zapisujú, tichý odkaz na Nastavenie. Filter a prepínač
    ostávajú, súčty, graf a matica sa nekreslia.
11. **Oprava Spotreby** (Q6): od 1024 px stĺpec Osoba `minmax(150px, 1.1fr)`
    a `overflow-wrap: normal` — `anywhere` ostáva pod 1024 px a v stĺpci
    „Na čo a prečo" (dlhé názvy súborov).

Plné tlačidlo na obrazovke nie je. „← Späť" sa nekreslí, návrat je cesta
`Úvod › Organizácia › Umelá inteligencia › Prehľad`.

Vzor SwiftUI: `Form` (Od/Do) + `Picker(.segmented)` (pohľad) + `Table` od
1024 px / `List` pod ňou; graf je `Chart(BarMark, stacking)` nakreslený CSS.

## Rozhodnuté

Rozhodnuté 24. 10. 2026 (Ján, v chate): **Q2 podľa B** („dátumový rozsah
daj voliteľný, predvolený je aktuálny mesiac"), **Q1 a Q3–Q8 podľa
odporúčaní (A)**. Odporúčaná možnosť je vždy prvá.

- **Q1 — Názov časti.** A „Prehľad" (cs „Přehled", en „Overview",
  `/organisation/ai/overview`) · B „Report" · C „Výkaz".
  **Odporúčam A:** rozhranie je slovenské; „Výkaz" znie ako účtovný doklad.
- **Q2 — Obdobie.** ~~A Rok po mesiacoch s výberom roka~~ · **B Voliteľný
  rozsah Od–Do po mesiacoch, prázdny = aktuálny mesiac.**
  **Rozhodnuté: B** (Ján). Rok je rýchly odkaz, nie samostatný ovládač; pri
  jednom mesiaci sa graf mení na rebríček, matica na stĺpce Suma / Podiel /
  Volaní / Tokeny. Rozsah sa zarovnáva na celé mesiace (UTC) a najviac na
  25 mesiacov (D159); dlhší sa oreže a povie to `.lnote--info`.
- **Q3 — Kde sú modely a tokeny.** A Pohľad Modely v prepínači; v ostatných
  pohľadoch ročné tokeny ako stĺpec za Spolu · B Rozbalenie riadku ·
  C Prepínač „Suma | Tokeny".
  **Odporúčam A:** suma ostáva hlavná, druhý prepínač nad prvým by sa plietol.
  V pohľade Modely sú tokeny po mesiacoch ako tri tiché riadky pod sumou
  (jedno číslo v bunke, nie tri).
- **Q4 — Porovnanie s minulým rokom.** A Áno, v súčtoch „+12 % oproti
  I–X 2025" za rovnaké mesiace · B Nie.
  **Odporúčam A.** Ukazuje sa len vtedy, keď má rovnaké obdobie pred rokom
  aspoň jedno volanie — do októbra 2027 teda u SFZ nebude (zápis od
  5. 10. 2026), ale kód ho má od začiatku.
- **Q5 — Export.** A Excel matice ako tiché tlačidlo · B Bez exportu.
  **Odporúčam A:** ročný prehľad sa nosí na porady.
- **Q6 — Oprava stĺpca OSOBA v tom istom PR.** A Áno · B Samostatne.
  **Odporúčam A:** jeden riadok CSS na obrazovke, ktorú návrh aj tak kreslí.

Doplnené pri kreslení (tiež s odporúčaním):

- **Q7 — Farby radov grafu.** A Odtiene farby organizácie (`color-mix`
  `--accent` 100 / 76 / 56 / 40 / 26 % so `--surface`) a „Ostatné" ako
  `--surface-2` · B Nová paleta 6 farieb.
  **Odporúčam A:** bez nového farebného tokenu, radí sa svetlosťou (nie len
  odtieňom), funguje v oboch témach a s každou farbou tenanta. Legenda a
  `title` na segmente nesú názov, farba nie je jediný nositeľ.
- **Q8 — Šírka tela časti.** A Prehľad si vypýta širšie telo
  (`.org-grid--wide`: `220px minmax(0, 1fr)` namiesto `minmax(0, 720px)`)
  · B Matica v boxe s vodorovným posunom.
  **Odporúčam A:** 15 stĺpcov sa do 720 px nezmestí čitateľne; rovnaký dôvod
  mala knižnica pri `--shell-maxw-wide`. Ostatné časti Organizácie ostávajú
  na 720 px.

## Odchýlky od design systému

Nový je len to, čo systém nemá. Všetko je z existujúcich tokenov
(`--accent`, `--surface`, `--surface-2`, `--line`, `--line-strong`, `--muted`,
`--fs-*`, `--radius`); žiadna nová farba, rozmer ani komponent.

- **O1 — graf** `.ai-plot`, `.ai-chart`, `.ai-col`, `.ai-seg`, `.ai-col-total`,
  `.ai-months`, `.ai-y`, `.ai-legend`, `.ai-swatch`, `.ai-s1`–`.ai-s6`
  a rebríček `.ai-bars`, `.ai-bar*`. **Odporúčanie:** pridať do `globals.css`
  ako blok „Prehľad AI" a opísať v `conventions.md` ako „graf zo servera":
  CSS mriežka, výšky v %, farby Q7, textová alternatíva povinná.
- **O2 — matica** `.ai-matrix`, `.ai-mrow`, `.ai-mhead`, `.ai-mname`,
  `.ai-mcell`, `.ai-total`, `.ai-share`, `.ai-tokens`, `.ai-mfoot`,
  `.ai-row-sub` (od 1024 px) a karty `.ai-cards`, `.ai-card*`, `.ai-spark`
  (pod 1024 px). Hlavička preberá typografiu `.usage-head` (10,5 px,
  verzálky). **Odporúčanie:** pridať; keď vznikne druhá matica
  (napr. potvrdenia × mesiac), povýšiť na všeobecné `.matrix`.
- **O3 — `.org-grid--wide`** (Q8 A). **Odporúčanie:** pridať k `.org-grid`,
  použiť len na `/organisation/ai/overview`.
- **O4 — štítok „na pozadí"** je existujúce `.tag.tag--archived`, bez novej
  triedy. Bez odchýlky, len poznámka.
- **O5 — `.ai-filter`** je varianta `.usage-filter` s tromi stĺpcami
  (170 / 170 / auto) a riadkom rýchleho výberu `.ai-quick` cez celú šírku.
  **Odporúčanie:** pridať ako `.usage-filter--range`, nie nový názov.
- **O6 — oprava `.usage-row`** od 1024 px (bod 11). Je to zmena existujúceho
  pravidla, nie odchýlka; zapíše sa do CHANGELOG.
- Podmenu je kreslené ako `nav.tabs > .tabs-bar > a.tab` — presne to, čo
  vykresľuje `TabsBar`; v kóde ostáva komponent.

## i18n (sk / cs / en)

Nové kľúče v `aiUsage`: `tabOverview` „Prehľad", `overviewTitle(period)`,
`overviewLead`, `rangeHintFrom` „Prázdne = aktuálny mesiac", `rangeHintTo`
„Prázdne = koniec mesiaca", `quick` „Rýchly výber:", `quickThisMonth`,
`quickYear(y)`, `quickLast12`, `viewPeople` „Osoby", `viewPurposes` „Účely",
`viewModels` „Modely", `sumPeriod` „Suma", `avgMonth` „Priemer na mesiac",
`tokensAll` „Tokeny vstup / výstup / cache", `delta(pct, period)`
„+12 % oproti I–X 2025", `incomplete(n)` „Suma je neúplná: {n} volaní použilo
model mimo cenníka a je započítaných s $0.", `background` „na pozadí",
`other(n)` „Ostatné ({n})", `chartMonths` „Suma po mesiacoch", `chartRank(period)`
„Kto míňa najviac: {period}", `colTotal` „Spolu", `colShare` „Podiel",
`tokIn/Out/Cache` „vstup / výstup / cache", `emptyPeriod(period)`
„V období {period} sa AI nevolala", `emptyPeriodText`, `exportMatrix`
„Export Excel", `lastMonth(name)`. Rímske číslice mesiacov sú rovnaké vo
všetkých troch jazykoch; názvy mesiacov cez `Intl.DateTimeFormat(lang)`.

## Údaje, ktoré v modeli neexistujú

- **Filter Spotreby podľa modelu** (`?model=`) — bunky pohľadu Modely a odkaz
  z `.lnote` (`model=unknown`) ho potrebujú; dnes má Spotreba len `person`
  a `purpose`. Pridať do `usageFilterFromQuery` a `$match`.
- **Práca na pozadí vo filtri osoby**: `personId` je prázdne, takže odkaz
  z riadku „Kontrola súladu dokumentov (na pozadí)" potrebuje hodnotu, napr.
  `person=bg:compliance-review` → `$match: { personId: null, purpose }`.
- **Počet volaní na riadok** (karty, matica pri jednom mesiaci): v agregácii
  `$sum: 1`, dnes sa počíta len celkovo.
- **Export matice** `/api/ai-overview` — nový koncový bod, hárok = pohľad.
- Porovnanie s minulým rokom = druhá agregácia za posunuté obdobie; výsledok
  sa nikde neukladá (D27).
- 🔴 Zmena schémy: **žiadna**. Agregácia `$group` podľa `$dateTrunc(at, month,
  UTC)` × kľúč pohľadu nad `ai_usage`, `companyCode` v `$match` (D32).

## Prompt pre Claude Code

```
stiahni design ORG-ai-prehlad

Artefakt https://claude.ai/artifact/3o62dJ7okSqCEi9v3skJTA + docs/design/ORG-ai-prehlad.md.
Q1, Q3–Q8 podľa odporúčaní (A), Q2 podľa Jána: rozsah Od–Do, prázdny = aktuálny mesiac.
Prečítaj organisation/[section]/page.tsx (blok usage), usage/page.tsx, lib/aiUsage.ts,
lib/pricing.ts, globals.css „Spotreba AI (ADR-026)", DEVLOG k ADR-026.

1. overview/page.tsx po vzore usage/page.tsx; tretí TabLink; i18n sk/cs/en (sekcia „i18n").
2. lib/aiUsage.ts: overviewMatrix(companyCode, {from,to,view}) — $group podľa
   $dateTrunc(at, month, UTC) × personId|purpose|model, $sum usd, tokens, 1 (calls),
   unknownModel; druhý beh za obdobie pred rokom; filter ?model= a person=bg:<purpose>.
3. Obrazovka v poradí: h1, tabs, page-head--section (h2 + lead + page-tools s Export Excel),
   .usage-filter--range (Od/Do/Použiť/rýchly výber), .usage-summary, .lnote--warn,
   .view-switch--full, graf (stĺpce ≥ 2 mesiace, rebríček pri 1), matica
   (div role=table od 1024 px, karty pod ňou), poznámka. Bunky sú odkazy do Spotreby.
4. globals.css: O1, O2, O3 (.org-grid--wide), O5 (.usage-filter--range), O6 (oprava .usage-row).
   Farby radov color-mix z --accent (Q7). Textová alternatíva grafu p.sr-only.
5. /api/ai-overview?format=xlsx (hárok = pohľad). Prázdny stav .empty.
6. docs/DEVLOG.md, CHANGELOG, conventions.md (graf zo servera, matica), DESIGN_ODCHYLKY (Q8).
Overenie: tsc, eslint, vitest, build; 390/834/1440 svetlá aj tmavá; bez JS (GET, odkazy);
klik na bunku = rovnaký súčet v Spotrebe (UTC); 2 mesiace cez prelom roka (XI 25, XII 25, I 26).
```
