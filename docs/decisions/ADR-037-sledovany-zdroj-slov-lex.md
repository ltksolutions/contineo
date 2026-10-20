# ADR-037 — Sledovaný zdroj legislatívy: zákon zo Slov-Lexu do knižnice v dvoch krokoch

> **Stav:** prijaté · **Dátum:** 2026-10-20
> **Rozhodol:** Ján Letko (2026-10-20) — „Zákon o športe je nadradený
> Stanovám, ako ho implementujeme do Knižnice? … Sledovať ten link v čase
> a pravidelne ho aktualizovať je dôležité, zákony sa v čase menia
> a dopĺňajú"; k analýze možností: „Rozhodni — sprav ADR podľa odporúčania
> (sledovaný zdroj slov-lex v dvoch krokoch) a začni krokom B".
> **Čísla rozhodnutí:** D242–D247 (D241 medzitým použil dodatok 3 ADR-036
> pre požiadavky z hierarchie).
> **Nadväzuje na:** ADR-029 (import z konektora: pôvod `documents.source`,
> koncept, re-sync ako nové znenie), ADR-011 (schvaľuje a potvrdzuje sa
> PDF), ADR-034 (druh `zakon` s najvyššou záväznosťou D216, hierarchia
> dokumentov D219), ADR-035 (rez zo štruktúry Markdownu; § je jednotka),
> ADR-006 (schvaľovanie znenia), ADR-036 (kontrola sa spúšťa len po
> potvrdení, D235), D24 (dôkazné záznamy sa nemenia), D27 (stav sa
> odvodzuje), `docs/INGESTION_zdroje_reconciliation.md` kap. 2.3 (web linky
> jednorazové, bez auto-sync) a kap. 4 (re-sync podľa odtlačku).
> **Implementácia:** krok B — `lib/slovLex.ts` (čítanie portálu, prevod na
> Markdown), `lib/webImport.ts` (import a kontrola zdroja),
> `/library/new/web`, blok „Zdroj" s tlačidlom „Skontrolovať zdroj" na
> detaile dokumentu. Krok C (cron a upozornenie) je otvorený, § 5.

---

## 1. Kontext

**Zákon je nadradený Stanovám.** Od ADR-034 má knižnica druh `zakon`
s najvyššou záväznosťou, Stanovy mu vedia nastaviť nadradenosť (D219)
a kontrola súladu meria od najvyššieho záväzného dokumentu (D218). Zákon
č. 440/2015 Z. z. o športe v knižnici napriek tomu nie je — nemal ako
vzniknúť inak než ručným prepisom.

**Štvrtá cesta zápisu.** Do knižnice sa dnes zapisuje troma cestami
(súbor, editor, import z MCP konektora). Stránka `contineo.app/sk/technologia`
sľubuje „Weby a RSS" ako pripravované; pôvodný návrh z júna (kap. 2.3)
rátal s jednorazovým importom z adresy bez automatiky. Hlavička
`lib/curation.ts` výslovne odkladá otázku, čo štvrtá cesta znamená pre
overené odpovede.

**Čo Slov-Lex ponúka** (overené 20. 10. 2026):

- Hlavný portál `www.slov-lex.sk` je aplikácia v JavaScripte; bez neho vráti
  len obal. Nemá RSS pre konkrétny predpis, verejné API ani export
  otvorených dát (ELI len ako adresa, nie ako údaje).
- **Statická verzia portálu** `static.slov-lex.sk`, na ktorú hlavný portál
  sám odkazuje, funguje bez skriptu: `/static/SK/ZZ/2015/440/` je **história
  predpisu** — tabuľka znení s dátumom účinnosti od–do a číslom novely;
  `/static/SK/ZZ/2015/440/20260101.html` je **text znenia** (1,4 MB HTML,
  370 kB textu, 172 paragrafov) so sémantickými triedami `paragraf`,
  `odsek`, `pismeno`, `bod`, `priloha`, `poznamka` a kotvami tvaru
  `#paragraf-58.odsek-1.pismeno-k`; `/pdf/SK/ZZ/2015/440/ZZ_2015_440_20260101.pdf`
  je **záväzné PDF** znenia (11 MB). Portál sám hovorí, že HTML je
  informatívne a záväzné je PDF.
- Server nedáva `Last-Modified` ani `ETag`. Novela sa v tabuľke histórie
  objaví **s dátumom účinnosti v budúcnosti** mesiace pred tým, než platí.
- Text zákona je úradné dielo bez autorskoprávnej ochrany; kópia
  v knižnici je v poriadku.

## 2. Rozhodnutia

### D242 — Adaptér pre Slov-Lex, nie generický web

Štvrtá cesta zápisu je **sledovaný zdroj s adaptérom**, prvý adaptér je
Slov-Lex. Predpis identifikuje adresa v tvare `SK/ZZ/<rok>/<číslo>`
(prijme sa adresa hlavného aj statického portálu), čítaný je statický
portál. Generický import ľubovoľnej adresy a RSS ostávajú „pripravujeme":
Slov-Lex RSS nemá a porovnávanie celého HTML je krehké, lebo obal stránky
sa mení nezávisle od textu.

### D243 — Zmena znenia je nový riadok v histórii, nie iný odtlačok

