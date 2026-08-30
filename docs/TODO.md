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

## 🔜 Pracovný zoznam (sekcie A–J)

> **Priorita od 2026-08-27: sekcia I (Fáza 8 — onboarding).** Má termín a beží pred sekciami C–H. Zvyšok tohto zoznamu platí, len čaká.
>
> **Backlog rozhodnutí:** `docs/OPEN_DECISIONS.md` (15 rozhodnutí D1–D15 s prioritou a odporúčaním). **Sprint 1 = D1 chunking · D5 precedencia noriem · D2 query→filtre · D6 verzovanie.**

### A. Git (na Macu používateľa)
- [x] Commitnúť + pushnúť ✅ **2026-08-27 je repozitár čistý a zosynchronizovaný s `origin/main`** — žiadne neverzované ani nezapísané zmeny. (Pozn.: `docs/O7_plan_overenia.md` z 28. 7. sa dovtedy povaľoval necommitnutý; doplnený.)

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

### D2. CMS — knižnica, web obsah, kanály (Fáza 4 / nová CMS-Web / 6) → `docs/CMS_KONCEPCIA.md`, `docs/KNIZNICA_DOKUMENTOV.md`
- [x] **Media manager (D53, 2026-08-30):** `/kniznica` — zoznam, filtre, detail, história znení, nahratie docx/pdf/xlsx/md s prevodom do Markdownu, editor s originálom vedľa, publikovanie so `label` + `effectiveFrom` + citáciou zdroja. Rola `spravca-obsahu`
- [x] pôvodné súbory v GridFS, neverejná cesta; chunker a číselníky spoločné pre obrazovku aj skript
- [ ] náhľad Markdownu v editore (zatiaľ surový text)
- [ ] archivácia dokumentu z obrazovky — mazanie zámerne nie je (viažu sa potvrdenia)
- [ ] **KB / FAQ na verejnom webe** — samostatná fáza, `CMS_KONCEPCIA.md` časť B
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
> `intranet.futbalsfz.sk`, vyše 100 osôb vrátane ľudí bez licencie M365.
> Beží **pred** dokončením fáz 4 a 5 a berie si z nich minimálny výrez v cieľovom tvare.

**I0. Rozhodnutia, ktoré nečakajú na kód**

- [x] **D28 — znenie potvrdzovacej formulky** ✅ 2026-08-27: „Potvrdzujem, že som sa oboznámil s dokumentom „{názov}", verzia {label}, platná od {dátum}, porozumel som jeho obsahu a zaväzujem sa ho dodržiavať." Ukladá sa doslovne; prípadnú úpravu právnikom znesie bez migrácie.
- [ ] **D30 / O13 — čo je „podstatná zmena"** vyžadujúca opätovné potvrdenie (HR + legislatívec)
- [x] **O14 — meriame čas nad dokumentom** ✅ 2026-08-28 rozhodnuté: **áno, čas sa meria.** Ultra-MVP ho nemeral, takže ide o rozšírenie, nie o zmenu. Rozhodnutie so sebou nesie tri veci, ktoré treba vybaviť **pred** zapnutím merania, nie po ňom:
  - [ ] Právny základ a retencia pre údaj o správaní (O15, O16) — čas nad dokumentom je osobný údaj o tom, ako sa človek správal, nie súčasť vyhlásenia
  - [ ] Odpoveď na otázku, **čo sa stane s človekom, ktorý normu prečíta za 40 sekúnd**, lebo ju už pozná. Ak nič, meranie je záznam bez následku; ak niečo, je to nové pravidlo a patrí do smernice, nie do kódu
  - [ ] Implementácia: `acknowledgements.readingSeconds` (čas od otvorenia po potvrdenie, meraný na klientovi, teda **orientačný** — kto chce, nechá kartu otvorenú)
- [ ] **O15, O16 — právny základ a retencia** `acknowledgements` (DPO, právnik) — rozširuje D10
- [ ] Zoznam dokumentov prvej vlny + kto je ich kurátor

