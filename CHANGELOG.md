# Changelog

Všetky podstatné zmeny projektu Contineo. Formát vychádza z [Keep a Changelog](https://keepachangelog.com/sk/).

## [Unreleased]

### Added (2026-08-28 — tenant podľa hostiteľa, D29)

- **`app/src/lib/tenants.ts` + kolekcia `tenants`.** Hostiteľ určuje `companyCode`, vzhľad a jazyky. **Neznámy hostiteľ je zakázaný, nie predvolený** (ADR-002, ADR-003 kap. 5.4): predvolený tenant by znamenal, že ktokoľvek, kto si nasmeruje vlastnú doménu na naše nasadenie, dostane rozhranie niekoho iného — a bude to vyzerať legitímne, lebo certifikát aj obsah sedia. Odpoveď je `404`, nie vysvetľujúca hláška.
- **Prečo samostatný modul a nie rozšírenie `tenantProfile.ts`:** ten odpovedá na otázku „ktorý model a kde počíta" (ADR-001), tento na otázku „ktorá organizácia". Rôzna životnosť, rôzny vlastník; v jednom zázname by si neznámy hostiteľ priniesol aj nastavenie poskytovateľov.
- **`onboardingContext()` v `session.ts`** vracia stav požiadavky ako **jednu hodnotu** (`unknown-host` / `not-signed-in` / `not-in-tenant` / `ready`), nie ako tri nezávislé kontroly. Keby si každá stránka skladala „tenant + osoba + patria k sebe" sama, jedna z nich raz niektorú časť vynechá — a chýbajúca kontrola nevyzerá ako chyba, vyzerá ako fungujúca stránka.
- **Kontrola je aj v `POST /api/acknowledgements`,** nielen na stránke. Zápis potvrdenia je jediné miesto, kde vzniká auditný záznam, a volanie API stránku obchádza — záznam nesmie vzniknúť pod hlavičkou organizácie, ku ktorej potvrdzujúci nepatrí.
- **`app/scripts/tenant_set.mjs`** zakladá a upravuje tenanta; doménu už priradenú inému tenantovi **odmietne, nie prepíše**. Tiché prevzatie domény sa zistí až vtedy, keď ľudia z jednej organizácie uvidia hlavičku druhej. Rovnaké pravidlo drží aj unikátny index `hostname_unique` — databáza to ustráži aj vtedy, keď to skript prehliadne.
- Stav testov: **19 súborov, 489 testov** (z toho 25 nových na `tenants`).
- **Vedomé obmedzenie:** kontrola beží v serverových komponentoch a route handleroch, **nie v middleware** — to beží na hrane, kde Mongo klient nie je. Staršie plochy (`/`, `/sada`, `/api/chat`) sú tak chránené prihlásením, ale nie tenantom.
- **`internal.futbalsfz.sk` ešte nebeží:** poddoména je `CNAME` na `sportnet.online`. Doména je vo Verceli pridaná, DNS sa **nemenilo** — prepnutie by odstavilo to, čo tam beží dnes (`NASADENIE_app.md` kap. 0b).

### Fixed (2026-08-28 — nasadenie z Gitu)

- **Projekt `contineo-app` napojený na GitHub.** Push do `main` odteraz spúšťa produkčné nasadenie sám; root directory nastavené na `app`, produkčná vetva `main`. **Dovtedy napojený nebol a nikto si to nevšimol** — posledné nasadenie bolo staré 31 dní, hoci v repozitári medzitým pribudlo desať commitov. Kód bol hotový, testy prechádzali, živá aplikácia o ňom nevedela; `/dokumenty` na `app.contineo.app` neexistovalo, lebo build ho nepoznal. Ticho zlyhávajúce nasadenie je horšie ako hlučné, preto je stav napojenia zapísaný v `docs/NASADENIE_app.md`, nie len v nastaveniach Vercelu.
- Z toho istého repozitára sa teraz nasadzujú **dva** projekty — `contineo` (root `web`, marketingový web) a `contineo-app` (root `app`). Jeden push prestavia obe, aj keď sa menili len `docs/`. Ak by build minúty prekážali, *Ignored Build Step* `git diff --quiet HEAD^ HEAD -- .` to vyrieši.

### Added (2026-08-27 — skripty onboardingu)
- **`app/scripts/import_persons.mjs`** — import osôb z CSV. **Náhľad je predvolené správanie, zápis sa musí vypýtať** (`--zapis`): nahratie stovky ľudí naslepo je operácia, po ktorej sa hľadá, ako to vrátiť späť, a `persons` rollback nemá. Pri chybnom riadku nezapíše nič — zápis po častiach by nechal databázu v polovičnom stave. Hlavičky sa normalizujú (bez diakritiky, bez ohľadu na veľkosť), takže `Meno`, `meno` aj `MENO` sú to isté; prijíma slovenské aj anglické názvy stĺpcov.
- **`app/scripts/acknowledgement_report.mjs`** — výkaz potvrdení pre HR do CSV: kto potvrdil, kedy, ktorú verziu a v akom jazyku — a kto nie. Rozsah je **jeden `companyCode`, nie strom** (D32, D33). Výkaz ide na štandardný výstup, hlásenia na chybový, takže sa dá presmerovať do súboru.
- **`app/scripts/lib/csv.mjs`** — čítanie a písanie CSV bez knižnice: BOM z Excelu, bodkočiarka ako oddeľovač v slovenskom locale, úvodzovky okolo polí s oddeľovačom. 17 testov (`tests/csv.test.ts`) — keď sa hlavička netrafí, import ticho preskočí stĺpec a stovka ľudí príde o útvar alebo o jazyk.
- **`app/scripts/lib/ts-hook.mjs`** — dovolí skriptom importovať moduly zo `src/` priamo. Node 26 vie TypeScript spustiť (odstráni typy), ale nevie dohľadať bezpríponové relatívne importy; háčik ten rozdiel premostí. **Bez neho by skripty potrebovali vlastnú kópiu pravidla, ktorá verzia dokumentu platí** — a dve implementácie právneho pravidla sa raz rozídu bez toho, aby si to niekto všimol, lebo obe „fungujú".
- `src/lib/mongodb.ts`: typy z `mongodb` sa importujú cez `import type`. Node nevie, ktoré z pomenovaných importov sú typy, takže `Document` medzi hodnotami by skripty zhodil.
- Stav testov: **17 súborov, 454 testov**.


### Changed (2026-08-27 — identifikátory po anglicky)
- **Kód Fázy 8 premenovaný na anglické identifikátory.** Moduly `osoby.ts` → `persons.ts`, `dokumenty.ts` → `documents.ts`, `potvrdenia.ts` → `acknowledgements.ts`, `jazyky.ts` → `i18n.ts`; typy, funkcie, parametre aj lokálne premenné podľa toho. **Komentáre a popisy testov zostávajú po slovensky** — menia sa mená, nie reč vysvetlení.
- **Hodnoty vracané z API sú teraz strojové a anglické** (`"no-effective-version"`, `"already-acknowledged"`, `"invalid-email"`…). Sú to kľúče pre volajúceho, nie text pre človeka; ten sa priradí až v rozhraní podľa jazyka.
- Konvencia zapísaná do `docs/rag-architecture.md`. Staršie moduly (`hodnotenia.ts`, `cennik.ts`, `sada.ts`, `povoleneEmaily()`/`jePovoleny()`) sa neprepisujú naraz — premenujú sa, keď sa ich niekto aj tak dotkne.
- **Testy zamerané na funkcionalitu:** vypustené kontroly znenia českého a anglického prekladu formulky. Preklady prostredia sú samostatná vec a testovať ich reťazec po reťazci znamená udržiavať slovník dvakrát. Zostáva to, čo je funkcia — výber jazyka, fallback a invariant, že formulka v každom jazyku nesie názov, verziu aj dátum. (438 testov v 16 súboroch.)


### Changed (2026-08-27 — testy prešli na Vitest)
- **`npm test` beží cez Vitest** (`vitest run`), pribudlo `test:watch` a `test:coverage`. Vlastný beh testov (`tests/run.mjs` + bundlovanie esbuildom) sa už nepoužíva.
- **Dôvod nebol „Vitest je štandard", ale konkrétny strop:** funkcie volajúce `getCollection()` sa nedali otestovať vôbec — a boli medzi nimi tie najdôležitejšie: `personMaySignIn()` (brána medzi internými smernicami a internetom), `acknowledge()` (zápis právneho záznamu) a `zalozOsoby()` (hromadný import). Obísť sa to dalo len pridaním testovacieho švu do verejného rozhrania každého modulu; `vi.mock()` to rieši bez toho.
- **Suity sa neprepisovali.** Pôvodný tvar `t("popis", podmienka)` zostal a len registruje test do Vitestu cez `tests/helper.ts` — 2 200 riadkov ručne prepísaných tvrdení je 2 200 príležitostí na preklep, a v testoch sa preklep neprejaví zlyhaním, ale falošným pokojom. **Nové testy sa píšu idiomaticky** (`expect(skutočné).toBe(očakávané)`), aby bolo pri zlyhaní vidieť rozdiel hodnôt.
- **Nová suita `tests/onboardingDb.test.ts`** — 17 testov nad falošnou databázou: že `acknowledge()` si verziu určí na serveri a nedá sa podvrhnúť staršia; že duplicitný zápis skončí ako `uz-potvrdene` a nie ako chyba servera; že iná chyba sa za „už potvrdené" nezamaskuje; že znenie je v jazyku človeka a `documentLanguage` v jazyku smernice; a hlavne, že **chyba databázy v `personMaySignIn()` neotvorí prístup**.
- Stav: **16 súborov, 442 testov, 0,7 s** (predtým 15 súborov bundlovaných po jednom).


### Added (2026-08-27 — viacjazyčné prostredie, D35)
- **`app/src/lib/i18n.ts`** — jazyk prostredia (SK · CS · EN): zoznam podporovaných jazykov, znenie potvrdzovacej formulky a texty prihlasovacieho e-mailu per jazyk, deterministické formátovanie dátumu.
- **Rozhodnutie D35:** viacjazyčné je **len prostredie, nie obsah**. Dokument má základný jazyk, v ktorom je napísaný (`documents.language`); dokument v inom jazyku je **samostatný dokument, nie preklad**. Zoznam jazykov prostredia je preto oddelený od číselníka `language`, ktorý tagguje obsah.
- **`persons.language`** — jazyk prostredia osoby; prihlasovací e-mail sa posiela v ňom. Pri neznámej osobe alebo nedostupnej databáze platí slovenčina: zlý jazyk je nepríjemnosť, neodoslaný odkaz sú zavreté dvere. Opakovaný import bez stĺpca jazyka jazyk **neprepíše** — rovnaká pasca ako pri `status`.
- **`acknowledgements.language` + `documentLanguage`** — záznam ukladá aj to, v akom jazyku človek formulku videl, aj to, v akom jazyku je smernica. Bez toho sa pri audite nedá odpovedať, či český rozhodca potvrdzoval slovenský text.
- **Jazyk v `app/` sa berie z profilu osoby, bez prefixu v URL** (na rozdiel od marketingového webu). Dôvod je bezpečnostný — `middleware.ts` je definovaný ako „všetko okrem" a pridávať doň jazykový segment znamená hrabať sa v jedinom mieste, ktoré stojí medzi internými smernicami a internetom.
- Anglická formulka používa slovný mesiac (`1 September 2026`), aby v právnom texte nevznikla nejednoznačnosť medzi britským a americkým poradím čísel.
- Testy: 14 nových (formulka v troch jazykoch, formáty dátumu, normalizácia `sk-SK`/`cs_CZ`, fallback pri neznámom jazyku). 15 suít prechádza, `type-check` čistý.


### Fixed (2026-08-27 — ADR-001 stálo na neplatnom predpoklade)
- **ADR-001 dodatok 10:** `voyage-4-nano` **TEI nepodporuje** (otvorená issue #816 zo 6. 2. 2026, bez PR) — štítok `text-embeddings-inference` na karte modelu je v rozpore s issue v repozitári TEI. Otázka „ktorý server pre nano" bola 26. 7. **zatvorená práve s odvolaním sa na TEI**; je **znovu otvorená** ako O7-a. Príklad T3 profilu prepísaný z `kind: "tei"` na `kind: "infinity"` (vLLM/Infinity, OpenAI tvar) — v pôvodnom znení sa nedal postaviť. Poučenie: štítok na karte modelu nie je záväzok podpory.
- **Poistka proti tichému zhoršeniu hľadania** (`app/src/lib/providers/embedding/http.ts`): `HttpEmbeddingProvider.embed()` tvrdo zlyhá, kým nie je doplnené rozlíšenie dotaz/dokument a prompty modelu (O7 nález B). `voyage-4-nano` používa iné prompty pre dotaz a pre dokument; bez nich sa vektory posunú a meranie O1 na adaptér neplatí — **nespadne to, len horšie hľadá**. Nešlo o živú chybu (reťaz beží cez `atlas-auto`, `embed()` sa nikde nevolá), ale o pascu pre prvého, kto prepne tenanta na on-prem. Drôtový tvar volania zostal v `embedRaw()`, takže testy tvaru požiadavky a parsovania odpovede platia ďalej; 13 suít prechádza, `type-check` čistý.

### Decided (2026-08-27 — O7 sa odkladá za Fázu 8)
- **Fázy 1–5 z `docs/O7_plan_overenia.md` odložené.** Nie je to zmena názoru na O7 — zmenilo sa poradie: Fáza 8 (onboarding) **nevolá žiadny model**, takže spĺňa `eu-full` bez O7; **D34** zaraďuje on-prem na vetvu veľkých organizácií, ktorá nie je primárny produkt; **O12** rozhodlo zostať na Verceli, čím sa odložil celý smer odchodu zo zdieľanej infraštruktúry. Vrátiť sa, keď o on-prem požiada zákazník alebo tender.
- **Fáza 0 (prompty) zostáva ako práca na ~pol dňa** — poistka ju vynúti pred spustením fázy 1.

### Added (2026-08-27 — dopísané zo staršej práce)
- **`docs/O7_plan_overenia.md`** — plán overenia vlastného embeddingu a reranku (O7) z 2026-07-28, stav „návrh, čaká na schválenie". Vznikol v inej relácii a **nebol commitnutý**; obsahuje nálezy A–D (TEI neobslúži `voyage-4-nano`, chýbajúce prompty ako tichá chyba, O1 meraný na malých dátach, nano na MacBooku už bežalo), rozpočet pamäte na 16 GB, fázy 0–5, riziká R1–R5 a otvorené body O7-a…d.

### Changed (2026-08-27 — diagram architektúry: CMS, kurátor, hierarchia, portál)
- **Diagram prekreslený** (`web/public/contineo_diagram{,.cs,.en}.svg`, `docs/contineo_diagram.svg`, pregenerované `.png`): pribudol **CMS ako vrstva** obopínajúca vstupné kanály a worker, **kurátorská brána** („kanál smie len predvyplniť, publikuje človek" — D-CMS-6, D25), doplnené **kolekcie** v jadre (`documents (+ versions)`, `channels`, `channel_runs`, `navigation`, `categories`, `persons`, `acknowledgements`, `onboarding_tracks`), **hierarchia tenantov** (`companyCode.parent` — centrála → dcéry → prevádzky, s výslovnou poznámkou „hierarchia nedáva prístup") a **Portál (KB + onboarding)** medzi rozhraniami. Z jadra odstránená poznámka o Atlas EU / Community 8.2 — doslovne sa opakovala v päte.
- **Diagram sa už generuje** z jedného zdroja — `web/scripts/gen_diagram.py` (rozloženie + slovník SK/CS/EN). Predtým existovali štyri ručne udržiavané kópie a už sa rozišli: `docs/` verzia niesla `rerank-2.5`, webová `rerank-2`. Zjednotené na `rerank-2` (súlad s `rag-architecture.md` a `AKO_TO_BEZI.md`).
- **Opravené neexistujúce preklady** legendy spätných cyklov — položky `① qa_pair` a `② ticket` boli vo všetkých troch jazykových variantoch po slovensky.

### Decided (2026-08-27 — hierarchia tenantov a model dodávky)
- **D32:** **každý `companyCode` vidí len svoje záznamy a svoj obsah** — cudzie len vtedy, keď je menovite zdieľané cez `sharedWithCompanyCodes[]` (alebo je `accessLevel: public`). **`companyCode.parent` neudeľuje prístup** — hierarchia slúži na relevanciu a precedenciu noriem, nie na oprávnenie. Dôvod: chyba smerom „vidí viac" je tichá, chyba smerom „vidí menej" je hlučná.
  - *Opravené v ten istý deň:* prvé znenie tvrdilo, že `scope: global` sprístupní obsah celej skupine. To zamieňalo dve osi, pred ktorými `DATA_MODEL_konzistencia.md` výslovne varuje — `scope` hovorí, **na koho sa norma vzťahuje**; `accessLevel` + `companyCode`, **kto ju smie vidieť**. Poznámka o ortogonalite doplnená priamo do `DATA_MODEL_konzistencia.md`.
- **D33:** HR vidí potvrdenia **len svojho `companyCode`** — nie potomkov, nie nadradenú jednotku, nie sesterské. Ak má centrála vidieť potvrdenia dcéry, potrebuje explicitné oprávnenie, ktoré sa zaznamená.
- **D34:** primárne **SaaS na `contineo.app`** pre malé a stredné firmy; veľké organizácie dostanú **vlastné nasadenie tej istej platformy**, nie fork zdrojáku (fork = nedoručiteľné opravy a N nekompatibilných verzií).

### Added (2026-06-29 — blok Identita a prístup)
- **Nová sekcia „Identita a prístup"** na homepage (`web/components/Identity.js`, zaradená pred Bezpečnosť v `web/app/[lang]/page.js`, odkaz v `Nav.js`): SSO/jednotné prihlásenie (Entra ID, Google Workspace, OAuth/OIDC, vlastná DB), automatické zakladanie účtov z CRM/zdroja identity, multi-tenant prístup, bezpečnosť na úrovni dotazu (default-deny) + rad odznakov poskytovateľov identity. SK+EN (`dict.identity`).
- **Hlbší blok „Identita a riadenie prístupu" na `/technologia`** (`dict.tech.identity` SK+EN + render v `Tech.js`): tabuľka poskytovateľov (NextAuth → kanonická session), princípy (server-side, default-deny, filter pred LLM, auto-provisioning), dva režimy nasadenia. Vychádza z `docs/PRISTUPOVE_PRAVA.md`; sportnet.online uvedený len ako príklad.

### Changed (2026-06-29 — univerzálny pozicioning webu, Tier 4)
- **Web prepísaný na doménovo neutrálny jazyk** (`web/lib/dictionaries.js` SK+EN, `web/components/Tech.js`, `BotDemo.js`, `OverlayDemo.js`). Generická firma ako doména ukážok: číselník sekcií (`smernice`, `hr`, `ekonomicke`, `it_aplikacie`, `gdpr`), `companyCode` príklady `ACME`/`ACME-BA`, multi-tenant ako „centrála → regionálne → lokálne jednotky", FAQ demo na home office / dovolenku / reset hesla.
- **Futbal/SFZ presunutý do označeného Case study bloku** na `/technologia` (`tech.caseStudy` SK+EN + render v `Tech.js`) + úvodná poznámka `tech.exampleNote`, že príklady sú ilustračné a produkt je univerzálny.
- **sportnet.online** uvádzaný len ako *príklad* zdroja identity vo všeobecných formuláciách; detaily v Case study.
- Plán zmien: `docs/WEB_UNIVERZALNY_POZICIONING_PLAN.md`.

### Added (2026-06-29 — koncepcia CMS)
- **Návrhový dokument** `docs/CMS_KONCEPCIA.md` — CMS s tromi zodpovednosťami: (1) media manager pre RAG, (2) content engine pre verejný web (knowledge base / helpdesk), (3) správa vstupných kanálov. Rozlíšenie typov obsahu (`document` vs `web`) v jednej kolekcii `documents`; oddelenie `processingStatus` (workre) od `status` (publikácia); kanály ako spravované inštancie adaptérov (`channels`, `channel_runs`); roly v CMS; user flows; naviazanie na fázy.
- **Doménová univerzálnosť zdôraznená** — Contineo je univerzálna aplikácia; futbal/SFZ je len ukážka nasadenia do veľkej organizácie (zapracované do `CMS_KONCEPCIA.md`).

### Decided (2026-06-29 — rozhodnutia CMS D-CMS-1..6)
- **D-CMS-1:** web obsah žije v `documents` cez `contentType` (`document`|`web`), web-polia v `webPublish` — žiadna samostatná kolekcia.
- **D-CMS-2:** editor = Markdown + náhľad, s WYSIWYG vrstvou nad Markdownom (Markdown ostáva kanonické úložisko).
- **D-CMS-3:** helpdesk štartuje cez **web widget vložený do stránky**; e-mailový kanál je druhý krok na tej istej `tickets`/`channels` štruktúre. (E-mail je dnes hlavný kanál otázok, cieľom je presun na widget.)
- **D-CMS-4:** verejná KB = len kurátorské články + kanonický odkaz na normu (žiadne auto-generovanie z noriem).
- **D-CMS-5:** EN preklady = AI-návrh → kurátor potvrdí.
- **D-CMS-6:** žiadny auto-publish z kanála; predvyplnenie áno, finálny publish potvrdzuje človek.

### Added (2026-06-26 — centrálne číselníky + multi-zdrojová ingescia)
- **Centrálne číselníky (vzory/seed)** v `app/src/codelists/` — `sectionKey` (hierarchický), `companyCode`, `scope`, `accessLevel`, `language`, `category`, `sourceType`, `tags` + `README.md` a validačná `_schema.json`. Princíp: „closed vocabulary" pre povinné parametre — čo nie je v číselníku, sa do `document_chunks` nedostane.
- **Návrhový dokument** `docs/CISELNIKY_governance.md` — katalóg parametrov, úložisko (hybrid: kolekcia `codelists` + verzovaný seed), governance, validačná brána pri ingescii.
- **Návrhový dokument** `docs/INGESTION_zdroje_reconciliation.md` — source-adapter vrstva (PDF/MD, MCP, web link, API/DB), provenance model a reconciliation pri zmene číselníka (change-request + náhľad dopadu).

### Added (2026-06-26 — prístupové práva)
- **Návrh prístupových práv** `docs/PRISTUPOVE_PRAVA.md` (Fáza 5): ABAC + multitenant hierarchia (SFZ→regionálny→oblastný, `companyCode` = CompanyID). Verejný obsah nie je izolovaný; interný izolovaný per CompanyID s per-dokument zdieľaním (`sharedWithCompanyCodes`). Identita primárne zo **sportnet.online** (OAuth + MCP + CRM `api.sportnet.online/v1`); konverzná tabuľka `sportnet_role_map` (profil→skupina); re-sync login+webhook; CMS upload = ručný allowlist; enforcement vo filtri (default-deny, oba indexy); dva režimy nasadenia (anonymný widget vs. interný portál); relevancia rozpisov cez riadiaci zväz.
- **`sectionKey` uzamknutý na štruktúru Predpisov SFZ** (`app/src/codelists/sectionKey.json`): Stanovy · Poriadky · Štatúty a kódexy · Smernice · Rozpisy a manuály · Tlačivá/formuláre; `companyCode` vzor hierarchický (parent SFZ→regionálny→oblastný).
- **Marketingový web `/technologia`** (`web/lib/dictionaries.js` SK+EN) zladený s návrhom prístupu: identita zo **Sportnet.online** (OAuth + CRM, automatické zakladanie používateľov), prístup podľa príslušnosti k zväzu/klubu a skupín, SSO (sportnet.online/Entra/Google), multitenant hierarchia (verejné vidia všetci, interné per organizácia). Diagram (SVG + PNG) — identity ribbon `ISSF/Sportnet` → `Sportnet.online`.

### Added (2026-06-26 — backlog rozhodnutí)
- **`docs/OPEN_DECISIONS.md`** — 15 rozhodnutí (D1–D15) v 4 okruhoch (vyhľadávanie, doménová logika, identita, prevádzka/compliance) s prioritou, fázou a odporúčaním; navrhnuté poradie sprintov.

### Added (2026-06-26 — D5 a D10 rozpracované)
- **`docs/PRECEDENCIA_NORIEM.md`** (D5) — normatívna hierarchia SFZ (Stanovy>Poriadky>Smernice/Štatúty>Rozpis) + hierarchia zväzov; pravidlá R1–R4 (lex superior/specialis/posterior + hierarchia zväzov); aplikácia v RAG; zoznam na potvrdenie legislatívcom.
- **`docs/GDPR_DATA_PROTECTION.md`** (D10) — role (zväz=prevádzkovateľ, Contineo=sprostredkovateľ), kategórie dát, minimalizácia, návrh retenčných lehôt s odôvodnením, sub-procesori + EU rezidencia, práva dotknutých, audit, právne TODO (DPA/DPIA). *Nie právne poradenstvo — na posúdenie DPO/právnikom.*

### Decided (2026-06-26 — všetkých 15 rozhodnutí uzavretých)
- **Vyhľadávanie:** D1 chunking štruktúrne po hraniciach normy + breadcrumb (~300–800 tok.); D2 query→filtre LLM extrakcia + kontext používateľa; D3 citačná politika bez halucinácií; D4 ranking default 60/40, ladiť podľa eval setu.
- **Doménová logika:** D5 precedencia lex specialis v medziach SFZ (uviesť oba zdroje; potvrdiť s legislatívcom); D6 verzovanie `effectiveFrom/To`+`isActive`, default platná dnes.
- **Identita:** D7 sync login+webhook+cache; D8 onboarding — doménové číselníky zdieľané, zvyšok per tenant.
- **Prevádzka/compliance:** D9 zlatá sada + prah pred go-live; D10 minimalizovať PII + retencia + audit + DPA; D11 qa_pairs tagované + v reconciliation; D12 e-mail nikdy auto-odoslať; D13 crawl manuálne/on-demand; D14 widget s companyCode kontextom + rate-limit; D15 Ollama primárny + Claude fallback.

### Changed (2026-06-26)
- **Premenovanie `associationCode` → `companyCode`** (význam ostáva: pre koho obsah platí) a `scope` hodnota `association` → `company`. Aplikované **všade**: dokumenty (`CISELNIKY_governance.md`, `rag-architecture.md`, `DATA_MODEL_konzistencia.md`, projektový plán), verejná stránka `/technologia` (`web/components/Tech.js`, `web/lib/dictionaries.js` SK+EN) aj zdroj RAG (`app/src/lib/mongoSearch.ts`: `associationCodes`→`companyCodes`, `app/src/app/api/chat/README.md`). Systém ešte nie je nasadený — žiadna DB migrácia ani preindexovanie nie je potrebné. *Nahrádza skoršie pomenovanie `associationCode` v tomto Unreleased bloku.*
- **`sectionKey` je hierarchický** (parent → sekcia); **`sourceType` rozšírený** o `md`, `mcp`, `api`.
- **Diagram** (`contineo_diagram.svg` + pregenerované `contineo_diagram.png` v `web/public/` aj `docs/`) — popisok `associationCode` → `companyCode`.

### Decided (2026-06-26)
- Tagovanie pri ingescii = **per-dokument (LLM návrh → kurátor potvrdí)** pre každý zdroj.
- Sync pri zmene číselníka = **change-request + náhľad** (plný zoznam dotknutých dokumentov pred schválením); **rollback 1 level**; historické chunky sa **preznačkujú**.
- MCP import beží pod **servisným účtom**.

### Changed (Fáza 4 — zjednotenie dátového modelu na Model B)
- **Refaktor implementácie na kanonický Model B** (`app/src/`): kolekcie `rag_chunks`→`document_chunks`, `rag_documents`→`documents`; všetky polia v **camelCase** (`document_id`→`documentId`, `access_level`→`accessLevel`, `chunk_index`→`chunkIndex`, `source_url`→`sourceUrl`). `ChunkResult` rozšírený o doménové polia (`sectionKey`, `companyCode`, `scope`, `articleRef`, `heading`, `isActive`, `effectiveFrom/To`, `versionId`, `embeddingModel`).
- **Voliteľná doménová filtrácia** v `mongoSearch.ts` (`companyCodes`, `sectionKey`, `onlyActive`) — pripravená, aktivuje sa s identitou (ISSF); pri vynechaní sa správanie nemení.
- **Všetky identifikátory a enum hodnoty v angličtine** — `scope: global | company | region` (predtým `zvaz/oblast`), zladené v kóde aj na verejnej stránke `/technologia`.
- Atlas indexy (`chat/README.md`, `rag-architecture.md`) a doc schémy (`rag-architecture.md`, projektový plán) prepísané na nové názvy a polia. Index identifikátory (`rag_vector_index` atď.) ostávajú.

### Changed
- **Zjednodušený diagram architektúry** (`web/public/contineo_diagram.png`, `docs/contineo_diagram.png`) — z piatich vrstiev na tri + dva spätné cykly:
  vstupné kanály → worker (chunking + značkovanie) → MongoDB Atlas (jadro: embedding, hybrid search, rerank) → rozhrania;
  cykly: kurácia (kontrola kvality) a eskalácia na ticket. Pridaný editovateľný zdroj `contineo_diagram.svg`.
- **Zlúčenie „zdroje obsahu" + „integrácie"** do jednej vrstvy **„Vstupné kanály"** (pilier na stránke `/technologia`). ISSF/Sportnet je explicitne zdroj identity, nie obsahu; e-mail je obojsmerný kanál.
- **Premenovanie „Učiaci cyklus" → „Kontrola kvality a kurácia"** naprieč webom (pilier aj dátový tok na `/technologia`, krok „Podpora a kurácia" na úvodnej stránke). Dôvod: nejde o strojové učenie modelu, ale o ľudskú kuráciu obsahu — schválenie/oprava odpovede a jej uloženie ako `qa_pair`.
- `architectureCaption`: embedding, hybrid search a rerank sú popísané ako súčasť jadra MongoDB Atlas (Voyage Automated Embedding), nie ako samostatná vrstva.
- Zmeny aplikované v SK aj EN slovníku (`web/lib/dictionaries.js`).

### Decided
- **Kanonický dátový model = Model B** (z verejnej stránky `/technologia`): `document_chunks` · `qa_pairs` · `tickets` · `conversations` + doménové polia (`sectionKey`, `companyCode`, `scope`, `articleRef`) a verzovanie (`isActive`, `effectiveFrom/To`). Implementácia (Model A: `rag_chunks`/`access_level`) k nemu dorastie po fázach — `access_level` (viditeľnosť) a `scope`/`companyCode` (platnosť pre firmu/Zväz) bežia súbežne, sú ortogonálne.
- Zladené docs: `docs/DATA_MODEL_konzistencia.md` (rozhodnutie + mapovanie A→B + fázová migrácia), `docs/rag-architecture.md` a `docs/Contineo_RAG_Projektovy_plan.md` (poznámky o cieľovom modeli; migrácia zaradená do Fázy 4/4b/5). Živý kód `app/src/` a MongoDB sa NEmenia — len dokumentácia a plán.
