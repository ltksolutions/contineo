# TODO — Contineo

> Pracovný zoznam krokov. Aktualizované 2026-06-26.

## ✅ Hotové (2026-06-26)

- Návrh centrálnych číselníkov + governance → `docs/CISELNIKY_governance.md`
- Vzory číselníkov (seed) → `app/src/codelists/*.json` (+ README, `_schema.json`, validované)
- Návrh multi-zdrojovej ingescie + reconciliation → `docs/INGESTION_zdroje_reconciliation.md`
- Premenovanie `associationCode → companyCode` (`scope: association → company`) v **dokumentoch** a na **marketingovom webe** (`/technologia`: `Tech.js`, `dictionaries.js` SK+EN, oba `contineo_diagram.svg` + pregenerované `.png`)
- CHANGELOG aktualizovaný

## 🔜 Zajtra pokračujeme

### A. Git (na Macu používateľa)
- [ ] Commitnúť + pushnúť dnešné zmeny (docs, `app/src/codelists/`, web `/technologia`, diagramy, CHANGELOG)
- [ ] Skontrolovať deploy `/technologia` na contineo.app — overiť, že diagram zobrazuje `companyCode`

### B. Dokončiť premenovanie v živom kóde (migrácia, Fáza 4)
- [ ] `app/src/lib/mongoSearch.ts` — `associationCode`/`associationCodes` → `companyCode`, `scope` hodnota
- [ ] `app/src/app/api/chat/README.md` — názvy polí
- [ ] Atlas: `rag_vector_index` (filter path) + `rag_text_index` (token path) `associationCode` → `companyCode` + **preindexovať**
- [ ] Schéma `document_chunks` — premenovať pole
- [ ] **Preznačkovať historické chunky** (rozhodnuté) — dávková úloha s logom a rollbackom

### C. Implementácia číselníkov (Fáza 4)
- [ ] Kolekcia `codelists` v MongoDB + unikátny index `{ codelist, key }`
- [ ] Idempotentný seed skript z `app/src/codelists/*.json` → `codelists` (nikdy nemaže, len `isActive:false`)
- [ ] Validačná brána pri ingescii — povinné tagy z `codelists`, BLOCK ak chýba/neaktívne (kap. 5.2 governance)
- [ ] Query-time konzistencia — filter v dotaze tiež z `codelists`

### D. Tagovanie + Review (Fáza 4)
- [ ] LLM klasifikátor proti číselníku (návrh hodnôt + confidence)
- [ ] Review UI — dropdowny z `codelists`, predvyplnené návrhom LLM, kurátor potvrdí

### E. Source-adaptéry + provenance (Fáza 4/6)
- [ ] Rozhranie `SourceAdapter` + refaktor existujúceho file (PDF/MD) adaptéra
- [ ] Provenance polia v `documents` (`source.{type,connector,externalId,url,fetchedAt,contentHash,adapterVersion}`)
- [ ] Adaptér: web link (jednorazové URL → MD)
- [ ] Adaptéry: MCP / API (poradie zatiaľ neurčené — odložené)

### F. Reconciliation (Fáza 4b)
- [ ] Kolekcia `codelist_change_requests` + preview (plný zoznam dotknutých dokumentov)
- [ ] Execute (`updateMany`, bez re-embed) + snapshot (rollback 1 level) + audit log
- [ ] Health check osirených chunkov (tag mimo aktívneho číselníka)

### G. Obsah číselníkov (priebežne)
- [ ] Doplniť plné sady `sectionKey`, `companyCode`, `category` z reálneho korpusu noriem (dnes len kostra)