**I1. Ultra-MVP `[1 týždeň]`** — cieľ: skutoční ľudia potvrdia skutočné smernice

- [x] Kolekcia `persons` + indexy ✅ 2026-08-27 — `app/src/lib/persons.ts`, indexy v `app/scripts/onboarding_init.mjs` (pridaný aj `{email}` — prihlásenie hľadá bez znalosti tenanta)
- [x] Import z CSV ✅ 2026-08-27 — `app/scripts/import_persons.mjs`. **Náhľad je predvolené správanie, zápis sa musí vypýtať** (`--zapis`). Prijíma slovenské aj anglické hlavičky, zvláda BOM a bodkočiarku z Excelu. Pri chybnom riadku nezapíše nič — zápis po častiach by nechal databázu v polovičnom stave.
- [x] Prihlásenie proti `persons` ✅ 2026-08-27 — `auth.ts` skladá obe cesty; brzda ide prvá (nepotrebuje DB), chyba DB **neotvára** prístup — **D26**
- [x] `documents.versions[]` v cieľovom tvare ✅ 2026-08-27 — **D25**. `app/src/lib/documents.ts` (`effectiveVersion()` s pravidlami D6 + R3) a `scripts/import.mjs` (`recordVersion()` — nová položka, nikdy prepis; dopĺňa aj dokumentom naimportovaným pred zavedením `versions[]`)
  - [ ] **Známy rozpor s D25, pravidlo 2:** import publikuje priamo (`status: "published"`), hoci kanál nemá sám zneplatniť platnú verziu — platnosť má určiť kurátor. Zapisujeme stav taký, aký je, a nepredstierame schválenie. **Zosúladiť pri review UI (Fáza 4)**; dovtedy je to vedomý ústupok, nie prehliadnutie.
- [x] Zobrazenie dokumentu človeku ✅ 2026-08-27 — `loadDocumentFor(osoba, id)` uplatňuje D32; uhádnutím `documentId` sa nedá otvoriť obsah cudzej organizácie a neviditeľný dokument sa tvári ako neexistujúci
- [x] Kolekcia `acknowledgements` + unikátny partial index ✅ 2026-08-27 — **D24**. `app/src/lib/acknowledgements.ts`, index `potvrdenie_unique` v `scripts/onboarding_init.mjs` s `partialFilterExpression: { type: "acknowledgement" }`. Duplicitné potvrdenie nie je chyba aplikácie, ale konflikt 11000 z databázy — jediné miesto, kde sa to dá ustrážiť aj pri dvoch súbežných kliknutiach.
- [x] Potvrdzovacia obrazovka ✅ 2026-08-27 — `src/app/dokumenty/`, `src/components/AcknowledgeButton.tsx`, `src/app/api/acknowledgements/`. **Verziu určuje server** (`effectiveVersion()` nad `loadDocumentFor()`), klient ju neposiela — inak by si potvrdzujúci mohol vybrať, ktorú verziu „čítal".
- [x] Výkaz pre HR ✅ 2026-08-27 — `app/scripts/acknowledgement_report.mjs`. CSV: kto potvrdil, kedy, ktorú verziu, v akom jazyku — a kto nie. Rozsah je **jeden `companyCode`, nie strom** (D32, D33).
- [x] **Skripty importujú priamo moduly zo `src/`** ✅ 2026-08-27 — `scripts/lib/ts-hook.mjs`. Node 26 vie TypeScript spustiť, len nevie dohľadať bezpríponové importy; háčik to premostí. Bez neho by skripty potrebovali vlastnú kópiu pravidla, ktorá verzia dokumentu platí — a dve implementácie právneho pravidla sa raz rozídu.

**I1c. Prihlásenie naostro — čo je overené a čo nie**

