<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-039 — Katalóg legislatívy: predpisy zo Slov-Lexu ako zdieľaný zdroj platformy, zdroj „Legislatíva" na Opýtať sa, odber do knižnice

> **Stav:** prijaté · **Dátum:** 2026-10-25
> **Rozhodol:** Ján Letko (2026-10-25) — „Mám nápad, implementujem
> slov-lex.sk ako štandardný zdroj"; k dvom možným tvarom: „Rozpracuj
> Slov-Lex ako katalóg platformy: jedna zdieľaná kópia predpisov pre všetky
> organizácie, zdroj Legislatíva na Opýtať sa a odber predpisu do knižnice
> z katalógu. Začni ADR."
> **Čísla rozhodnutí:** D257–D262.
> **Nadväzuje na:** ADR-037 (adaptér Slov-Lex, statický portál, časová
> verzia znenia, záväzné PDF, pôvod `source.type: "web"`; krok C odložený
> v D247), ADR-029 (živý zdroj pri odpovedi, D174 výsledok je obsah, nie
> pokyn; výber zdrojov na Opýtať sa), ADR-034 (druh `zakon`, hierarchia
> D219), ADR-035 (rez zo štruktúry Markdownu, § ako jednotka), ADR-001
> § 4 a `embeddingGuard.ts` (jeden vektorový priestor), ADR-002
> a `residency.ts` (kde smie text prebiehať), ADR-026 (spotreba AI
> organizácie), ADR-038 D250 (zdroje v nástroji `ask`), D24 (dôkazné
> záznamy sa nemenia), D27 (stav sa odvodzuje), D32 a D90 (`companyCode`
> v podmienke dotazu).
> **Prekonáva:** D247 v časti „krok C až po prvej novele" (§ 2, D261).
> **Implementácia:** fáza 1 (25. 10. 2026) — `lib/lawCatalog.ts` (katalóg,
> znenia, úseky, odbery), `lib/lawSearch.ts` (hľadanie a úseky pre
> odpoveď), cron `/api/cron/law-catalog` (denne 4:15), správa katalógu
> `/admin/law`, odber v Organizácia → Umelá inteligencia → Legislatíva
> (`/organisation/ai/law`), zdroj „Legislatíva" vo výbere zdrojov na `/ask`,
> v plachte otázky, vo widgete kanála a v nástroji `ask` MCP servera;
> indexy `law_vector_index` a `law_text_index` v `scripts/lib/searchIndexes.mjs`
> (zakladá `atlas_init.mjs`). Fáza 2 — odber do knižnice (§ 2, D260, D262).

---

## 1. Kontext

**Čo už je.** ADR-037 (20. 10.) priniesol adaptér pre Slov-Lex: Knižnica →
Nahrať → Predpis zo Slov-Lexu stiahne znenie účinné dnes, záväzné PDF
a text z HTML; „Skontrolovať zdroj" založí koncept novely. Zákon
č. 440/2015 Z. z. o športe je v SFZ koncept nadradený Stanovám. Funguje to
a nič z toho sa nemení.

**Čo tomu chýba.** Predpis je dnes **dokument organizácie**: každá si ho
sťahuje, reže, indexuje a schvaľuje zvlášť, hoci text zákona je pre všetky
rovnaký a je to úradné dielo bez autorskoprávnej ochrany. Z toho plynú tri
veci:

1. Asistent odpovedá zo zákona **až keď ho organizácia importuje
   a zverejní** — dovtedy o legislatíve mlčí, aj keď sa pýtajúci pýta
   na niečo, čo zákon upravuje priamo (sadzby, lehoty, povinnosti).
2. Náklad sa násobí počtom organizácií: 370 kB textu, 176 úsekov,
   embeddingy, 11 MB PDF — a krok C z ADR-037 by bol **cron per
   organizácia**, ktorý by na tom istom portáli robil to isté N-krát.
