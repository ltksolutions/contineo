# TODO — Contineo

> Pracovný zoznam krokov. Aktualizované 2026-06-26.

## ✅ Hotové (2026-06-26)

- Návrh centrálnych číselníkov + governance → `docs/CISELNIKY_governance.md`
- Vzory číselníkov (seed) → `app/src/codelists/*.json` (+ README, `_schema.json`, validované)
- Návrh multi-zdrojovej ingescie + reconciliation → `docs/INGESTION_zdroje_reconciliation.md`
- Premenovanie `associationCode → companyCode` (`scope: association → company`) v **dokumentoch**, na **marketingovom webe** (`/technologia`: `Tech.js`, `dictionaries.js` SK+EN, oba `contineo_diagram.svg` + pregenerované `.png`) aj v **zdroji RAG** (`app/src/lib/mongoSearch.ts`, `app/src/app/api/chat/README.md`)
- **Návrh prístupových práv** (ABAC + multitenant) → `docs/PRISTUPOVE_PRAVA.md` — koncepčne **uzavretý**: identita zo Sportnet.online (OAuth + CRM, auto-zakladanie používateľov), `sportnet_role_map`, public vs internal, hierarchia SFZ→regionálny→oblastný, default-deny filter, 2 režimy nasadenia, relevancia cez riadiaci zväz
- `sectionKey` uzamknutý podľa legislatívy SFZ; `companyCode` hierarchický
- **Marketingový web `/technologia`** zladený s prístupom/identitou (SK+EN) + diagram (identity ribbon → Sportnet.online, pregenerované PNG)
- CHANGELOG aktualizovaný

> **Pozn.:** systém ešte nie je nasadený (žiadna Atlas DB, indexy ani dáta) — preto žiadna „migrácia", preindexovanie ani preznačkovanie historických chunkov nie je potrebné. Premenovanie je kompletné naprieč repom.

## 🔜 Zajtra pokračujeme

> **Backlog rozhodnutí:** `docs/OPEN_DECISIONS.md` (15 rozhodnutí D1–D15 s prioritou a odporúčaním). **Sprint 1 = D1 chunking · D5 precedencia noriem · D2 query→filtre · D6 verzovanie.**

### A. Git (na Macu používateľa)
- [ ] Commitnúť + pushnúť dnešné zmeny (`app/src/`, docs, web, CHANGELOG, TODO)

### B. Rozhodnutia pred implementáciou → `docs/OPEN_DECISIONS.md`
- [ ] **Sprint 1 (základy):** D1 chunking stratégia · D5 precedencia/konflikt noriem · D2 query→filtre · D6 verzovanie a platnosť
- [ ] Sprint 2: D3 odpovedacia politika · D9 eval set · D10 GDPR baseline
- [ ] Sprint 3 (po CRM): D7 sync · D8 onboarding · D11 helpdesk/qa_pairs · D12 email politika

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
- [x] **`sectionKey` top-level z legislatívy SFZ** uzamknuté vo vzore (Stanovy · Poriadky · Štatúty a kódexy · Smernice · Rozpisy a manuály · Tlačivá/formuláre); zostáva doplniť listy z korpusu
- [ ] **Relevancia cez riadiaci zväz** — väzba súťaž→companyCode z CRM; pri dotaze („4. liga ZsFZ") uprednostniť rozpis riadiaceho zväzu + globálne poriadky SFZ (ladenie Fáza 4/5)
- [ ] `companyCode` plný zoznam (4 regionálne + ~40-48 oblastných) zo sportnet.online CRM

### H. Prístupové práva — ABAC + multitenant (Fáza 5) → `docs/PRISTUPOVE_PRAVA.md`
- [ ] NextAuth providers: **sportnet.online OAuth** (primárny), Entra ID, Google Workspace, vlastná DB → kanonická session (ISSF sa neintegruje)
- [ ] **mcp.sportnet.online** (vo vývoji) + **api.sportnet.online/v1** (CRM Company & People, `…/v1/docs/`) — zmapovať polia na `companyCode`, `person_memberships`, `sportnet_role_map`; cache + re-sync **login + webhook**
- [ ] `cms_uploaders` allowlist — ručné povolenie, kto smie nahrávať obsah (práva v CMS sa neodvodzujú z rolí sportnet)
- [ ] `securityFilter()` v `mongoSearch.ts` — public (bez izolácie) + internal (per CompanyID, `sharedWithCompanyCodes`, content-skupiny), do `$vectorSearch` aj `$search`, default-deny
- [ ] Schéma: `accessGroups[]` + `sharedWithCompanyCodes[]` na `document_chunks`/`documents` + tagovanie pri importe
- [ ] `companyCode.parent` — viacúrovňová hierarchia SFZ→regionálny→oblastný (plný zoznam zo sportnet.online)
- [ ] Kolekcie `tenant_groups` (členské + content-skupiny) + `identity_group_map` + admin UI (ručné content-skupiny)
- [ ] Dva režimy nasadenia: verejný anonymný widget (len `public`) vs. interný portál zväzu (SSO, public+internal)
- [ ] Doplniť `accessGroups`, `sharedWithCompanyCodes` do Atlas indexov
- [ ] **Potvrdiť otvorené otázky** v `PRISTUPOVE_PRAVA.md` (roly nad skupinami, sportnet.online claims, re-sync, relevancia rozpisov, rozsah widgetu, legislatíva→sectionKey)