- [x] **Prihlásenie na `intranet.futbalsfz.sk` funguje** ✅ 2026-08-28 — odkaz z e-mailu vedie na správnu doménu, relácia sa založí, `/dokumenty` sa otvorí.
- [x] ✅ **2026-08-28 18:17 — cesta cez `persons` je overená v produkcii.** Toto bol najdlhšie otvorený červený bod Fázy 8. Log hovorí `[auth] ziadost: … — persons povolil` aj `[auth] pouzitie-odkazu: … — persons povolil`; núdzová brzda sa nezúčastnila.
  - **Prečo to trvalo:** `jan.letko@futbalsfz.sk` bol v `POVOLENE_EMAILY`, ktorá sa vyhodnocuje **prvá**, takže sa kontrola cez `persons` roky nespustila a zvonku to vyzeralo, že všetko funguje. Brzda obsahuje odteraz samostatnú správcovskú adresu `intranet@futbalsfz.sk` — pravidlo je v `NASADENIE_app.md`.
  - **Pozor na `vercel env pull`:** vrátil `POVOLENE_EMAILY=""`, hoci premenná nastavená bola. Hodnota z pullu je **nespoľahlivá** — rozhoduje beh, nie výpis. Overovať runtime logom, nie premennou. (Raz ma to zviedlo k opačnému a nesprávnemu záveru.)
- [x] ✅ **2026-08-28 — evidencia prihlásenia sa zapisuje.** `npm run stav` po prvom prihlásení cez `persons`: `stav=active`, `posl. prihlásenie=2026-08-28T18:17:54.682Z` — teda v tej istej sekunde ako callback. `await recordSignIn(...)` sa tým overil naostro; predtým sa nezapisovalo nikdy, lebo brzda vracala `true` skôr, než sa k zápisu došlo.
- [x] ✅ **2026-08-28 — odkaz z e-mailu vedie na úvodnú stranu.** Callback `302` → `GET /` (predtým `→ /prihlasenie`). Widget „Nevybavené žiadosti" sa zobrazil na živých dátach.
- [ ] **Odkaz sa raz zavolal dvakrát sekundu po sebe** (2026-08-28 17:07), čím sa jednorazový token spotreboval a používateľ videl „odkaz už neplatí". Pri opakovanom pokuse sa to **nezopakovalo**, takže príčina nie je potvrdená a nič sa zatiaľ nemenilo. **Pred hromadným rozposlaním preveriť**, či poštové brány adresátov (najmä Microsoft 365 Safe Links) odkazy nepredberajú — tie to robia systematicky. Ak áno, riešenie je krátke okno na opätovné použitie tokenu (rozhodnuté 2026-08-28, čaká na potvrdenie príčiny).
- [ ] **Neznámy hostiteľ dostane najprv `307` na `/prihlasenie` a až potom `404`.** Middleware beží pred kontrolou tenanta a presmeruje neprihláseného skôr, než sa zistí, že doména nikomu nepatrí. Obsah neuniká a koniec je správne `404`, ale D29 hovorí, že cudzia doména sa nemá dozvedieť nič — a takto sa dozvie, že existuje cesta `/prihlasenie`. Opraviť sa to dá len overením tenanta priamo v middlewari; ten beží na edge a do Atlasu nevidí, takže by to chcelo verejný endpoint s krátkou pamäťou (rovnako to rieši `inventario`). Nízka priorita, ale zapísané, nech to nezapadne.
- [x] ~~Chybová stránka prihlásenia končí na `app.contineo.app`~~ — **vyriešené 2026-08-29 odstránením `NEXTAUTH_URL` z produkcie.** Nebolo to kozmetické: z tej istej premennej si NextAuth staval aj `redirect_uri` pre prihlásenie kontom, takže Entra odmietala prihlásenie s `AADSTS50011`. Bez premennej si origin odvodí z hostiteľa požiadavky.

**I1b. Viacjazyčné prostredie (D35)** — SK · CS · EN