3. Opýtať sa má od 23. 10. výber zdrojov („Zdroje: Knižnica ▾", živé
   konektory podľa ADR-029). Legislatíva tam ako zdroj nie je a bez
   vlastného indexu ani byť nemôže: Slov-Lex nemá vyhľadávanie ani API
   (ADR-037 § 1), statický portál dáva len celé predpisy. „Živý zdroj
   Slov-Lex" by teda aj tak musel predpisy najprv stiahnuť a zaindexovať —
   katalóg by vznikol, len schovaný.

**Čo máme k dispozícii.** Embeddingy robí Atlas sám (`atlas-auto`,
`voyage-4`, platí ich prevádzkovateľ, nie organizácia cez vlastný kľúč
z ADR-026). Úsek (`ChunkResult`) už nesie `sourceType` a odpoveď vie
ukázať, odkiaľ čo je (`qa`, `mcp`). Rez zo štruktúry Markdownu (ADR-035)
dáva pri zákone § ako jednotku a citáciu „§ 58". Pravidlo D90 vyžaduje
`companyCode` v každom dotaze na obsah organizácie — katalóg legislatívy
**nie je obsah organizácie**, a práve to treba povedať nahlas, nie obísť.

## 2. Rozhodnutia

### D257 — Katalóg legislatívy je zdieľaný obsah platformy, výslovná výnimka z D90

Predpisy zo Slov-Lexu sa ukladajú **raz, mimo organizácií**, do vlastných
kolekcií bez `companyCode`: `law_acts` (predpis: identifikátor
`SK/ZZ/<rok>/<číslo>`, názov, druh, kedy pridaný a kým), `law_act_versions`
(znenie: časová verzia `YYYYMMDD`, účinnosť od–do, číslo novely, odtlačok
textu, Markdown, odkaz na záväzné PDF na Slov-Lexe, verzia adaptéra)
a `law_chunks` (úseky znenia s vektormi; tvar ako `document_chunks`, aby
rerank, generovanie a citácie išli tou istou cestou).

- **Výnimka z D90 je menovitá:** funkcie v `lib/lawCatalog.ts`
  a `lib/lawSearch.ts` organizáciu neberú, lebo katalóg žiadnej nepatrí.
  Opačným smerom platí D90 bez výnimky — čo si organizácia z katalógu
  **vybrala** (odber, D259/D260), je jej záznam s `companyCode`.
- **Katalóg nie je dôkazný záznam.** Nikto v ňom nič nepotvrdzuje ani
  neschvaľuje; je to kópia verejného zdroja, ktorú smie cron prepísať
  pri oprave textu na portáli (odtlačok, ADR-037 D243). Dôkazné zostáva
  len to, čo z katalógu vstúpi do knižnice organizácie (D260).
- **Rezidencia:** katalóg žije v Atlase prevádzkovateľa. Organizácia
  v režime `on-prem` alebo `air-gap` ho pri odpovedi nečíta (text otázky
  by opustil perimeter) — zdroj „Legislatíva" sa jej neponúkne, rovnako
  ako sa jej nedá zapnúť MCP (ADR-038 D251). Lokálna replika katalógu je
  otvorená (§ 5).
- Správu katalógu má **správca platformy** (`/admin/law`): zoznam
  predpisov, znenia, posledná kontrola, kto odoberá. Predpis do katalógu
  **pridá aj správca obsahu ktorejkoľvek organizácie** tým, že si ho
  objedná adresou alebo číslom (D259) — katalóg rastie podľa potreby, nie
  podľa zoznamu vopred. Odstrániť predpis smie len správca platformy,
  a len keď ho nikto neodoberá.

### D258 — Jedna kópia, všetky znenia, § ako úsek

Katalóg drží pre každý predpis **všetky znenia z histórie na Slov-Lexe**,
nie len to účinné dnes — vrátane znení s účinnosťou v budúcnosti. Dôvod je
rovnaký ako pri porovnaní znení v knižnici (krok 7 odpovede): otázka „čo
platilo v januári" alebo „čo sa zmení od júla" potrebuje to znenie, nie
dnešné. Pri odpovedi sa predvolene hľadá v znení **účinnom v deň otázky**;
keď otázka nesie čas (`time.kind`), použije sa znenie účinné vtedy.

