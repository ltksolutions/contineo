# ORG-ai-prehlad — Prehľad spotreby AI

> Návrh z artefaktu typu *Design* v Claude
> (https://claude.ai/artifact/3o62dJ7okSqCEi9v3skJTA, verzia 1792847218-2e47,
> 24. 10. 2026) s pripojeným artefaktom „Contineo — design system"
> (kópia verzie 1792842500-5549). Zadanie: `ORG-ai-prehlad-zadanie.md`.
> Prvý návrh vytvorený po novom (`docs/DESIGN.md`, „Prechod do Claude").
> Implementácia: PR #425 (`f0e03fe`, 24. 10. 2026).

Kód: `app/organisation/AiOverview.tsx`, `organisation/[section]/overview/page.tsx`,
`lib/aiOverview.ts`, `lib/aiUsage.ts`, `api/ai-overview/route.ts`,
`globals.css` (bloky „Spotreba AI (ADR-026)" a nové všeobecné prvky).
Rámy: 390 / 834 / 1440, svetlá aj tmavá.

## Súbory

| súbor | čo je |
|---|---|
| `ORG-ai-prehlad.html` | hlavná plocha (`project/Main.dc.html`) — Prehľad s prepínačmi `view` a `range` |
| `ORG-ai-prehlad-spotreba.html` | `project/Usage-fix-1440.dc.html` — Spotreba s opravou stĺpca OSOBA |

Ostatné plochy (`Month-834`, `Month-390`, `Month-390-dark`, `Year-1440`,
`Year-390-dark`, `Year-1440-models`, `Year-1440-dark-purposes`, `Empty-834`)
sú len `<dc-import name="Main">` s inými vlastnosťami — obsah je v hlavnej
ploche, rovnako ako v kóde: jedna stránka, stav v adrese.

## Čo je na plátne

| rám | čo ukazuje |
|---|---|
| `Main` 1440 | predvolený stav: **október 2026**, pohľad Osoby — rebríček a matica Osoba × (Suma, Podiel, Volaní, Tokeny) |
| `Month-834`, `Month-390`, `Month-390-dark` | ten istý stav na tablete a telefóne (karty), tmavá s pohľadom Účely |
| `Year-1440` | rozsah 1. 1. – 31. 12. 2026: graf 12 stĺpcov a matica Osoba × I–XII + Spolu + tokeny |
| `Year-1440-dark-purposes` | tmavá téma, pohľad Účely |
| `Year-1440-models` | pohľad Modely: pod sumou modelu tri riadky vstup / výstup / cache po mesiacoch |
| `Year-390-dark` | rok na telefóne: karty s malým grafom 12 mesiacov a posledným mesiacom |
| `Empty-834` | obdobie bez volaní: `.empty` s tichým odkazom na Nastavenie |
| `Usage-fix-1440` | dnešná Spotreba s opravou stĺpca OSOBA (Q6) |

Farba organizácie je tweak `accent` (v kóde `tenantStyle`); v návrhu je
`#2443c4` / tmavá `#7d93ff`, ako v starších rámoch.

## Čo sa navrhuje

1. **Tretia položka podmenu** `Nastavenie | Spotreba | Prehľad`
   (`/organisation/ai/overview`), `.tabs` s farbou organizácie.
2. **Obdobie je voliteľný rozsah Od–Do, predvolený aktuálny mesiac**
   (Ján 24. 10. 2026, mení Q2): karta s dvoma dátumovými poľami (prázdne =
   aktuálny mesiac, nápoveda `.field-hint`), tichým „Použiť" a riadkom
   *Rýchly výber: tento mesiac · rok 2026 · posledných 12 mesiacov ·
   rok 2025* — sú to odkazy, takže funguje bez JavaScriptu (`?from=&to=`;
   prázdne = aktuálny mesiac v UTC).
3. **Prepínač pohľadu** `.view-switch.view-switch--full` Osoby | Účely |
   Modely — sivý, pod súčtami, lebo súčty od pohľadu nezávisia a graf
   s maticou áno.
4. **Súčty** v `.usage-summary.card` (rovnaký blok ako Spotreba): Suma
   s porovnaním „+12 % oproti I–X 2025" / „+8 % oproti októbru 2025"
   (len keď má rovnaké obdobie pred rokom dáta), Priemer na mesiac (len pri
   ≥ 2 mesiacoch), Volaní, Tokeny vstup / výstup / cache.
5. **Upozornenie** `.lnote.lnote--warn`, keď sú v období volania s modelom
   mimo cenníka: „Suma je neúplná: 37 volaní použilo model mimo cenníka
   a je započítaných s $0." Počet je odkaz do Spotreby.
6. **Graf** v `.card` s nadpisom `.page-head--section`:
   - rozsah ≥ 2 mesiace: 12 stĺpcov (CSS mriežka, žiadna knižnica), stĺpec
     zložený z 5 najväčších položiek pohľadu a „Ostatné (n)", súčet nad
     stĺpcom (od 640 px), dve pomocné čiary s hodnotou, legenda; budúce
     mesiace sú prázdne miesto s bodkovanou základňou; stĺpec je odkaz do
     Spotreby na ten mesiac;
   - jeden mesiac: **rebríček** (5 najväčších + Ostatné) — stĺpec za jediný
     mesiac by nič nepovedal, rebríček odpovie na „kto minul najviac" rovno;
   - textová alternatíva `p.sr-only` (mesiace a sumy, resp. poradie)
     a `aria-hidden` na kresbe.
7. **Matica** položka × mesiac (`role="table"` z `div`ov ako dnešná
   `.usage-table`), od 1024 px: Osoba | I … XII | Spolu | Tokeny; pri jednom
   mesiaci Osoba | Suma | Podiel | Volaní | Tokeny. Riadky zoradené podľa
   sumy, posledný je Spolu. **Každá bunka je odkaz** do Spotreby s filtrom.
   Práca na pozadí má štítok `.tag.tag--archived` „na pozadí". Pod 1024 px
   karty: názov (odkaz), suma, podiel a počet volaní, pri ≥ 2 mesiacoch malý
   graf a „október: $7.80" (odkaz), tokeny v riadku pod tým; na konci karta
   Spolu.
8. **Pohľad Modely**: riadok modelu so sumou po mesiacoch a pod ním tri tiché
   riadky vstup / výstup / cache v tokenoch.
9. **Export Excel** matice — tiché `.button--quiet.button--sm` v `.page-tools`,
   tie isté parametre.
10. **Prázdny stav** `.empty`: „V období … sa AI nevolala", tichý odkaz na
    Nastavenie. Filter a prepínač ostávajú, súčty, graf a matica sa nekreslia.
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
odporúčaní (A)**. Odporúčaná možnosť je vždy prvá. Pri sťahovaní návrhu
Ján rozhodol ešte o názvoch tried (na konci zoznamu).

- **Q1 — Názov časti.** A „Prehľad" (cs „Přehled", en „Overview",
  `/organisation/ai/overview`) · B „Report" · C „Výkaz".
  **Rozhodnuté: A** — rozhranie je slovenské; „Výkaz" znie ako účtovný doklad.
- **Q2 — Obdobie.** ~~A Rok po mesiacoch s výberom roka~~ · **B Voliteľný
  rozsah Od–Do po mesiacoch, prázdny = aktuálny mesiac.**
  **Rozhodnuté: B** — rok je rýchly odkaz, nie samostatný ovládač; pri
  jednom mesiaci sa graf mení na rebríček, matica na stĺpce Suma / Podiel /
  Volaní / Tokeny. Rozsah sa zarovnáva na celé mesiace (UTC) a najviac na
  25 mesiacov (D159).
- **Q3 — Kde sú modely a tokeny.** A Pohľad Modely v prepínači; v ostatných
  pohľadoch tokeny ako stĺpec za Spolu · B Rozbalenie riadku ·
  C Prepínač „Suma | Tokeny".
  **Rozhodnuté: A** — suma ostáva hlavná, druhý prepínač nad prvým by sa
  plietol. V pohľade Modely sú tokeny po mesiacoch ako tri tiché riadky pod
  sumou (jedno číslo v bunke, nie tri).
- **Q4 — Porovnanie s minulým rokom.** A Áno, v súčtoch „+12 % oproti
  I–X 2025" za rovnaké mesiace · B Nie.
  **Rozhodnuté: A.** Ukazuje sa len vtedy, keď má rovnaké obdobie pred rokom
  aspoň jedno volanie — do októbra 2027 teda u SFZ nebude (zápis od
  5. 10. 2026), ale kód ho má od začiatku.
- **Q5 — Export.** A Excel matice ako tiché tlačidlo · B Bez exportu.
  **Rozhodnuté: A** — ročný prehľad sa nosí na porady.
- **Q6 — Oprava stĺpca OSOBA v tom istom PR.** A Áno · B Samostatne.
  **Rozhodnuté: A** — jeden riadok CSS na obrazovke, ktorú návrh aj tak kreslí.
- **Q7 — Farby radov grafu.** A Odtiene farby organizácie (`color-mix`
  `--accent` 100 / 76 / 56 / 40 / 26 %) a „Ostatné" ako `--surface-2` ·
  B Nová paleta 6 farieb.
  **Rozhodnuté: A** — bez nového farebného tokenu, radí sa svetlosťou (nie
  len odtieňom), funguje v oboch témach a s každou farbou tenanta. Legenda
  a `title` na segmente nesú názov, farba nie je jediný nositeľ.
- **Q8 — Šírka tela časti.** A Prehľad si vypýta širšie telo
  (`.org-grid--wide`: `220px minmax(0, 1fr)` namiesto `minmax(0, 720px)`)
  · B Matica v boxe s vodorovným posunom.
  **Rozhodnuté: A** — 15 stĺpcov sa do 720 px nezmestí čitateľne; rovnaký
  dôvod mala knižnica pri `--shell-maxw-wide`. Ostatné časti Organizácie
  ostávajú na 720 px.
- **Nové prvky systému** — graf, rebríček, matica, malý graf a široké telo
  pridané **všeobecne** do `globals.css` a `conventions.md` (`.chart-*`,
  `.series-N`, `.matrix-*`, `.spark`, `.quick-ranges`, `.org-grid--wide`),
  nie ako `.ai-*` z návrhu (Ján pri stiahnutí, 24. 10. 2026).

## Odchýlky od design systému (v návrhu)

Nové je len to, čo systém nemal. Všetko z existujúcich tokenov
(`--accent`, `--surface`, `--surface-2`, `--line`, `--line-strong`, `--muted`,
`--fs-*`, `--radius`); žiadna nová farba, rozmer ani komponent. Názvy tried
nižšie sú z návrhu; v kóde dostali všeobecné mená (rozhodnutie vyššie).

- **O1 — graf** `.ai-plot`, `.ai-chart`, `.ai-col`, `.ai-seg`, `.ai-legend`,
  `.ai-s1`–`.ai-s6` a rebríček `.ai-bars` → `.chart-*`, `.series-N`.
  Graf zo servera: CSS mriežka, výšky v %, farby Q7, textová alternatíva
  povinná.
- **O2 — matica** `.ai-matrix`, `.ai-mrow`, `.ai-mcell`, `.ai-row-sub`
  (od 1024 px) a karty `.ai-cards`, `.ai-spark` (pod 1024 px) → `.matrix-*`,
  `.spark`. Hlavička preberá typografiu `.usage-head`.
- **O3 — `.org-grid--wide`** (Q8 A), len na `/organisation/ai/overview`.
- **O4 — štítok „na pozadí"** je existujúce `.tag.tag--archived`, bez novej
  triedy.
- **O5 — filter** varianta `.usage-filter` s riadkom rýchleho výberu
  → `.quick-ranges`.
- **O6 — oprava `.usage-row`** od 1024 px (bod 11); zmena existujúceho
  pravidla, v CHANGELOG.
- Podmenu je kreslené ako `nav.tabs > .tabs-bar > a.tab` — presne to, čo
  vykresľuje `TabsBar`; v kóde ostáva komponent.

## Odchýlky implementácie od návrhu

- Triedy `.ai-*` → všeobecné triedy systému (rozhodnutie vyššie).
- Pohľad je v adrese `?by=people|purposes|models`, nie `?view=` —
  `view` už rozlišuje časti sekcie.
- Bunky vedú do Spotreby cez skutočné filtre: osoba `person=<id>`, práca na
  pozadí `person=bg:<meno>` (nemá `personId`), účel `purpose=`, model
  `model=<presný identifikátor>`, model mimo cenníka `unpriced=1`. Spotreba
  ich vie; model a „mimo cenníka" ukáže vetou s „Zrušiť", prácu na pozadí
  ako skupinu v zozname Osoba.
- Pri práci na pozadí sa z mena vynecháva „(na pozadí)" — hovorí to štítok.
- Tokeny po mesiacoch v pohľade Modely sú v miliónoch bez jednotky
  („vstup (mil.)"), plný tvar sa do 12 stĺpcov nezmestil.
- Hlavička stĺpca tokenov je „Tokeny" (celý popis v `title` a v súčtoch).
- Os grafu: popis vpravo má vlastný pás 52 px, inak prekrýval súčet
  posledného stĺpca; horná hranica je okrúhle číslo tesne nad maximom.
- V tmavej téme sa odtiene série miešajú k textu, nie k ploche (inak boli
  takmer čierne).
- Cez prelom roka nesie rok len prvý mesiac a január („XI 25 · XII · I 26").
- Text prázdneho stavu bez „skontrolujte, či je asistent zapnutý" — odkaz
  „Nastavenie asistenta" to hovorí.

## Údaje, ktoré v modeli chýbali

Doplnené v PR #425: filter Spotreby podľa modelu a „mimo cenníka"
(`model=`, `unpriced=1`), práca na pozadí vo filtri osoby (`person=bg:`),
počet volaní na riadok v agregácii, export matice `/api/ai-overview`.
Porovnanie s minulým rokom je druhá agregácia za posunuté obdobie, nikde sa
neukladá (D27). Zmena schémy: **žiadna** — `$group` podľa `$dateTrunc(at,
month, UTC)` × kľúč pohľadu nad `ai_usage`, `companyCode` v `$match` (D32).