- [x] `app/src/lib/i18n.ts` ✅ 2026-08-27 — zoznam jazykov prostredia (oddelený od číselníka `language`, ktorý tagguje obsah), formulka a e-mail per jazyk, deterministický dátum
- [x] `persons.language` + prihlasovací e-mail v jazyku osoby ✅ 2026-08-27
- [x] `acknowledgements.language` + `documentLanguage` ✅ 2026-08-27 — záznam unesie, že Čech potvrdzoval slovenský text
- [ ] Preklad **rozhrania** portálu (SK hotové, CS/EN po termíne — SFZ prvá vlna je len SK)
- [ ] **Otázka pre HR/právnika:** má formulka pomenovať jazyk dokumentu, keď sa líši od jazyka prostredia?

**I2. Rozsah B `[2–3,5 týždňa]`**

- [ ] Kolekcia `onboarding_tracks`; progres sa **odvodzuje**, neukladá — **D27**
- [ ] Guided reading: poradie krokov, návrat na rozpracované
- [ ] HR dashboard: podľa dokumentu / osoby / trasy + export
- [ ] Hromadné pozvánky a pripomienky z UI
- [ ] Opätovné potvrdenie pri novej verzii — **D30**
- [x] Tenant podľa hostiteľa; neznámy hostiteľ = zakázaný ✅ 2026-08-28 — **D29**. `app/src/lib/tenants.ts` (kolekcia `tenants`, cache kladných aj záporných výsledkov), `onboardingContext()` v `session.ts` skladá „tenant + osoba + patria k sebe" na jednom mieste — keby si to každá stránka robila sama, jedna z nich raz niektorú časť vynechá a vyzerá to ako fungujúca stránka. `scripts/tenant_set.mjs` + unikátny index `hostname_unique` (doména patrí najviac jednému tenantovi — databáza to drží aj vtedy, keď to skript prehliadne). 25 testov.
  - [ ] **Kontrola nie je v middleware**, ale v serverových komponentoch a route handleroch. Staršie plochy (`/`, `/sada`, `/api/chat`) sú chránené prihlásením, nie tenantom. Doplniť pri Fáze 5.
- [x] **DNS pre `intranet.futbalsfz.sk`** ✅ 2026-08-28 — `CNAME intranet → 75b9ff58792d32ba.vercel-dns-016.com` (Websupport), doména vo Verceli overená, v kolekcii `tenants` priradená tenantovi `SFZ`. **Nie `internal.futbalsfz.sk`** — tá je obsadená (`CNAME` na `sportnet.online`) a prepnutie by odstavilo to, čo tam beží.
- [ ] Vzhľad pre `intranet.futbalsfz.sk` — `tenants.branding` (logo, farba, kontakt) je pripravené, hodnoty chýbajú
- [ ] Osoba vidí a stiahne si **svoje** potvrdenia

**I3. Brána pred ostrou prevádzkou**

- [x] **Automatické nasadzovanie z GitHubu** ✅ 2026-08-28 — projekt `contineo-app` napojený na `ltksolutions/contineo`, root directory `app`, produkčná vetva `main`. Dovtedy napojený nebol: posledné nasadenie bolo staré 31 dní napriek desiatim commitom, takže `/dokumenty` na `app.contineo.app` neexistovalo. Postup a dôvod v `NASADENIE_app.md` kap. 0.

- [ ] **O12 — `0.0.0.0/0` v Atlase.** **Blokujúce** — onboarding prináša interné smernice aj osobné údaje naraz (`NASADENIE_app.md` kap. 2). Analýza: **ADR-003 kap. 6.1**.
  - [x] **Rozhodnuté 2026-08-27: Vercel Static IPs** (100 $/mes., plán Pro). Preverené aj Render, Railway, vlastný stroj v EÚ, SOCKS5 proxy — ADR-003 kap. 6.1. Presun z Vercelu zostáva dlhodobým smerom.
  - [ ] Zapnúť Static IPs pre projekt `contineo-app` (Settings → Networking) a zúžiť Atlas Network Access na tie dve IP
  - [ ] Súbežne (lacné, dáva zmysel aj za pevnou IP): samostatný produkčný Atlas projekt + cluster, DB používateľ s minimálnymi právami, audit log a upozornenia na neúspešné prihlásenia