Text znenia sa reže zo štruktúry Markdownu (ADR-035): § je jednotka,
odsek a písmeno sú obsah úseku, článok, časť a hlava sú cesta v nadpise.
Úsek nesie identifikátor predpisu, časovú verziu, `articleRef` („§ 58"),
kotvu na portáli (`#paragraf-58`) a `sourceType: "law"`. Vektory robí
Atlas (`atlas-auto`) v tom istom priestore ako knižnica
(`embeddingGuard.ts` platí aj tu: iný model katalógu než knižnice je
chyba, nie tichý pokles kvality). Dlhý § nad strop úseku sa delí ako
pri dokumente (ADR-035, #398), bez návrhu AI — katalóg sa reže
mechanicky a rovnako pre všetkých.

### D259 — Zdroj „Legislatíva" na Opýtať sa; organizácia si vyberá predpisy

Vo výbere zdrojov (`/ask`, plachta otázky, widget kanála, nástroj `ask`
MCP servera) pribúda **vstavaný zdroj „Legislatíva"** popri Knižnici
a živých konektoroch. Nie je to konektor (ADR-029): nemá server, profil
ani prihlásenie, je vždy pripojený a nič nestojí — preto sa neobjavuje
v zozname konektorov, ale je to zdroj ako každý iný.

- **Odber na Opýtať sa:** organizácia si v nastavení (Organizácia →
  Umelá inteligencia → Legislatíva) **vyberie predpisy**, z ktorých má
  asistent odpovedať, a či je zdroj „používať predvolene". Výber je
  záznam organizácie (`law_subscriptions`: `companyCode`, identifikátor
  predpisu, úroveň odberu, kto a kedy). Bez výberu zdroj nie je — celý
  katalóg sa neprehľadáva, lebo zákon o rybárstve do odpovedí futbalového
  zväzu nepatrí a každý nesúvisiaci úsek berie miesto súvisiacemu.
- **Pri odpovedi** sa úseky legislatívy hľadajú súbežne s knižnicou
  (ako `liveSearch`), radia sa **za knižnicu** a idú do spoločného
  reranku. Zlyhanie katalógu nezhodí odpoveď z knižnice; hlavička
  odpovede menuje „Legislatíva" medzi tým, v čom sa hľadalo
  (`searchedScope`), aj keď nič neprišlo.
- **Citácia** je „Zákon č. 440/2015 Z. z., § 58" s odkazom na znenie na
  hlavnom portáli Slov-Lexu s kotvou paragrafu; v zdrojoch odpovede je
  úsek označený ako legislatíva, nie ako dokument organizácie (rovnaký
  dôvod ako pri `qa`: čitateľ má vedieť, že číta zákon, nie normu zväzu).
  Zákon je verejný, preto je dostupný aj v odpovedi s úrovňou `public`
  (widget kanála).
- **Poradie záväznosti** zostáva z ADR-034: zákon je nad všetkým. Model
  dostane úseky s označením zdroja a pokyn, že pri rozpore medzi zákonom
  a predpisom organizácie to **povie**, nie potichu vyberie.
- Spotreba AI z odpovede sa účtuje organizácii ako doteraz (ADR-026);
  embeddingy katalógu platí prevádzkovateľ (D257).

### D260 — Odber do knižnice je dokument organizácie z kópie v katalógu

Keď má byť predpis v **hierarchii** organizácie (nadradený Stanovám, D219)
alebo má byť **potvrdzovaný** ľuďmi, musí byť dokumentom knižnice so
schválením (ADR-006) a záväzným PDF (ADR-011, ADR-037 D244). To zostáva
presne tak, ako to ADR-037 postavilo — mení sa **odkiaľ** dokument vzniká:

- Knižnica → Nahrať → Predpis zo Slov-Lexu ponúkne **výber z katalógu**
  (predpisy, ktoré organizácia odoberá alebo ktoré v katalógu už sú)
  a pole na adresu či číslo pre predpis, ktorý tam ešte nie je — ten sa
  pridá do katalógu a odoberie v jednom kroku. Text a PDF sa **berú
  z katalógu**, zo Slov-Lexu sa už nič nesťahuje druhýkrát.
- Pôvod dokumentu ostáva `source.type: "web"`, adaptér `slov-lex`,
  identifikátor predpisu a časová verzia (ADR-037 D245) — pribúda len
  `catalog: true`. Starý dokument `sfz:zakon_440_2015` sa na katalóg
  **napojí identifikátorom** pri prvom behu fázy 2, bez nového stiahnutia
  a bez zmeny znení (D24).
- **Nové znenie v katalógu** (D261) založí v každej knižnici, ktorá predpis
  odoberá, **koncept nového znenia s účinnosťou zo Slov-Lexu** — to isté,
  čo dnes robí „Skontrolovať zdroj" (ADR-037 D243, D246). Tlačidlo
  zostáva pre prípad, že človek nechce čakať na cron.
- Odber do knižnice **zahŕňa** odber na Opýtať sa; dokument v knižnici
  a úseky katalógu toho istého predpisu sa pri odpovedi **neduplikujú**
  (ak je predpis zverejnený v knižnici, pri odpovedi sa berie znenie
  z knižnice, lebo to prešlo schválením; katalóg dopĺňa len to, čo
  v knižnici nie je).

### D261 — Jeden cron platformy namiesto kroku C per organizácia

Denný cron `/api/cron/law-catalog` prejde predpisy v katalógu, prečíta
históriu na Slov-Lexe, stiahne znenia, ktoré v katalógu nie sú (aj tie
s účinnosťou v budúcnosti), nareže a zaindexuje ich; pri rovnakej
časovej verzii porovná odtlačok textu a opravu na portáli prepíše
(katalóg nie je dôkazný záznam, D257). Potom pre každú organizáciu
s odberom do knižnice založí koncept nového znenia a správcovi obsahu
pošle upozornenie (Kuriér, ADR-033; e-mail ako záloha podľa nastavenia).

Tým sa **prekonáva čakacia podmienka D247** („krok C až po prvej
skutočnej novele"). Dôvod je v katalógu samom: kým bol predpis
dokumentom jednej organizácie, zastaraný text bol jej vec a tlačidlo
stačilo; zdieľaný katalóg, z ktorého odpovedajú všetci, musí byť aktuálny
bez toho, aby si to niekto pamätal. Riziko z D247 — algoritmus odladený
bez skutočnej zmeny — ostáva zapísané ako otvorené (§ 5): prvá skutočná
novela sa prejde ručne a porovná s tým, čo cron urobil.

### D262 — Fázy

| Fáza | Čo | Kde to človek uvidí |
|---|---|---|
| **1** | kolekcie katalógu, pridanie predpisu adresou alebo číslom, rez a index znení, cron znení, `/admin/law`, odber na Opýtať sa v nastavení organizácie, zdroj „Legislatíva" vo výbere zdrojov (`/ask`, plachta, widget, MCP `ask`), citácia s odkazom na Slov-Lex | Opýtať sa odpovedá zo zákona, ktorý si organizácia vybrala, bez importu do knižnice |
| **2** | odber do knižnice z katalógu, napojenie `sfz:zakon_440_2015`, koncept nového znenia z cronu, upozornenie správcovi obsahu, odstránenie duplicity knižnica ∕ katalóg pri odpovedi | Nahrať → Predpis zo Slov-Lexu vyberá z katalógu; novela príde sama ako koncept |
| **3** | vykonávacie predpisy zo „Vzťahov predpisu" ako podradené predpisy, predvolený súbor predpisov podľa druhu organizácie, český adaptér (`zakonyprolidi.cz`) ako druhý zdroj katalógu | — |

Každá fáza je vlastný PR; bez nového ADR, pokiaľ sa nezmení rozhodnutie.

## 3. Dôsledky

- Nové kolekcie `law_acts`, `law_act_versions`, `law_chunks`
  (s vektorovým a fulltextovým indexom Atlasu, rovnaký model ako
  `document_chunks`) a `law_subscriptions` (s `companyCode`). Číselník
  `sourceType` dostáva hodnotu `law` pre úseky; `documents.source` sa
  nemení, pribúda len príznak.
- `tenantScope.ts` a audit D90 dostanú zápis, že `lawCatalog.ts`
  a `lawSearch.ts` sú menovitá výnimka — a test, že do `law_chunks`
  nikdy nevstúpi `companyCode` a do `law_subscriptions` nikdy chýba.
- Výber zdrojov (`askSources.ts`, `askScope.ts`, `widgetSources.ts`,
  `mcpServer/tools.ts`) dostane tretí druh zdroja popri `library`
  a konektoroch; hlavička odpovede a `searchedScope` ho menujú.
- `contineo.app/sk/technologia`: „Sledované zdroje legislatívy" sa
  rozšíria o katalóg a zdroj Legislatíva; RSS a ďalšie weby ostávajú
  „pripravujeme".
- ADR-037 zostáva v platnosti pre adaptér, časovú verziu, PDF a pôvod;
  jeho § 5 „krok C" sa uzatvára týmto ADR. `docs/TODO.md` dostane body
  fáz 2 a 3.
- Jedno pridanie predpisu stiahne všetky znenia z histórie (pri zákone
  o športe 19 znení × okolo 1,4 MB HTML; PDF sa v katalógu nedrží, len odkaz —
  sťahuje sa až pri odbere do knižnice, D260).

## 4. Zamietnuté

- **Kópia predpisu v každej organizácii aj pre Opýtať sa** (dnešný stav
  rozšírený o zdroj) — N-násobný náklad a N cronov na jeden portál;
  asistent by stále mlčal, kým organizácia neimportuje.
- **Celý katalóg ako jeden zdroj bez výberu predpisov** — nesúvisiace
  predpisy vytláčajú súvisiace z reranku; výber je lacný a výslovný.
- **Legislatíva ako konektor podľa ADR-029** — konektor má server,
  profil, prihlásenie a rozsahy; katalóg nič z toho nemá a tváriť sa, že
  má, by znamenalo prázdne obrazovky.
- **Držať v katalógu len dnešné znenie** — otázky s časom a znenia
  vyhlásené vopred by nemali z čoho odpovedať; história je na portáli
  hotová a lacná.
- **Cudzí MCP server `sk-eli-mcp`** — zamietnuté už v ADR-037, dôvody
  platia.

## 5. Otvorené

- **Lokálna replika katalógu** pre `on-prem` a `air-gap` (jednosmerná
  synchronizácia z cloudu, alebo vlastný cron proti Slov-Lexu za
  perimetrom) — až keď taký zákazník bude.
- **Predvolený súbor predpisov** pre športový zväz (440/2015 o športe,
  1/2014 o organizovaní verejných športových podujatí, 83/1990
  o združovaní občanov, 18/2018 o ochrane osobných údajov) — návrh,
  Ján rozhodne pri fáze 1; do nastavenia vstúpi ako ponuka, nie ako
  zapnuté.
- **Prvá skutočná novela** v katalógu sa prejde ručne a porovná s tým,
  čo urobil cron (riziko z D247).
- **Rozpor zákon ∕ predpis organizácie v odpovedi** — ako presne ho má
  model povedať a či má byť zároveň podnetom pre kontrolu súladu
  (ADR-032, ADR-036) — po prvých odpovediach z fázy 1.
- **Vzťahy predpisu** (vykonávacie vyhlášky, zrušujúce predpisy) —
  fáza 3.
