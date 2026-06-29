# Changelog

Všetky podstatné zmeny projektu Contineo. Formát vychádza z [Keep a Changelog](https://keepachangelog.com/sk/).

## [Unreleased]

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