- [x] **D31 — Atlas M0 → M10+** ✅ 2026-08-28: beží M10 (AWS Frankfurt) s Cloud Backup. M0 nemá zálohy; auditný záznam bez zálohy nie je auditný záznam (`ATLAS_SETUP.md` kap. 1).
  - [ ] Pri prechode zapnúť **auto-scaling úložiska aj tieru**, strop aspoň M30 (vyžaduje Automated Embedding)
  - [ ] Overiť, že vektorový a fulltextový index prešli a `smoke.mjs` beží
- [x] **Bezpečnostné aktualizácie závislostí** ✅ 2026-08-28 — Next 14.2.35 → **16.3.3**, next-auth → 4.24.15, `esbuild` odstránený z devDependencies. `npm audit`: **0 zraniteľností**. Migrácia bola menšia, než hrozila: next-auth 4.24.15 podporuje Next 16 a Next 16 akceptuje React 18, takže ani Auth.js v5, ani React 19. Zásah do kódu si vyžiadali len `params`/`searchParams`, ktoré sú od Next 15 prísľuby.
  <details><summary>pôvodný zápis</summary>
  - `next` 14.2.35 spadá do rozsahu vysoko závažného upozornenia (9.3.4-canary.0 – 16.3.0-preview.10)
  - `postcss` ≤ 8.5.22 — XSS cez neescapovaný `</style>` ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)), ťahá sa cez Next
  - `npm audit fix --force` by zdvihol Next o hlavnú verziu — **nerobiť pod termínom**; naplánovať ako samostatný krok s prebehnutím testov a buildu. Aplikácia, ktorá má držať osobné údaje, na tomto pri audite dostane otázku.
  </details>
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

---

### K. Testy — prechod na Vitest ✅ (2026-08-27)

- [x] `vitest` + `vitest.config.mts`; `npm test` = `vitest run`, pribudlo `test:watch` a `test:coverage`
- [x] Všetkých 15 pôvodných suít prevedených cez most `tests/helper.ts` — pôvodný tvar `t("popis", podmienka)` zostal, mení sa len to, kam sa výsledok hlási
- [x] `tests/onboardingDb.test.ts` — 17 testov nad falošnou databázou (`vi.mock`), vrátane toho, že **chyba DB neotvára prístup**
- [x] **`app/tests/run.mjs` zmazaný** ✅ 2026-08-28 — pôvodný beh testov nahradil Vitest a s odstránením `esbuildu` prestal byť spustiteľný.
- [ ] Postupne prepísať staré suity na idiomatické `expect()` — nie naraz, ale vždy, keď sa nejakej suity aj tak dotýkame

### M. Správa tenantov — **Fáza 5b** 🟡 → `docs/SPRAVA_TENANTOV.md`

> Zadanie 2026-08-28: obrazovka so správou tenantov. Správcovský účet
> `office@ltk.solutions`. Cieľ je plná správa vrátane zakladania; ide sa po
> častiach, aby bolo čo ukázať priebežne.

**Rozhodnutia**

- [x] **D41** — rola `platform-admin` v `persons`, výslovná výnimka z D32; vidí prehľad, nie obsah
- [x] **D42** — `/admin` beží len na doméne dodávateľa; kontroluje sa rola **aj** hostiteľ

**Rozsah A ✅ hotové 2026-08-28 — vidieť**

- [x] `platformContext()` — rola **a** hostiteľ, nie jedno z toho
- [x] `/admin` — zoznam tenantov: domény, osoby a koľko sa prihlásilo, trasy, dokumenty s platným znením, potvrdenia
- [x] `/admin/tenanti/[kod]` — detail vrátane menovitého zoznamu dokumentov bez platného znenia
- [x] mobile first; 10 testov na bránu

