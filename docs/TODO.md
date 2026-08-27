# TODO — Contineo

> Pracovný zoznam krokov. Aktualizované 2026-08-27.

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

> **Priorita od 2026-08-27: sekcia I (Fáza 8 — onboarding).** Má termín a beží pred sekciami C–H. Zvyšok tohto zoznamu platí, len čaká.
>
> **Backlog rozhodnutí:** `docs/OPEN_DECISIONS.md` (15 rozhodnutí D1–D15 s prioritou a odporúčaním). **Sprint 1 = D1 chunking · D5 precedencia noriem · D2 query→filtre · D6 verzovanie.**

### A. Git (na Macu používateľa)
- [ ] Commitnúť + pushnúť dnešné zmeny (`app/src/`, docs, web, CHANGELOG, TODO)

### B. Rozhodnutia pred implementáciou → `docs/OPEN_DECISIONS.md`
- [x] **Všetkých 15 rozhodnutí (D1–D15) uzavretých** (2026-06-26)
- [x] D5 rozpracované → `docs/PRECEDENCIA_NORIEM.md`; D10 → `docs/GDPR_DATA_PROTECTION.md`
- [ ] **Externé potvrdenie D5:** konkrétne § o záväznosti rozpisu + rozsah delegácie (legislatívec SFZ)
- [ ] **Externé potvrdenie D10:** retenčné lehoty, DPA (zväz + Sportnet + sub-procesori), DPIA (právnik/DPO)

### C. Implementácia číselníkov (Fáza 4)
- [ ] Kolekcia `codelists` v MongoDB + unikátny index `{ codelist, key }`
- [ ] Idempotentný seed skript z `app/src/codelists/*.json` → `codelists` (nikdy nemaže, len `isActive:false`)
- [ ] Validačná brána pri ingescii — povinné tagy z `codelists`, BLOCK ak chýba/neaktívne (kap. 5.2 governance)
- [ ] Query-time konzistencia — filter v dotaze tiež z `codelists`

### D. Tagovanie + Review (Fáza 4)
- [ ] LLM klasifikátor proti číselníku (návrh hodnôt + confidence)
- [ ] Review UI — dropdowny z `codelists`, predvyplnené návrhom LLM, kurátor potvrdí

### D2. CMS — knižnica, web obsah, kanály (Fáza 4 / nová CMS-Web / 6) → `docs/CMS_KONCEPCIA.md`
- [ ] **Media manager:** knižnica nad `documents` (zoznam, filtre, detail, history) + `processingStatus` (uploaded→converting→chunking→embedding→indexed/failed) oddelený od `status`
- [ ] Rozšíriť `documents` o `contentType` (`document`|`web`) a `webPublish` (slug, seo, navParent, publishAt) — **D-CMS-1**
- [ ] **Web obsah (nová fáza CMS-Web):** KB články, FAQ, kategórie, navigácia, statické stránky; publikačný workflow + SSG/ISR generovanie; i18n SK/EN (AI preklad → review, **D-CMS-5**)
- [ ] Editor: Markdown + náhľad, neskôr WYSIWYG vrstva — **D-CMS-2**
- [ ] qa_pairs → publikovaný FAQ (zatváranie slučky); norma na webe len ako kanonický odkaz — **D-CMS-4**
- [ ] **Kanály:** kolekcie `channels` + `channel_runs`, admin CRUD, test `discover`, review fronta, monitoring behov; bez auto-publish (**D-CMS-6**)
- [ ] Helpdesk: štart **web widget** (`tickets`), e-mailový kanál ako druhý krok — **D-CMS-3**
- [ ] Preniesť D-CMS-1..6 do `OPEN_DECISIONS.md` (D16+) pri revízii backlogu

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

---

### I. Onboarding a potvrdzovanie noriem — **Fáza 8** 🔴 → `docs/ONBOARDING_KONCEPCIA.md`

> Zaradenie: `docs/ADR-003-onboarding-a-potvrdzovanie.md`. Prvé nasadenie: SFZ,
> `internal.futbalsfz.sk`, vyše 100 osôb vrátane ľudí bez licencie M365.
> Beží **pred** dokončením fáz 4 a 5 a berie si z nich minimálny výrez v cieľovom tvare.

**I0. Rozhodnutia, ktoré nečakajú na kód**

- [x] **D28 — znenie potvrdzovacej formulky** ✅ 2026-08-27: „Potvrdzujem, že som sa oboznámil s dokumentom „{názov}", verzia {label}, platná od {dátum}, porozumel som jeho obsahu a zaväzujem sa ho dodržiavať." Ukladá sa doslovne; prípadnú úpravu právnikom znesie bez migrácie.
- [ ] **D30 / O13 — čo je „podstatná zmena"** vyžadujúca opätovné potvrdenie (HR + legislatívec)
- [ ] **O14 — meriame čas nad dokumentom / doskrolovanie?** Rozhodnúť **pred** implementáciou, nie po nej.
- [ ] **O15, O16 — právny základ a retencia** `acknowledgements` (DPO, právnik) — rozširuje D10
- [ ] Zoznam dokumentov prvej vlny + kto je ich kurátor

