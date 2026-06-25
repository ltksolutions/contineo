# Changelog

Všetky podstatné zmeny projektu Contineo. Formát vychádza z [Keep a Changelog](https://keepachangelog.com/sk/).

## [Unreleased]

### Added (2026-06-26 — centrálne číselníky + multi-zdrojová ingescia)
- **Centrálne číselníky (vzory/seed)** v `app/src/codelists/` — `sectionKey` (hierarchický), `companyCode`, `scope`, `accessLevel`, `language`, `category`, `sourceType`, `tags` + `README.md` a validačná `_schema.json`. Princíp: „closed vocabulary" pre povinné parametre — čo nie je v číselníku, sa do `document_chunks` nedostane.
- **Návrhový dokument** `docs/CISELNIKY_governance.md` — katalóg parametrov, úložisko (hybrid: kolekcia `codelists` + verzovaný seed), governance, validačná brána pri ingescii.
- **Návrhový dokument** `docs/INGESTION_zdroje_reconciliation.md` — source-adapter vrstva (PDF/MD, MCP, web link, API/DB), provenance model a reconciliation pri zmene číselníka (change-request + náhľad dopadu).

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