**Rozsah B ✅ hotové 2026-08-28 — meniť, čo je bezpečné**

- [x] názov, skratka, logo, farba, kontakt, jazyky, domény
- [x] **pravidlá presunuté do `lib/tenantAdmin.ts`** — kontrola vlastníctva domén, normalizácia aj zápis existujú raz. `tenant_set.mjs` ich odteraz volá; predtým mal vlastnú kópiu
- [x] zápis `updatedBy` a `updatedAt`
- [x] vypnutie si vyžiada napísanie kódu organizácie — nie „naozaj?", to sa odklikne skôr, než sa prečíta
- [x] nevyplnené pole sa **nemení, nemaže** — inak by uloženie názvu zmazalo logo (test)
- [x] odobratie poslednej domény sa odmietne — portál by sa nikde neukázal (test)

**Rozsah C ✅ hotové 2026-08-28 — zakladať**

- [x] nová organizácia z obrazovky vrátane domén
- [x] Vercel API zo servera (`lib/vercel.ts`), doména sa priradí projektu sama
- [x] odoslanie pokynov zákazníkovi tlačidlom; zaznamená sa `domainSetup`
- [ ] **zostáva: `VERCEL_TOKEN` medzi premennými nasadenia.** Bez neho obrazovka doménu do Vercelu nepridá a povie to; všetko ostatné funguje. Token z `vercel login` na to nestačí — CLI si ho priebežne obnovuje, takže prevzatá hodnota po čase prestane platiť (overené 2026-08-28).

### L. Udalosti a upozornenia — **Fáza 9** 🟡 → `docs/UDALOSTI_A_UPOZORNENIA_KONCEPCIA.md`

> **Stav: rozsah A schválený 2026-08-28 (D40 = a) — implementácia sa môže začať.**
> Zadanie 2026-08-28: widget „Nevybavené žiadosti" na úvodnej strane + interný
> systém upozornení.

**Rozhodnutia pred implementáciou**