**I1. Ultra-MVP `[1 týždeň]`** — cieľ: skutoční ľudia potvrdia skutočné smernice

- [ ] Kolekcia `persons` + indexy (`{companyCode,email}` unique, `{companyCode,tracks,status}`)
- [ ] Import z CSV: idempotentný, s **povinným náhľadom** pred zápisom
- [ ] Prihlásenie proti `persons`; `POVOLENE_EMAILY` ponechať ako núdzovú brzdu — **D26**
- [ ] `documents.versions[]` v cieľovom tvare — **D25** (verzovanie je povinnosť celého systému, nie potreba onboardingu: zmena `contentHash` z ľubovoľného kanála = nová verzia, nikdy prepis; platnosť určuje kurátor, nie automat)
- [ ] Zobrazenie dokumentu človeku (cez existujúci `securityFilter()`, žiadna druhá cesta k obsahu)
- [ ] Kolekcia `acknowledgements` + unikátny partial index — **D24**
- [ ] Potvrdzovacia obrazovka; **verziu berie server**, nie požiadavka klienta
- [ ] Skript `vykaz_potvrdeni.mjs` → CSV pre HR (bez neho je ultra-MVP nepoužiteľné)

**I2. Rozsah B `[2–3,5 týždňa]`**

- [ ] Kolekcia `onboarding_tracks`; progres sa **odvodzuje**, neukladá — **D27**
- [ ] Guided reading: poradie krokov, návrat na rozpracované
- [ ] HR dashboard: podľa dokumentu / osoby / trasy + export
- [ ] Hromadné pozvánky a pripomienky z UI
- [ ] Opätovné potvrdenie pri novej verzii — **D30**
- [ ] `tenantProfile.ts` podľa hostiteľa; neznámy hostiteľ = zakázaný — **D29**
- [ ] Vzhľad pre `internal.futbalsfz.sk` + DNS `CNAME internal → cname.vercel-dns.com` (Websupport)
- [ ] Osoba vidí a stiahne si **svoje** potvrdenia

**I3. Brána pred ostrou prevádzkou**

- [ ] **O12 — `0.0.0.0/0` v Atlase.** **Blokujúce** — onboarding prináša interné smernice aj osobné údaje naraz (`NASADENIE_app.md` kap. 2). Analýza: **ADR-003 kap. 6.1**.
  - [x] **Rozhodnuté 2026-08-27: Vercel Static IPs** (100 $/mes., plán Pro). Preverené aj Render, Railway, vlastný stroj v EÚ, SOCKS5 proxy — ADR-003 kap. 6.1. Presun z Vercelu zostáva dlhodobým smerom.
  - [ ] Zapnúť Static IPs pre projekt `contineo-app` (Settings → Networking) a zúžiť Atlas Network Access na tie dve IP
  - [ ] Súbežne (lacné, dáva zmysel aj za pevnou IP): samostatný produkčný Atlas projekt + cluster, DB používateľ s minimálnymi právami, audit log a upozornenia na neúspešné prihlásenia
- [ ] **D31 — Atlas M0 → M10+ pred prvým ostrým potvrdením.** M0 nemá zálohy; auditný záznam bez zálohy nie je auditný záznam (`ATLAS_SETUP.md` kap. 1).
  - [ ] Pri prechode zapnúť **auto-scaling úložiska aj tieru**, strop aspoň M30 (vyžaduje Automated Embedding)
  - [ ] Overiť, že vektorový a fulltextový index prešli a `smoke.mjs` beží
- [ ] Doplniť `acknowledgements` a `persons` do zálohovacej a retenčnej politiky

---

### J. O7 — vlastný embedding a rerank (on-prem vetva) 🟢 → `docs/O7_plan_overenia.md`

> **Odložené za Fázu 8** (rozhodnuté 2026-08-27). Fáza 8 nevolá žiadny model, takže spĺňa
> `eu-full` bez O7; D34 zaraďuje on-prem na vetvu veľkých organizácií, ktorá nie je primárny
> produkt; O12 rozhodlo zostať na Verceli. Vrátiť sa, keď o on-prem požiada zákazník alebo tender.

- [x] **Nález A do ADR-001** ✅ 2026-08-27 — TEI `voyage-4-nano` nepodporuje (issue #816); T3 príklad prepísaný na `kind: "infinity"`, otázka „ktorý server" **znovu otvorená** ako O7-a
- [x] **Nález B — poistka** ✅ 2026-08-27 — `HttpEmbeddingProvider.embed()` tvrdo zlyhá, drôtový tvar zostal v `embedRaw()`, testy prechádzajú
- [ ] **Fáza 0 dokončiť** (~pol dňa, len kód, žiadne inštalácie): rozlíšenie dotaz/dokument v `EmbeddingProvider`, prompty do konfigurácie adaptéra, test „ten istý text ako dotaz a ako dokument dá rôzne vektory", odovzdať typ z `mongoSearch.ts` a `import.mjs`. **Poistka padne až tu.**
- [ ] Fázy 1–5 — Infinity lokálne, Atlas Local, generovanie bez Anthropicu, TEI na HF, zopakovať O1 na reálnom korpuse. Vyžaduje Docker Desktop, Ollamu, `pip install infinity-emb`, HF účet; 1–2 dni.