Dokument nesie **časovú verziu** (`timepoint`, `YYYYMMDD`) znenia, ktoré
je v knižnici naposledy stiahnuté. Kontrola zdroja prečíta tabuľku
histórie a keď je v nej znenie s novším dátumom účinnosti, stiahne ho
a založí **koncept nového znenia s účinnosťou podľa Slov-Lexu** — aj keď
je v budúcnosti. Znenie v knižnici platí odo dňa účinnosti (D6, D106),
takže pripravené vopred zverejní správne. Odtlačok textu je len doplnok:
keď nové znenie nie je, porovná sa text tej istej časovej verzie, aby sa
chytila oprava textu na portáli.

Pri importe sa berie znenie **účinné v deň importu**; neskoršie znenia
hlási kontrola zdroja.

### D244 — Záväzné PDF zo Slov-Lexu je PDF znenia; Markdown z HTML je text

Schvaľuje a potvrdzuje sa PDF (ADR-011). Pri zákone máme originál, preto
sa PDF znenia **sťahuje zo Slov-Lexu**, nevysádza u nás. Markdown vzniká
z HTML znenia a je zdrojom textu na vyhľadávanie (D95): článok, časť,
hlava, skupina paragrafov a § sú nadpisy podľa hĺbky, odsek, písmeno
a bod sú odseky so svojím označením, prílohy a poznámky pod čiarou sú
vlastné časti. Rez podľa ADR-035 tak dostane § ako jednotku a citácia
z nadpisu je „§ 58".

### D245 — Pôvod `source.type: "web"` rozširuje dnešný pôvod

`documents.source` dostáva druhý tvar popri `mcp`: adaptér (`slov-lex`),
adresa zadaná človekom, identifikátor predpisu (`SK/ZZ/2015/440`), časová
verzia, čas stiahnutia, odtlačok textu a verzia adaptéra. Typ zdroja
dokumentu je `web` (číselník `sourceType` ho má od júna). Názov dokumentu
sa skladá z portálu: „Zákon č. 440/2015 Z. z. o športe a o zmene
a doplnení niektorých zákonov"; druh, prístup, jazyk, priečinok a útvar
volí človek pri importe ako pri konektore. Jeden predpis má v organizácii
jeden dokument — druhý import tej istej adresy vedie na existujúci.

### D246 — Schvaľuje správca obsahu štandardným postupom

Znenie zákona ide štandardným postupom (ADR-006, ADR-014). Schvaľovateľ
nerozhoduje o obsahu — potvrdzuje, že stiahnuté znenie je to, ktoré
Slov-Lex vyhlásil. Údaje o znení (ADR-013) sa predvyplnia: prijal
„Národná rada Slovenskej republiky", účinnosť z histórie; dátum
schválenia orgánom sa nevypĺňa, lebo konsolidované znenie ho nemá.
Nové znenie ide cestou `publish()`, takže overené odpovede z neho
odvodené expirujú ako pri každom inom predpise (`lib/curation.ts`).

### D247 — Dva kroky: ručná kontrola, potom cron

- **Krok B (teraz):** import z adresy na `/library/new/web` a tlačidlo
  „Skontrolovať zdroj" na detaile dokumentu. Nič sa nedeje bez človeka.
- **Krok C (potom):** denný cron prejde dokumenty s pôvodom `web`, urobí to
  isté, čo tlačidlo, a správcovi obsahu pošle upozornenie o koncepte
  nového znenia. Kontrola súladu Stanov sa po zverejnení **ponúkne,
  nespustí** (D235). Krok C sa robí až keď krok B prejde na zákone
  o športe aspoň jednou novelou — rovnaký dôvod ako pri ADR-027: algoritmus
  odladený bez skutočnej zmeny by bol odhad.

## 3. Dôsledky

- Na `contineo.app/sk/technologia` sa „Weby a RSS" rozdelí: sledované
  zdroje legislatívy (Slov-Lex) sú hotové, RSS a ďalšie weby pripravujeme.
- `docs/TODO.md` bod „Štvrtá cesta zápisu do knižnice" sa uzavrie: nové
  znenie zo zdroja ide cez `publish()`, takže kurácia nepotrebuje nič navyše.
- Jedna kontrola zdroja stiahne do 1,5 MB HTML a pri novom znení 11 MB
  PDF; strop úložiska je 25 MB. Časový limit sťahovania je 30 s na súbor.
- Keď portál zmení značkovanie, prevod zlyhá nahlas (chýbajúci koreň
  predpisu je chyba, nie prázdny dokument) a dokument ostane, aký bol.

## 4. Zamietnuté

- **Generický RSS a web crawler** — Slov-Lex RSS nemá; hash celého HTML je
  krehký. Vhodné neskôr pre vestníky a úradné weby, ktoré RSS majú.
- **Cudzí MCP server `sk-eli-mcp`** — číta ten istý statický portál;
  pridáva hosting a závislosť bez záruky, nič navyše.
- **Ručné nahrávanie** — prevod 370 kB textu do Markdownu je práve práca
  adaptéra a sledovanie by stálo na pamäti človeka.
- **Vlastné PDF z Markdownu** (ako pri konektore) — originál je dostupný
  a záväzný; náhrada by bola horšia kópia.

## 5. Otvorené

- Krok C: cron, upozornenie Kuriérom alebo e-mailom, čo robiť pri
  koncepte, ktorý človek medzitým rozpracoval (dnes ho nové stiahnutie
  prepíše — rovnako ako re-sync konektora).
- Vykonávacie predpisy (vyhlášky k zákonu) ako samostatné dokumenty
  s nadradeným zákonom — portál ich vypisuje vo „Vzťahoch predpisu".
- Český ekvivalent (`zakonyprolidi.cz`, Sbírka zákonů) ako druhý adaptér,
  keď bude český tenant.