- [x] **D36** — widget je osobná schránka („čo čaká na mňa"), nie prehľad organizácie
- [ ] **D37** — úloha sa odvodzuje, pridelenie sa zaznamenáva ako udalosť `assignments`
- [ ] **D38** — `persons.groups` ako tretia dimenzia vedľa `tracks` a `department`
- [x] **D39** — „nové" sa počíta voči `lastLoginAt`, bez stavu prečítané
- [x] **D40** ✅ 2026-08-28 — **(a)**: rozsah A jednorazové hlásenia nemá, widget ukazuje len úlohy

**Rozsah A ✅ hotové 2026-08-28 — widget má čo ukazovať**

- [x] register zdrojov + tvar `PendingItem` (`source`, `id`, `title`, `href`, `detail`, `sortAt`) — `app/src/lib/pending.ts`
- [x] zdroj „nepotvrdené normy" nad existujúcim `trackProgress()` — bez druhej kópie stavu (D27)
- [x] widget na úvodnej strane nad hľadaním, **mobile first** — `app/src/components/NevybaveneZiadosti.tsx`
- [x] zablokovaný krok sa nedá medzi úlohy, ale spočíta sa a povie sa o ňom vetou
- [x] testy (13): zdvojenie z dvoch trás, zablokované, poradie, výpadok zdroja, prázdny stav
- [x] **dokončené v rozsahu B:** „odkedy to čaká" a príznak „nové" — oboje z `assignments.assignedAt`

**Rozsah B ✅ hotové 2026-08-29 — prideľovanie prestalo byť tiché**

- [x] kolekcia `assignments` + tri indexy (`podla_znenia`, `podla_publika`, `podla_casu`)
- [x] `persons.groups: string[]` (D38) — zoznam skupín sa **odvodzuje z ľudí**, číselník sa nezakladá
- [x] `matchesAudience()` je **jediné** miesto s pravidlom príslušnosti; aj počítanie „koľkých sa to týka" ide cezeň, hoci by sa dalo napísať ako dotaz — dotaz by bol druhá kópia
- [x] `/hr` a `/hr/pridelit` — prehľad a formulár s povinným dôvodom, serverové formuláre, mobile first
- [x] `/hr/[id]` — **menovitý** zoznam, kto ešte nepotvrdil. Číslo „chýba 17" sa dá pozerať mesiace; mená sú to, na základe čoho niekto zdvihne telefón
- [x] rola `hr` + `hrContext()` — rola **a** príslušnosť k organizácii; `platform-admin` sem nemá prístup (D41 mu dáva počty, nie mená)
- [x] `persons.previousLoginAt` — bez neho by „nové" znamenalo „pribudlo počas tejto relácie", teda spravidla nič
- [x] pridelené znenie, ktoré už neplatí, sa nedá potvrdiť → počíta sa medzi zablokované, nie medzi úlohy
- [x] **uzatvára D30 a O13** — definícia „podstatnej zmeny" sa ruší, nahradil ju povinný `reason`
- [x] 32 nových testov (spolu 579)

**Rozsah B — dokončenie 2026-08-29**

- [x] **e-mail „pridelili sme ti…"** — posiela sa **tlačidlom, nie ako vedľajší účinok pridelenia**. Prideliť sa dá odvolať, odoslaný e-mail nie; preto najprv náhľad (komu presne a s akým textom) a až potom tlačidlo. Rovnaký vzor ako pokyny k doménam.
- [x] posiela sa **len tým, kto ešte nepotvrdil** — pripomienka niečoho, čo človek už spravil, je presne ten druh pošty, po ktorom si zapne filter
- [x] `assignments.notified[]` — pole, nie jedna hodnota: je rozdiel medzi „poslali sme raz pred pol rokom" a „posielame štvrtý týždeň po sebe". Zapisuje sa **po** odoslaní a s počtom, ktorý naozaj odišiel
- [x] e-mail nesie **dôvod** a v jazyku príjemcu; z obsahu normy len názov — do schránky mimo našej správy nepatrí obsah interného predpisu
- [x] strop 150 naraz; nad ním sa **odmietne a povie prečo**, namiesto toho, aby rozposlal náhodnú polovicu a spadol
- [x] **hromadné pridelenie N noriem × M publík** s jedným spoločným dôvodom. Zaškrtávacie políčka, nie `select multiple` — ten sa na telefóne ovláda mizerne
- [x] „všetkým v organizácii" prebije zvyšok výberu, inak by to isté znenie viselo v prehľade niekoľkokrát
- [x] `audienceFromSelection()` je v `lib/`, nie v serverovej akcii — je to pravidlo a pravidlá sa dajú otestovať (16 nových testov, spolu 595)

**Prihlásenie pracovným kontom a správa osôb ✅ hotové 2026-08-29**

> Koncepcia a rozhodnutia D43–D46: `docs/PRIHLASENIE_A_SPRAVA_OSOB.md`

- [x] Microsoft (Entra ID) a Google vedľa odkazu v e-maile, nie namiesto neho
- [x] **aplikácia patrí zákazníkovi** (D43) — sám odvolá prístup, sám vidí, kto sa prihlasoval
- [x] tajomstvá šifrované AES-256-GCM, von sa nevracajú nikdy
- [x] poskytovatelia sa skladajú **podľa hostiteľa** (D44), nie pri štarte
- [x] **konto overuje adresu, vstup povoľuje `persons`** (D45) — `tid` z povoleného Entra tenanta, `email_verified` u Googlu
- [x] rola `people-admin` a obrazovky `/osoby` (D46), import CSV s náhľadom
- [x] čítanie CSV a mapovanie hlavičiek presunuté do `lib/` — skript aj obrazovka volajú to isté
- [ ] **zostáva: `OAUTH_SECRET_ENCRYPTION_KEY` medzi premennými nasadenia** (`openssl rand -hex 32`). Bez neho sa tajomstvo nedá uložiť; obrazovka to povie a všetko ostatné funguje.
- [x] údaje Entra aplikácie SFZ zadané a overené (2026-08-29)
- [x] **`AADSTS50011` pri prihlásení kontom** — `NEXTAUTH_URL` je jedna adresa na celé nasadenie a NextAuth z nej staval `redirect_uri`. V produkcii odstránená; origin sa odvodzuje z hostiteľa požiadavky. Zapísané v `NASADENIE_app.md`, lebo chýbajúca premenná vyzerá ako chyba
- [x] **`/organizacia`** — zákazník si sám spravuje vzhľad, prihlasovanie aj domény (D48). Domény cez žiadosť + dôkaz DNS, nie voľným zápisom
- [x] **automatické založenie z povolených domén** (D47)
- [x] **adresa prestala byť kľúčom** — identitou je `persons.id`, adresa sa dá zmeniť a história zostáva celá
- [x] **útvary ako strom** (D49) — osoba v práve jednom, pridelenie platí aj pre podstrom, skupiny zostávajú samostatnou dimenziou. Prevod z textu: `npm run utvary`
- [x] **prevod útvarov SFZ spustený 2026-08-29** — nemal čo previesť: v databáze je zatiaľ jedna osoba a žiadna nemá útvar zapísaný textom. Zmysel dostane po importe ľudí z CSV
- [x] **reorganizácia** (D50) — úloha z útvaru platí odo dňa príchodu, bývalí členovia zostanú v prehľade označení a bez e-mailu, potvrdenie nesie odtlačok útvaru
- [x] **údaje z adresára** (D52) — meno, priezvisko, útvar, pozícia, jazyk a fotka z Microsoft Graphu; dopĺňa sa len chýbajúce, zlyhanie Graphu prihlásenie nezhodí
- [ ] **overiť `User.Read` v Entra aplikácii SFZ** — bez neho Graph vráti 403 (v logu je menovitá hláška) a prihlásenie funguje ďalej, len bez mena, útvaru a fotky
- [x] **audit správcovských zmien** (D51) — vlastná kolekcia, nemenná, rozdiel namiesto celého objektu, tajomstvá len ako „zmenené"; vidí ho `people-admin` a správca platformy
- [x] **skupiny majú históriu členstva** — pôvodné rozhodnutie nechať ich bez nej neobstálo
- [x] **indexy auditu a histórie skupín vytvorené 2026-08-29** — `node scripts/onboarding_init.mjs`
- [ ] **retencia auditu nie je určená** — otvorené v O16 spolu s retenciou potvrdení
- [ ] **prihlásenia sa nezapisujú** — zámerne; záznam každého prihlásenia patrí najprv do GDPR dokumentácie (súvisí s O14)
- [x] **indexy vytvorené v Atlase 2026-08-29** — `node scripts/onboarding_init.mjs` (stav bez zápisu: `--stav`). Pribudla kolekcia `departments` s dvomi indexmi a dva indexy nad `persons`

**Zostáva (mimo rozsahu B)**

- [ ] pripomienky podľa času („nepotvrdené po 14 dňoch") — potrebujú naplánovanú úlohu, tú zatiaľ nemáme
- [ ] **Revízny poriadok má zástupný dátum účinnosti.** Text hovorí „dňom schválenia VV SFZ" a dátum schválenia v ňom nie je; treba ho z uznesenia
- [ ] **označenie znenia „1.0" je vymyslené číslo** a objaví sa v potvrdzovacej formulke

**Rozsah C — až keď existujú ďalšie zdroje**

- [ ] kurácia (dokumenty čakajúce na kurátora, otvorený rozpor s D25)
- [ ] helpdesk (Fáza 4b)
- [ ] prípadné jednorazové hlásenia podľa D40
