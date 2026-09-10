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
- [x] **WYSIWYG editor** (D54) — prepínač Markdown / vizuálny režim, uložený tvar zostáva Markdown
- [x] **virtuálne priečinky + filtre** (D56) — strom, dokument v práve jednom, filter vrátane podpriečinkov
- [x] **vlastné číselníky organizácie** (D55) — druhy dokumentov a značky v `/organizacia`
- [x] **oprava: editor sa pri normách z importu otváral prázdny** — text je len vo `versions[]`
- [x] **identita textu oddelená od identity členenia** (D57) — `versionId` z textu, `chunkingId` z členenia; preindexovanie nevytvára verziu a neruší potvrdenia. Migrácia deviatich noriem spustená 2026-08-30
- [x] **profil členenia per organizácia** (D58) — slovo článku a prílohy, prah hlavičiek, veľkosť úseku; predvolený profil overený na 10 dokumentoch (10 zhôd, 0 rozdielov)
- [x] **oprava údajov znenia** — pri zmene dátumu s existujúcimi potvrdeniami rozhodnutie človeka + povinný dôvod
- [x] **`npm run check`** (D59) — invarianty medzi dokumentmi, úsekmi a potvrdeniami
- [ ] **`sfz:test_onboarding` nemá aktívne úseky** — seedovací skript zapisuje dokument, nie chunky. Pri testovacom dokumente to nevadí, ale kontrola to bude hlásiť
- [x] **poradie oddelení** (D60) — ťahanie myšou v rámci úrovne, šípky ako bezJS cesta, čiary hierarchie
- [x] **poradie aj pre priečinky knižnice** (D60) — ten istý komponent ako pri oddeleniach
- [x] **`components/TreeWithOrder.tsx`** — premenované z `StromOddeleni.tsx` cez `StromSPoradim.tsx`, komponent slúži obom stromom
- [x] **presun dokumentu do priečinka hromadne** ✅ hotové v 4e — `moveManyAction` v `app/src/app/library/actions.ts` (cyklus nad `assignDocument`, audit zostáva, dávka môže skončiť čiastočne a vypíše, čo neprešlo). Zápis „zatiaľ po jednom v detaile" bol zastaraný.
- [x] **hromadné preindexovanie** — v záložke Členenie, po dávkach 25, s počtom neaktuálnych dokumentov
- [x] **pôvodné PDF doplnené k deviatim normám** — `npm run files:attach` (2026-08-30)
- [ ] archivácia dokumentu z obrazovky — mazanie zámerne nie je (viažu sa potvrdenia)
- [ ] **KB / FAQ na verejnom webe** — samostatná fáza, `CMS_KONCEPCIA.md` časť B
- [ ] Rozšíriť `documents` o `contentType` (`document`|`web`) a `webPublish` (slug, seo, navParent, publishAt) — **D-CMS-1**
- [ ] **Web obsah (nová fáza CMS-Web):** KB články, FAQ, kategórie, navigácia, statické stránky; publikačný workflow + SSG/ISR generovanie; i18n SK/EN (AI preklad → review, **D-CMS-5**)
- [ ] Editor: Markdown + náhľad, neskôr WYSIWYG vrstva — **D-CMS-2**
- [ ] qa_pairs → publikovaný FAQ (zatváranie slučky); norma na webe len ako kanonický odkaz — **D-CMS-4**
- [ ] **Kanály:** kolekcie `channels` + `channel_runs`, admin CRUD, test `discover`, review fronta, monitoring behov; bez auto-publish (**D-CMS-6**)
- [ ] Helpdesk: štart **web widget** (`tickets`), e-mailový kanál ako druhý krok — **D-CMS-3**
- [ ] Preniesť D-CMS-1..6 do `OPEN_DECISIONS.md` (D16+) pri revízii backlogu

#### Intranet — dizajnový handoff (`design_handoff_contineo_intranet`, od 2026-09-07)

> Návrh aplikačného shellu, knižnice s inteligentnými zoznamami a nastavení. Balík je **dizajnová referencia, nie kód na skopírovanie**. Shell je **opt-in** — `layout.tsx` sa nemení a stránky sa doň presúvajú po jednej.

- [x] **1. Tokeny** — `--accent-soft` a šestica premenných hustoty v `globals.css`, `soft()` v `TenantHeader.tsx`
- [x] **3. `MultiSelect`** — viacnásobný výber s hľadaním bez diakritiky, `<noscript>` cesta, prepínač `emit` (`csv` pre formuláre, `repeat` pre adresu)
- [x] **2. `AppShell` + `AppNav`** — varianty `sidebar`/`topbar`, `lib/shellRoutes.ts`, `Header` skrýva menu na shell routach; v shelli je zatiaľ len `/library`
- [x] **4a. Faceted filtre** — viachodnotové facety v adrese, počty bez vlastného filtra (`libraryFacets`), chips, `MultiSelect` na značky
- [x] **4b. Kompaktná tabuľka** — triedenie v adrese (`localeCompare` po slovensky), stránkovanie, pätička s počtami
- [x] **4c. Kartový pohľad** + prepínač `?view=`
- [x] **4d. Query builder** — podmienky v adrese, bez JavaScriptu, monospace náhľad dotazu. Pole a operátor sú jeden výber, takže nezmyselná dvojica sa nedá zostaviť
- [x] **Zátvorky v query builderi** ✅ 2026-09-08 — nie znaky, ale **skupiny**: vnútri skupiny platí „a", medzi skupinami „alebo", teda `(A a B) alebo (C a D)`. Do disjunktnej normálnej formy sa dá previesť každý booleovský výraz, takže sa nič nestráca, a rozhranie zostáva dvojúrovňové — teda ovládateľné **bez JavaScriptu**, na čom knižnica stojí. Strom ľubovoľnej hĺbky by si vyžiadal klientsky stav.
      Skupina je predpona v adrese (`g0~pole~op~hodnota`), nie štvrtá časť: hodnota môže obsahovať vlnovku a čokoľvek za ňou by sa od nej nedalo odlíšiť.
      **Staré odkazy fungujú ďalej.** Podmienka bez skupiny sa vykladá podľa `match`: `all` = jedna skupina so všetkým, `any` = každá podmienka sama. Sú to presne tie dva krajné prípady, ktoré builder mal predtým. `match` sa už do adresy nezapisuje — skupinu nesie samotná podmienka a dva zdroje tej istej pravdy by si raz odporovali.
- [x] **4e. Hromadné akcie** — hromadný presun do priečinka (cyklus nad `assignDocument`, audit zostáva) a odovzdanie výberu na `/hr/assign`, ktoré prideľovanie už vie. **Prideľovanie sa nepísalo druhýkrát.** Výber platí pre viditeľnú stranu; dávka môže skončiť čiastočne a vypíše, čo neprešlo
- [x] **Výber, ktorý prežije stránkovanie** ✅ 2026-09-08 — **id v adrese**, nie klientsky stav. Zaškrtávacie políčko bez JavaScriptu prechod na druhú stranu neprežije: odošle sa až akciou, takže dovtedy o ňom server nevie. Odkaz áno — klik prepíše adresu a `carryFields` odvtedy nesie `pick=<id>` v každom ďalšom odkaze, teda aj cez filtre a stránkovanie. Do akcie sa výber dostane skrytými poľami `document`, takže `moveManyAction` a `assignManyAction` sa nemenili.
      Otvorená otázka z pôvodného zápisu — čo s označeným dokumentom, ktorý už filtru nevyhovuje — je vyriešená **priznaním, nie zahodením**: zostáva vybraný a nad zoznamom sa píše, koľko z označených nie je vidieť, plus odkaz „zrušiť výber". Tiché zahodenie by pri hromadnom presune znamenalo, že sa presunie menej, než človek čaká; tichá pamäť by znamenala, že sa presunie viac.
- [ ] **Dlhý výber napína adresu** — 148 označených dokumentov je ~148 × `pick=<24 znakov>`, teda okolo 4 kB v adrese. Pod bežnou hranicou 8 kB to je, ale nie s rezervou. „Označiť stranu" pridáva naraz 25, takže sa to dosiahne len opakovane. Ak to raz začne prekážať: strop s hláškou (nie tiché skrátenie), alebo výber v serverovom sedení — čo je stav, a ten sa dnes zámerne nikde nedrží
- [x] **5a. Detail dokumentu — pravý panel** — potvrdenia platného znenia (percento z pridelených osôb), prehľad metadát, chips v hlavičke. Editora sa to nedotklo
- [x] **5b. Nahrávanie** (`/library/new`) — číslované sekcie (nie stepper, schvaľovací krok neexistuje), zóna na pretiahnutie bez JavaScriptu, mriežka metadát
- [x] **5c. „Opýtať sa"** (`/`) — hero karta okolo poľa na otázku, hlavička karty odpovede („Odpoveď z vašich dokumentov"), zdroje ako karty s odkazom na originál. `Answer.tsx` a `Rating.tsx` znovupoužité, streamovania sa to nedotklo. Rozsah hľadania a skóre zhody vynechané — viď nižšie
- [x] **6. Nastavenia organizácie** — živý náhľad farby (prepíše premenné v celom rozhraní, nie len v ukážke), ukážka na tlačidle, chipe a odkaze, prstenec vybranej dlaždice vo vlastnej farbe, slot na logo 96×96 a **odstránenie loga** (`deleteBrand()` mal dovtedy len zapisovateľa, nie volajúceho)
- [x] **7. Dotiahnutie** — spoločný `:focus-visible` cez `:where()` (záchytná sieť s nulovou špecificitou, existujúce prstence platia ďalej), oprava pruhovaného pozadia zóny na súbor v tmavej téme, kotvy na filtre a späť na telefóne, hláška `<noscript>` na otázke, prihlásení a potvrdení dokumentu
- [x] **Potvrdenie dokumentu bez JavaScriptu** — je to formulár nad serverovou akciou, ktorá volá tú istú `acknowledge()` ako API. **Nie formulár mierený na API:** ten by bol CSRF na právne záväznom úkone, lebo JSON `Content-Type` cudzí formulár neposlal, ale obyčajný `<form method="post">` áno. Tlačidlo zostalo klientske kvôli `useFormStatus()`. (Poznámka o `readingMs` bola nesprávna: čas čítania je vlastná kolekcia a záznam potvrdenia naň nezávisí.)
- [x] **IP v zázname z produkcie overená** ✅ 2026-09-08 — `headers()` v serverovej akcii `x-forwarded-for` na Verceli **dostane**. Potvrdené na ostrom zázname: verzia 1.1 skúšobnej smernice, `acknowledgedAt 2026-09-08T13:16:15Z`, `ip` vyplnená verejnou adresou, `userAgent` vyplnený. Overené stavom v Atlase, nie logom — log je pominuteľný, záznam trvalý (ten istý dôvod ako pri `User.Read`).
      Vedľajší nález z toho istého záznamu: **`supersedes: null` je tu správne**, nie diera. Nová verzia nie je oprava starého potvrdenia — obe stoja ako dôkaz každé pre svoju verziu. `supersedes` je pre odvolanie a opravu, a **tá cesta neexistuje**: `acknowledge()` má hodnotu zapísanú natvrdo na `null` a nikto ju nenastavuje. Rovnaká polovica ako `trackId`.
- [ ] **Odvolanie a oprava potvrdenia sa nedá zapísať** — `supersedes` je v type aj v zázname, ale `acknowledge()` doň vždy dá `null` a druhé volanie, ktoré by ukazovalo na starý záznam, neexistuje. Kolekcia je zámerne append-only (D24), takže bez tejto cesty sa omylom potvrdený dokument nedá ani odvolať, ani opraviť — dá sa len potvrdiť znova. Rozhodnúť, kto smie odvolať (osoba sama? HR?) a čo to znamená pre výkaz.
- [ ] **Prihlásenie bez JavaScriptu** — odkaz na e-mail sa odosiela cez `fetch` a konto cez `signIn()` z next-auth; bez skriptu sa človek nedostane dnu vôbec. Dnes to hláška povie. Serverová cesta znamená vlastný `<form action>` pre e-mailový odkaz a `<form method="post">` na `/api/auth/signin/<provider>` s CSRF tokenom — treba overiť, či to next-auth v tejto verzii podporuje
- [ ] **Zásuvka filtrov ako v návrhu** (panel schovaný za tlačidlom, nie kotva) — `<details>` sa na širokej obrazovke nedá spoľahlivo držať otvorené cez CSS (`::details-content` je čerstvé) a druhá kópia panelu v DOM je horšia než kotva. Má zmysel až s klientskym stavom, teda spolu s rozhodnutím, že knižnica smie vyžadovať JavaScript
- [x] **Presunuté do shellu všetky prihlásené obrazovky** ✅ 2026-09-08 — nie po jednej, ale naraz: medzistav bol horší než oba konce. Dva navigačné systémy vedľa seba mali iné poradie položiek, iný vzhľad aktívnej položky a iné zarovnanie obsahu, a na tom, ktorá stránka ktorý systém má, nezáležalo nikomu okrem toho, kto sa medzi nimi preklikával.
      Menu z hlavičky zmizlo, `shellRoutes.ts` sa otočil na zoznam **výnimiek** (dnes len `/sign-in`), a hlavička, navigácia, obsah aj pätička majú jednu šírku (`--shell-maxw`).
- [ ] Uložiť variant navigácie a hustotu na osobu alebo organizáciu — **zmena schémy**, zatiaľ len `?layout=` v adrese
- [x] **Premenované slovenské CSS triedy na anglické** ✅ 2026-09-08 — 109 tried, 47 súborov, plus `je-*` → `is-*`, dva slovenské `@keyframes`, štyri slovenské `id` a kotvy a vlastná premenná `--uroven` → `--level`. Súbežné `je-aktivna` aj `je-aktivny` splynuli do jedného `is-active`, preto je tried o tri menej než pred tým.
      **Nahrádzalo sa cielene, nie slepo v texte.** Slová `pole`, `karta`, `strom`, `farba` sú v tomto repozitári aj názvy premenných, polí formulárov a hlavne slov v slovenských komentároch — tie sú zámerne po slovensky a mangľovať ich by bola škoda. Skript preto menil len token **za bodkou** v CSS a len vnútri `className=` v TSX.
      Overené obrázkom, nie dôverou: päť skúšobných strán (shell, dotiahnutie, značka, skupiny podmienok, výber) × dve šírky × dve témy = **20 renderov, všetkých 20 zhodných na pixel** so starým CSS a starým značkovaním. Prvý pokus tri rozdiely našiel — boli to prechody `transition` zachytené v polovici, nie premenovanie.
- [ ] Obaliť `platformContext()` / `hrContext()` / `peopleContext()` / `libraryContext()` do `cache()` z Reactu — `layout.tsx` aj `AppShell` ich volajú v tej istej požiadavke

##### Chýba to v dátach — návrh to žiada, model to zatiaľ nevie

> Tri veci z handoffu sa **nedali spraviť pri filtroch**, lebo pod nimi nie sú dáta. Doplniť ich treba, ale každá je vlastné rozhodnutie s dopadom na model, nie prílepok k obrazovke.

- [ ] **Facet a stĺpec „Oddelenie"** — dokument oddelenie **nenesie**. Pridelenie žije v `assignments` (`audience.kind` = `department` / `group` / `track`), takže filter aj stĺpec znamenajú spojenie naprieč kolekciami. Rozhodnúť: denormalizovať zoznam adresátov na dokument (rýchle čítanie, ale stav sa ukladá — proti D27), alebo počítať z `assignments` agregáciou pri každom zobrazení
- [ ] **Stĺpec „Potvrdenia %"** — percento potvrdení pre každý riadok je agregácia nad `acknowledgements` a nad počtom adresátov. Rozhodnúť rozsah (kto je menovateľ: pridelení, alebo celá organizácia?) a či sa počíta pri zobrazení, alebo sa drží predpočítané
- [ ] **Rozsah hľadania** („Hľadať len v: Knižnica / Intranet / Verejný web / Archív") — v systéme **nič také neexistuje**. Prehľadáva sa `document_chunks` jednej organizácie, jediné delenie je `accessLevel` (verejné / interné). Pilulky by teda predstierali voľbu, ktorá nič nemení. Doplniť znamená: rozhodnúť, čo tie rozsahy vlastne sú (typ zdroja? stav znenia? archív = `effectiveTo` v minulosti?), pridať ich ako filter do RAG dotazu (`SearchOptions`) a preniesť voľbu cez `/api/chat`
- [ ] **Skóre zhody pri zdroji** (formát „0,94") — hodnotu `score` vracia vyhľadávanie (`ChunkResult.score`), ale `buildSources()` ju klientovi neposiela a `AnswerSource` pole na ňu nemá. Doplniť je pár riadkov, otázka je, **čo to číslo pre človeka znamená**: pri `$rankFusion` a reranku nie je v rozsahu 0–1 a medzi režimami hľadania (fulltext / vektor / hybrid) nie je porovnateľné. Ukázať neporovnateľné číslo ako „zhoda 94 %" je horšie než ho neukázať
- [ ] **Stavy „Na schválenie" a „Expirovaný"** — v knižnici **neexistuje schvaľovací workflow**; dnes sú stavy len `draft` / `published` a platnosť sa odvodzuje z `effectiveFrom` / `effectiveTo` znenia. „Expirovaný" sa dá odvodiť (D27), „Na schválenie" je nový stav so schvaľovacou cestou — a tá je vlastná fáza, viď schvaľovatelia v kroku 5

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
- [x] ~~**D30 / O13 — čo je „podstatná zmena"**~~ — **D30 zrušená 2026-08-29**, nahradila ju D37. Definícia sa napísať nedala: stroj nerozlíši opravu preklepu od novej povinnosti. Namiesto definície je povinný **dôvod**, ktorý pri prideľovaní vypíše človek. Postavené v `lib/assignments.ts`.
- [x] **O14 — meriame čas nad dokumentom** ✅ 2026-08-28 rozhodnuté: **áno, čas sa meria.** Ultra-MVP ho nemeral, takže ide o rozšírenie, nie o zmenu. Rozhodnutie so sebou nesie tri veci, ktoré treba vybaviť **pred** zapnutím merania, nie po ňom:
  - [ ] Právny základ a retencia pre údaj o správaní (O15, O16) — čas nad dokumentom je osobný údaj o tom, ako sa človek správal, nie súčasť vyhlásenia
  - [x] **Rozhodnuté 2026-09-06 (Ján Letko): merať sa bude.** Čas je informatívny a sám osebe nič nevyvoláva — pri spolutvorcovi dokumentu bude krátky oprávnene, pri novom človeku je to silný signál. **Následok teda žiadny nie je**, a to je zámer, nie prehliadnutie.
  - [x] **Tri následky vybavené 2026-09-06 (Ján Letko):**
        (a) **transparentnosť** — človek vidí svoj čas aj vetu, že je informatívny a nie je súčasťou potvrdenia. Meranie, o ktorom sa dozvie až zo zásad ochrany údajov, je presne to, čo pri audite robí problém;
        (b) **retencia 1 rok** — TTL index, samostatná kolekcia;
        (c) **nikdy dôkaz** — a preto **nie** `acknowledgements.readingSeconds`. Údaj s vlastnou retenciou nesmie bývať v zázname, ktorý musí prežiť: TTL maže celé dokumenty, nie polia, a čokoľvek v `acknowledgements` sa raz ocitne vo výkaze pre právnika.
  - [ ] Implementácia: samostatná kolekcia `reading_times` (companyCode, personId, documentId, versionId, seconds), TTL 365 dní, unikátny index nad (personId, versionId). Meria sa **viditeľný čas** (Page Visibility API) — karta na pozadí sa nepočíta. Server ukladá `max()`, takže hodnota je monotónna a druhé otvorenie ju nezníži.
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
- [x] ✅ **2026-08-28 — evidencia prihlásenia sa zapisuje.** `npm run status` po prvom prihlásení cez `persons`: `stav=active`, `posl. prihlásenie=2026-08-28T18:17:54.682Z` — teda v tej istej sekunde ako callback. `await recordSignIn(...)` sa tým overil naostro; predtým sa nezapisovalo nikdy, lebo brzda vracala `true` skôr, než sa k zápisu došlo.
- [x] ✅ **2026-08-28 — odkaz z e-mailu vedie na úvodnú stranu.** Callback `302` → `GET /` (predtým `→ /prihlasenie`). Widget „Nevybavené žiadosti" sa zobrazil na živých dátach.
- [ ] **Odkaz sa raz zavolal dvakrát sekundu po sebe** (2026-08-28 17:07), čím sa jednorazový token spotreboval a používateľ videl „odkaz už neplatí". Pri opakovanom pokuse sa to **nezopakovalo**, takže príčina nie je potvrdená a nič sa zatiaľ nemenilo. **Pred hromadným rozposlaním preveriť**, či poštové brány adresátov (najmä Microsoft 365 Safe Links) odkazy nepredberajú — tie to robia systematicky. Ak áno, riešenie je krátke okno na opätovné použitie tokenu (rozhodnuté 2026-08-28, čaká na potvrdenie príčiny).
- [ ] **Neznámy hostiteľ dostane najprv `307` na `/prihlasenie` a až potom `404`.** Middleware beží pred kontrolou tenanta a presmeruje neprihláseného skôr, než sa zistí, že doména nikomu nepatrí. Obsah neuniká a koniec je správne `404`, ale D29 hovorí, že cudzia doména sa nemá dozvedieť nič — a takto sa dozvie, že existuje cesta `/prihlasenie`. Opraviť sa to dá len overením tenanta priamo v middlewari; ten beží na edge a do Atlasu nevidí, takže by to chcelo verejný endpoint s krátkou pamäťou (rovnako to rieši `inventario`). Nízka priorita, ale zapísané, nech to nezapadne.
- [x] ~~Chybová stránka prihlásenia končí na `app.contineo.app`~~ — **vyriešené 2026-08-29 odstránením `NEXTAUTH_URL` z produkcie.** Nebolo to kozmetické: z tej istej premennej si NextAuth staval aj `redirect_uri` pre prihlásenie kontom, takže Entra odmietala prihlásenie s `AADSTS50011`. Bez premennej si origin odvodí z hostiteľa požiadavky.

**I1b. Viacjazyčné prostredie (D35)** — SK · CS · EN

- [x] `app/src/lib/i18n.ts` ✅ 2026-08-27 — zoznam jazykov prostredia (oddelený od číselníka `language`, ktorý tagguje obsah), formulka a e-mail per jazyk, deterministický dátum
- [x] `persons.language` + prihlasovací e-mail v jazyku osoby ✅ 2026-08-27
- [x] `acknowledgements.language` + `documentLanguage` ✅ 2026-08-27 — záznam unesie, že Čech potvrdzoval slovenský text
- [ ] Preklad **rozhrania** portálu — po častiach, poradie podľa toho, kto obrazovku vidí:
  - [x] **1 — človek** ✅ 2026-08-30: formulka, onboarding, čakajúce, e-maily, hlavička, pätička, 404, domov, prihlásenie, dokumenty, otázky a odpovede
  - [x] **2a/2b — knižnica: zoznam, priečinky, nahrávanie** ✅ 2026-08-30
  - [x] **2c — knižnica: detail dokumentu, editor, hlásenia akcií** ✅ 2026-08-31 (`d75d951`)
  - [x] **3a — osoby** ✅ 2026-09-04 (`2d794ee`) — zoznam, pozvanie, detail, import z CSV, hlásenia
  - [x] **3b — nastavenie organizácie** ✅ 2026-09-04 (`f587847`) — všetkých sedem záložiek, `AuditList`, `ColorSelect`, hlásenia
  - [x] **3c — admin a zvyšné komponenty** ✅ 2026-09-04 (`22ef0a2`) — správa tenantov, zlatá sada (zoznam, detail, hodnotenie), metadáta stránky
  - [x] **4a — knižnica** ✅ 2026-09-04 (`c2db9be`) — `AppError` s kódom a hodnotami, `errorText()` na okraji; `LibraryError`, `FolderError`, `RewriteError`, `FileStoreError`, `ConversionError`, `CodelistError` (62 miest, 47 kódov)
  - [x] **4b — organizácia** ✅ 2026-09-04 (`3e53e49`) — `DepartmentError`, `TenantValidationError`, `BrandError`, `DomainError`, `DomainOwnedError` (33 miest)
  - [x] **4c — osoby, prideľovanie a API** ✅ 2026-09-04 — `PersonValidationError`, `AssignmentValidationError`; veta „Nenašiel som relevantné informácie…" ide zo slovníka (jazyk posiela klient, `/api/chat` prihláseného nepozná); odpovede `/api/hodnotenie`, `/api/sada` a middleware sú kódy pre vývojára — klient telo chyby nikdy nezobrazí
  - [x] **4 — chyby prekladané až na obrazovke** ✅ 2026-09-04 — 110 hlášok v 13 triedach; `AppError` nesie kód a hodnoty, vetu skladá `errorText()` na okraji
- [ ] **Otázka pre HR/právnika:** má formulka pomenovať jazyk dokumentu, keď sa líši od jazyka prostredia?

**I2. Rozsah B `[2–3,5 týždňa]`**

- [x] Kolekcia `onboarding_tracks`; progres sa **odvodzuje**, neukladá — **D27** ✅ 2026-08-28
- [x] **Zápis trás** ✅ 2026-09-06 (`a321b39`) — `createTrack`, `renameTrack`, `setTrackSteps`, `setTrackActive`, `allTracks`, `trackByKey`. Poradie je poradie v poli, nie číslo zvonka; nová trasa je prázdna a **neaktívna**; vypnutie trasu **nemaže** (D24). 14 testov.
- [x] **Obrazovka kurátora** ✅ 2026-09-06 (`485f2a1`) — `/kniznica/trasy` + detail. Kroky sa posielajú celé pri každej zmene, takže poradie je na jednom mieste a dve otvorené záložky sa navzájom potichu neprepíšu.
- [x] **Guided reading: poradie krokov, návrat na rozpracované** ✅ 2026-09-06 — `/dokumenty` už kroky nesplošťuje (`flatMap` zahodil poradie aj „kde som skončil"). Zoznam je po trasách, prvý nedokončený krok je zvýraznený.
- [x] **Čas čítania** ✅ 2026-09-06 (`df4d879`) — kolekcia `reading_times`, TTL 1 rok, viditeľný čas cez Page Visibility API, veta pre človeka. Podrobnosti v I0/O14 vyššie.
- [x] **HR výkaz: podľa dokumentu / osoby / trasy + export** ✅ 2026-09-06 — `/hr/overview`, výpočet v `lib/hrReport.ts`, CSV cez `/hr/overview/csv`.
      **Menovateľ je pridelenie + trasa** (rozhodnuté 2026-09-06): sú to jediné dva spôsoby, ako sa dokument k človeku dostane. „Všetci v organizácii" by nafúkol každé číslo o ľudí, ktorých sa vec netýka; „len pridelenia" by mlčky vynechal onboarding cez trasu.
      Jedna povinnosť na osobu a znenie — dokument z trasy aj z pridelenia je jedna povinnosť s dvomi dôvodmi, inak sa dá súčet nafúknuť dvojitým pridelením.
      Export ide z **toho istého** zoznamu ako obrazovka, nie z druhého dotazu — výkaz, ktorý sa nezhoduje s obrazovkou, sa rozíde práve vtedy, keď si to nikto nevšimne.
      Zhrnutie používa **medián**, nie priemer: jeden človek na strope štyroch hodín posunie priemer o hodiny.
  - [ ] **Do záznamu o spracúvaní (O15/O16):** HR vidí čas čítania **aj pri jednotlivých ľuďoch** (rozhodnuté 2026-09-06). Je to údaj o správaní konkrétnej osoby zobrazený inej osobe — patrí do záznamu a do informovania zamestnancov, nie len do kódu. Zoradiť sa podľa neho nedá zámerne (rebríček by z merania bez následku následok vyrobil), ale to samo osebe nestačí.
- [x] **Pripomienky meškajúcim z UI** ✅ 2026-09-06 — `/hr/reminders` s náhľadom, `lib/reminders.ts`.
      **Jeden e-mail na človeka, nie na povinnosť** — štyri správy v jednej minúte vyzerajú ako pokazený systém a človek si na ne zapne filter.
      Meškanie sa počíta od `Duty.since`: pri pridelení jeho dátum, pri trase odkedy má človek prístup. Oba pôvody → platí **neskorší** (D37: nové pridelenie vracia hodiny na nulu). Povinnosť bez začiatku sa za meškajúcu nepovažuje.
- [x] **Naplánovaná úloha** ✅ 2026-09-06 — `/api/cron/overdue` + `vercel.json`, **týždenne v pondelok 06:00 UTC**. Prah je 14 dní; denný e-mail o tom istom zozname personalista do troch dní prestane otvárať.
      **Cron nerozposiela ľuďom, upozorňuje personalistu** (rozhodnuté 2026-09-06). Jedna chyba v podmienke by sa pri automatickom rozposielaní prejavila až tým, že sa ozve sto nahnevaných ľudí; takto sa prejaví tým, že personalista otvorí zoznam a povie „toto nesedí".
  - [ ] **Nastaviť `CRON_SECRET` vo Verceli.** Bez nej sa beh odmietne (401) — zámerne: chýbajúca premenná by inak spravila z odkazu verejný výpis toho, koľko ľudí mešká.
- [x] **Povinnosti z trasy sa dá dať vedieť e-mailom** ✅ 2026-09-08 — `/hr/reminders` má dva režimy nad tým istým výpočtom: **prah 0** („všetkým nepotvrdeným", vrátane povinností z trás a toho, čo pribudlo dnes) a **prah 14 dní** (pripomienka meškajúcim). Nie je to nový mechanizmus, je to ten istý `duties()`, ktorý už spája pridelenia aj trasy.
      Prah 0 sa dovtedy nedal nastaviť: `Math.max(1, Number(q.days) || DEFAULT_DAYS)` mal dve zábrany naraz — jednotku ako dolnú hranicu a `||`, cez ktoré nula prepadla na 14. Teraz to rieši `thresholdDays()` a preklep v adrese padá na predvolený prah, **nie na nulu**: nula by rozposlala e-maily všetkým namiesto meškajúcim.
      **E-mail má dva tvary.** Pri prahu 0 sa neuvádzajú dni a predmet znie „Na potvrdenie", nie „Pripomienka" — dokument, ktorý pribudol dnes, „nečaká nula dní" a veta o čakaní by z prvého oslovenia spravila výčitku.
      Pri každej položke je vidieť, **z ktorej trasy** povinnosť plynie: pridelenie, ktoré by personalista inak hľadal v zozname, pri nej neexistuje.
- [x] **Hromadné pozvánky z UI** ✅ 2026-09-06 — `/osoby/pozvat` s náhľadom, `neverSignedIn()` v `lib/people.ts`.
      Kritérium je **`firstLoginAt`, nie `status`**: osoby z importu a zo samozaloženia cez pracovné konto (D47) majú stav rovno `active` a pozvánku nikdy nedostali — a sú to práve tí, ktorých treba osloviť.
      E-mail nesie **odkaz na portál, nie prihlasovací odkaz** (rozhodnuté 2026-09-06): ten platí 24 h a raz, takže pri stovke adries naraz časť vyprší skôr, než si to niekto prečíta, a M365 Safe Links ho spotrebuje ešte pred človekom — presne tá príčina, ktorá je zaznamenaná v I1 z 2026-08-28.
- [x] Opätovné potvrdenie pri novej verzii ✅ — cez pridelenie s povinným dôvodom (**D37**, nie D30)
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
  - [x] Overiť, že vektorový a fulltextový index prešli a `smoke.mjs` beží ✅ 2026-09-06 — oba indexy sedia (`rag_vector_index`, `rag_text_index`), 581 aktívnych chunkov, celá reťaz prejde. `smoke.mjs` bol od 28. 8. nespustiteľný: s `esbuildom` mu odišlo bundlovanie TypeScriptu. Opravené bez návratu závislosti — beží cez `scripts/lib/ts-hook.mjs` ako ostatné skripty (`npm run smoke`).
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

### N. Slovenčina v kóde — zvyšok po veľkom premenovaní

> Premenovanie identifikátorov (2026-08-30) prešlo **deklarované identifikátory**,
> nie **názvy vlastností** — nástroj ich zámerne nechal na pokoji, aby nerozbil
> polia v databáze. Zostali teda slovenské názvy vlastností a niekoľko polí
> v Mongo. Ide o samostatnú úlohu, nie o i18n.

- [x] Návratové hodnoty `libraryWrite` (`chunkov`, `archivovanych`, `uzBolo`, `znovaPotvrdit`) a `RewriteMode` ✅ 2026-08-31 — spolu s i18n 2c, lebo sa ich dotýkali formuláre
- [x] **Profil členenia** ✅ 2026-09-04 (`eea2bf6`) — `chunker.mjs` zostáva nedotknutý, preklad je v `src/lib/chunkingProfile.ts`; databáza, typy aj formulár po anglicky. **Migrácia `npm run migrate:chunking` ešte nebežala** — `.env.local` nemá hodnotu `MONGODB_URI`.
- [x] `chunker.d.ts` → `chunker.d.mts` ✅ 2026-09-04 — pri prípone `.mjs` hľadá TypeScript `.d.mts`, takže starý súbor sa nikdy nečítal
- [x] **Polia v databáze** ✅ 2026-09-07 — `documents.versions[].opravy[]` → `fixes[]` s anglickými kľúčmi (`at`, `by`, `reason`, `requiresReacknowledgement`, `fromLabel`, `fromEffectiveFrom`).
      **Migrácia nebola potrebná: v Atlase nemá `opravy[]` ani jeden z 10 dokumentov.** Overené pred zmenou, nie predpokladané.
      Pole je odteraz aj v type `Version` — dovtedy sa zapisovalo, ale nikde nedeklarovalo.
  - [x] **História opráv v detaile dokumentu** ✅ 2026-09-07 — rozbaľovacia položka pri každom znení, najnovšia oprava hore. Ukazuje dôvod, kto a kedy, a **stav pred opravou** — bez neho by sa dalo prečítať, že sa niečo zmenilo, ale nie na čo. 4 testy nad tvarom zápisu: `$push` ide cez reťazcovú cestu s `as never`, takže názvy polí TypeScript nekontroluje a práve tento tvar nás v projekte zradil trikrát.
- [x] Premenné pre odosielateľa ✅ 2026-09-07 — `EMAIL_SENDER`, `EMAIL_SENDER_NAME`; kód číta najprv anglickú, pri prázdnej starú slovenskú. Pribudol pomocník `env()`, ktorý **prázdny reťazec nepovažuje za hodnotu** — `??` ho nechytí a `vercel env pull` zapisuje nenastavené premenné práve ako `X=`.
  - [x] `EMAIL_SENDER` a `EMAIL_SENDER_NAME` nastavené vo Verceli aj v `.env.local`, slovenské odstránené ✅ 2026-09-07 (Ján Letko). Hodnoty overené pullom, nasadené nanovo — premenné sa viažu na nasadenie v čase buildu, takže bez redeploy by bežal stav, ktorý už v konfigurácii nie je (rovnaká pasca ako pri `MONGODB_DB`).
  - [ ] **Overiť odosielanie behom, nie výpisom** — vyžiadať si prihlasovací odkaz na `/sign-in` a pozrieť, či príde a s akou adresou odosielateľa. Z konfigurácie sa to zistiť nedá.
  - [ ] **Pozor na rollback:** staré slovenské premenné už na Verceli nie sú. Návrat na nasadenie staršie než `0886f39` rozbije odosielanie e-mailov (ten kód pozná len `EMAIL_ODOSIELATEL`); staršie než `5b18cfc` nepozná anglické routy. Pri rollbacku ďalej než po `b0b1f8e` treba premenné dočasne vrátiť.
- [x] `osoby/actions.ts` ✅ 2026-09-04 — spolu s i18n 3a (`confirmation`, kľúč `error`)
- [x] `hr/actions.ts` a `hr/pridelit` ✅ 2026-09-04 — `reason`, `addresses`, `all`; pri tom sa ukázalo, že po chybe sa vyplnený formulár nevracal
- [x] Premenná prostredia `POVOLENE_EMAILY` → `ALLOWED_EMAILS` ✅ 2026-09-04 — preložená, nie premenovaná: `auth.ts` číta novú, a keď nie je, starú. Prázdna nová starú neumlčí.
  - [x] **`ALLOWED_EMAILS` vo Verceli nastavená** ✅ 2026-09-06 — hodnota je **jedna adresa správcu**, nie doména. Zoznam je núdzová brzda pred `persons`, nie zoznam používateľov: kto je na ňom, dostane sa dnu aj bez `persons` a aj pri nedostupnom Atlase. `@futbalsfz.sk` by znamenalo, že celý zväz obíde evidenciu prístupov.
  - [ ] Odstrániť `POVOLENE_EMAILY` z Vercelu — až po overení prihlásením, nie výpisom (`vercel env pull` vracia hodnotu prázdnu)
  - [ ] `EMAIL_MENO_ODOSIELATELA` a `EMAIL_ODOSIELATEL` → `EMAIL_SENDER_NAME`, `EMAIL_SENDER` — rovnaký vzor: **preložiť, nie premenovať** (kód číta novú, pri prázdnej starú), aby nasadenie nespadlo medzi zmenou kódu a zmenou premennej
- [ ] `chunker.mjs` a jeho `.d.mts` majú slovenské názvy **zámerne** — sú to jeho parametre a prekladajú sa v `chunkingProfile.ts`. Nechať tak.
- [ ] **Rozpísané skratky v deštrukturalizácii** (`{ name: name, options: options }` namiesto `{ name, options }`) — **33 riadkov v 12 komponentoch** (`AppNav`, `AuditList`, `Header`, `MultiSelect`, `Notice`, `Search`, `Select`, `SignIn`, `TagSelect`, `TextEditor`, `TreeWithOrder`). Zostalo po dávnom premenovaní vlastností. Čistá kozmetika, `eslint` to nehlási — urobiť pri najbližšom dotyku daného súboru, nie ako samostatný prechod cez dvanásť súborov.
- [x] **Názvy indexov v Mongo** ✅ 2026-09-06 — 18 premenovaní cez `npm run migrate:indexes` (náhľad, `--zapis` vykoná). `onboarding_init.mjs` má nové názvy a jeho polia po anglicky (`kluc`→`key`, `preco`→`why`, `kolekcia`→`collection`, `indexy`→`indexes`).
      **Bezpečné poradie neexistuje.** Mongo druhý index nad tým istým kľúčom neprijme („Index already exists with a different name"), takže „vytvoriť → zahodiť" nejde a premenovanie indexu ako operácia v Mongu nie je. Ostáva zahodiť → vytvoriť, teda krátke okno bez obmedzenia.
      Preto skript pri unikátnom indexe **najprv overí, že duplicity neexistujú** (rešpektuje `partialFilterExpression`) a zahodí len vtedy. Keby `createIndex` po zahodení zlyhal, kolekcia by zostala bez obmedzenia — a pri `acknowledgements` je to jediné, čo drží dvojité potvrdenie toho istého znenia (D24). Radšej sa nespraví nič než polovica.
      Overené: `acknowledgement_unique` má `unique` aj `partial={"type":"acknowledgement"}`; `onboarding_init.mjs` prejde na nulu zmien.
      Pri tom sa ukázalo, že priečinky knižnice sú `cms_folders`, nie `folders` — prvý beh ich ticho preskočil ako neexistujúcu kolekciu.
- [x] **Slovenské identifikátory v `lib/` a v komponentoch** ✅ 2026-09-06 — `vercel.ts` (`volaj`→`call`, `stav`→`status`, `telo`→`body`, `vProjekte`→`inProject`, `nastaveneCez`→`configuredBy`, stavy `DomainResult` po anglicky), `oauth.ts` + `secrets.ts` (`nastavene`→`set`, `nenastavene`→`unset`, `necitatelne`→`unreadable`, `z-prostredia`→`from-environment`, `zdroj`→`source`), `Rating.tsx` a `GoldenSetQuestion.tsx` (`cakam`/`ukladam`/`ulozene`/`chyba` → `idle`/`saving`/`saved`/`failed`).
      Segmenty `[kod]` → `[code]` v `admin/tenanti` a `api/znacka` — **adresu to nemení**, `kod` bol názov parametra v kóde, nie časť URL.
      Žiadna z týchto hodnôt sa neukladá do Mongo, takže migrácia netreba. `secrets.test.ts` upravený na nové hodnoty.
- [x] **Routy → anglické** ✅ 2026-09-07 — preložené, nie premenované. `/dokumenty`→`/documents`, `/kniznica`→`/library` (`/trasy`→`/tracks`, `/nova`→`/new`), `/osoby`→`/people` (`/pozvat`→`/invite`, `/nova`→`/new`), `/organizacia`→`/organisation`, `/prihlasenie`→`/sign-in`, `/sada`→`/golden-set`, `/hr/pridelit`→`/hr/assign`, `/hr/{id}/oznamit`→`/notify`, `/admin/tenanti`→`/admin/tenants`, `/admin/novy`→`/admin/new`, a API `/api/{kniznica,sada,znacka,fotka,hodnotenie}` → `/api/{library,golden-set,brand,photo,rating}` (`subor`→`file`).
      **Presmerovanie je v middleware, nie v `next.config`** (`lib/legacyRoutes.ts`, 307). Poradie vrstiev pri konfiguračných presmerovaniach závisí od verzie Nextu; keby sa raz prehodilo, neprihlásený človek zo starej záložky by dostal do `callbackUrl` cestu, ktorá už neexistuje. Tu je poradie napísané a otestované — overené behom: `/documents` bez prihlásenia dá `callbackUrl=%2Fdocuments`, teda novú cestu.
      307, nie 308: dočasné presmerovanie sa dá odvolať, trvalé zostane v prehliadačoch ľudí.
      8 testov vrátane poistky, že sa preložená cesta už nechytá znova (inak by sa middleware zacyklil). Overené aj naživo: každá stará cesta jeden skok, query sa nesie ďalej.

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
- [x] **oddelenia ako strom** (D49) — osoba v práve jednom, pridelenie platí aj pre podstrom, skupiny zostávajú samostatnou dimenziou. Prevod z textu: `npm run departments`
- [x] **prevod oddelení SFZ spustený 2026-08-29** — nemal čo previesť: v databáze je zatiaľ jedna osoba a žiadna nemá oddelenie zapísaný textom. Zmysel dostane po importe ľudí z CSV
- [x] **reorganizácia** (D50) — úloha z oddelenia platí odo dňa príchodu, bývalí členovia zostanú v prehľade označení a bez e-mailu, potvrdenie nesie odtlačok oddelenia
- [x] **údaje z adresára** (D52) — meno, priezvisko, oddelenie, pozícia, jazyk a fotka z Microsoft Graphu; dopĺňa sa len chýbajúce, zlyhanie Graphu prihlásenie nezhodí
- [x] **`User.Read` v Entra aplikácii SFZ funguje** ✅ 2026-09-07 — overené **stavom v databáze, nie logom**: `jan.letko@futbalsfz.sk` má vyplnené `jobTitle: CIO`, `department: IT department` a `photoVersion`, a to sú presne tie tri údaje, ktoré dopĺňa `fillFromDirectory()` z Graphu. Pri 403 by zostali prázdne.
      Logy sa na to nedali použiť — Vercel Pro ich drží deň a za ten čas sa nikto cez Microsoft neprihlásil. Stav v `persons` je trvalý dôkaz, log je pominuteľný.
- [x] **Núdzová brzda zamrazovala `lastLoginAt`** ✅ opravené 2026-09-07 — kto je na `ALLOWED_EMAILS`, tomu sa prihlásenie neevidovalo vôbec, lebo brzda sa vracala hneď. Prejavilo sa to tak, že `jan.letko@futbalsfz.sk` má posledné prihlásenie 30. 8., hoci sa prihlasuje denne — a s ním zamrzol aj príznak „nové od posledného prihlásenia" (D39), ktorý sa z `previousLoginAt` počíta. Evidencia sa teraz skúsi aj na tejto ceste, ale s 2-sekundovým stropom: brzda existuje pre chvíle, keď je Atlas nedostupný, a čakanie bez stropu by ju znefunkčnilo.
- [x] **audit správcovských zmien** (D51) — vlastná kolekcia, nemenná, rozdiel namiesto celého objektu, tajomstvá len ako „zmenené"; vidí ho `people-admin` a správca platformy
- [x] **skupiny majú históriu členstva** — pôvodné rozhodnutie nechať ich bez nej neobstálo
- [x] **indexy auditu a histórie skupín vytvorené 2026-08-29** — `node scripts/onboarding_init.mjs`
- [ ] **retencia auditu nie je určená** — otvorené v O16 spolu s retenciou potvrdení
- [ ] **prihlásenia sa nezapisujú** — zámerne; záznam každého prihlásenia patrí najprv do GDPR dokumentácie (súvisí s O14)
- [x] **indexy vytvorené v Atlase 2026-08-29** — `node scripts/onboarding_init.mjs` (stav bez zápisu: `--stav`). Pribudla kolekcia `departments` s dvomi indexmi a dva indexy nad `persons`

**Zostáva (mimo rozsahu B)**

- [x] **pripomienky podľa času** — naplánovanú úlohu **máme**: `app/vercel.json` má cron `/api/cron/overdue` (dnes `0 6 * * 1`, teda týždenne). Tento zápis tvrdil opak a bol zastaraný — dokumentácia je indícia, kód je pravda.
- [x] **Schvaľovanie znenia pred zverejnením** ✅ 2026-09-10 — kroky 1 až 6 vrátane brány pri prideľovaní a facetu `Stav`. — návrh spísaný v `docs/ADR-006-schvalovanie-znenia.md` (2026-09-10). Schvaľuje sa **znenie, nie dokument**; schvaľovatelia sú menovaní ľudia, nie rola; súbežne, nie za sebou; zamietnutie je záznam s povinným dôvodom; schválený text sa nemení (iný text = nové znenie); schválené ≠ účinné. Desať dnešných noriem sa spätne neschvaľuje — označia sa ako zverejnené pred zavedením.
      **Poradie krokov je záväzné:** brána pri prideľovaní nesmie ísť pred migráciou označenia, inak personalista nemôže prideliť nič.
      **Krok 6 čiastočne (2026-09-10):** „Čaká na schválenie" je nad knižnicou — zoznam s menami a dátumom predloženia, nie dlaždica s číslom. Presunie sa na Prehľad, keď vznikne.
      **Facet `Stav` hotový (2026-09-10):** tretia hodnota „na schválenie", dva dotazy namiesto spojenia kolekcií. Nie je to tretia priehradka — dokument môže byť publikovaný a zároveň mať bežiace kolo, takže sa pridáva cez `$or`.
      **Krok 5 hotový (2026-09-10):** e-mail menovaným schvaľovateľom pri predložení, `notifiedAt` na schvaľovateľovi. Jednorazová menovitá správa, nie kadencia.
      **Pozor:** kolo 2 na `sfz:test_onboarding` vzniklo **pred** krokom 5, takže Agáte Galkovej sa o ňom neozvalo (`notifiedAt` je `null`). Rozposielanie sa spúšťa pri predložení; ak má e-mail dostať, treba kolo zrušiť a predložiť znova.
      **Krok 4 hotový (2026-09-10):** `/approvals` — obrazovka schvaľovateľa, `decide()` a `decideProblem()`. Odchýlka od ADR: rozhodovanie **nie je** v detaile dokumentu, lebo schvaľovateľ nemusí mať rolu `spravca-obsahu` (D69) a dať mu ju kvôli schvaľovaniu by mu dovolilo aj nahrávať normy.
      **Krok 3 overený na produkcii (2026-09-10)** pri 390 px: predloženie, história kôl, zrušenie kola s povinným dôvodom, druhé kolo po zrušení. Bez vodorovného posunu, riadok schvaľovateľa 60 px vysoký.
      **Nájdené pri overovaní:** v **uzavretom** kole sa pri schvaľovateľovi, ktorý nerozhodol, píše „čaká". Pri zrušenom kole už nečaká na nič — malo by tam byť „nerozhodla". Drobnosť, ale je to text v histórii, ktorá má byť dôkazom.
      **Nájdené pri overovaní:** schvaľovanie sa nedá použiť, kým je v organizácii jedna osoba — predkladateľ sa vybrať nemôže (D69). Je to vecná podmienka pre D75: skôr než sa cez schvaľovanie nahrajú oficiálne znenia, musí existovať niekto, kto ich schváli.
      **Krok 3 hotový (2026-09-10):** predloženie na schválenie v detaile dokumentu — `lib/approvalsDb.ts`, `components/ApprovalPanel.tsx`, dve serverové akcie, i18n sk/cs/en. Chýba: vytvoriť index `approval_round_unique` v Atlase (`npm run status` ho hlási ako chýbajúci) a overiť obrazovku na 390 px v prihlásenej relácii.
      **Predvyplnenie schvaľovateľov podľa roly (D69) zatiaľ nie je** — rola schvaľovateľa v systéme neexistuje, takže by sa predvypĺňalo podľa čoho? Ponúkajú sa všetci činní ľudia organizácie okrem predkladateľa.
      **Migrácia označenia hotová (2026-09-10):** `npm run migrate:grandfather -- --company SFZ --zapis` — 11 znení v 10 dokumentoch dostalo `Version.publishedBefore`, 10 auditných záznamov. Koncepty sa zámerne neoznačujú, nové znenia príznak nedostávajú nikdy.
      **Poradie krokov opravené:** brána pri prideľovaní (krok 2) ide až **po** predložení a rozhodovaní (3, 4) — inak by sa nové znenie dalo nahrať, ale nie schváliť a ani prideliť.
      **Krok 1 hotový (2026-09-10):** `app/src/lib/approvals.ts` + 24 testov — model kola, `versionState()`, `roundOutcome()`, `submitProblem()`, `assignBlock()`. Čisté funkcie bez databázy, v behu systému zatiaľ nič nevolá.
      **Poradie D75:** najprv schvaľovanie funguje → potom sa cezeň nahrajú oficiálne znenia → až potom sa odstráni skúšobný korpus. Obrátené poradie by z oficiálnych noriem urobilo druhý prípad grandfatheringu.
- [ ] **Termín potvrdenia `due` na pridelení + pripomienky pred a po ňom** — rozhodnuté 2026-09-09, spísané v `docs/ADR-004-termin-potvrdenia.md`. Otvorená je jediná vec: či po termíne pripomínať **denne** (zadanie), alebo eskalovať D+1/D+3/D+7 a potom týždenne aj personalistovi (môj návrh — denný režim po termíne je presne to, čo `api/cron/overdue` v komentári varuje, že prestane fungovať). Krok 5 mení `vercel.json`, teda produkčné nastavenie.
- [x] **Skúšobný korpus označený značkou `test`** ✅ 2026-09-07 — všetkých 10 dokumentov SFZ, `npm run tag:test -- --company SFZ --zapis`. Rozhodnutie Jána Letka: tieto znenia sú len skúšobné, ostré sa nahrajú znova a von nikdy nepôjdu.
      **Značka nič nezakazuje** — je to štítok, nie brána. Dokument so značkou `test` sa dá stále prideliť aj potvrdiť; slúži na orientáciu pri nahradzovaní. Skutočnou hranicou je tenant a doména.
      Zápis šiel cez `saveMetadata()`, nie priamo do Mongo, takže vzniklo 11 auditných záznamov. Pozor: `saveMetadata()` prepisuje **všetky** metadáta naraz — skript preto posiela aj scope, accessLevel, language a category, inak by sa stratili.
- [ ] ~~**Revízny poriadok má zástupný dátum účinnosti**~~ — bezpredmetné, kým je korpus skúšobný. Pri nahrávaní ostrých znení treba dátum z uznesenia VV SFZ (web SFZ uvádza účinnosť od 6. 12. 2023, ale autorita je uznesenie).
- [ ] **`acknowledgements.trackId` sa nikdy nevyplní** — `acknowledge()` ten údaj prijíma, ale `/api/acknowledgements` posiela natvrdo `null`. Overené na prvom ostrom potvrdení (2026-09-07). Znamená to, že zo záznamu sa nedá povedať, či človek dokument potvrdil ako krok trasy alebo z pridelenia — HR výkaz si to odvodzuje z `duties()`, ale samotný dôkaz to nenesie. Rovnaká polovica ako pri `fixes[]`: parameter existuje, cesta k nemu nie.
- [ ] **Pri nahrávaní ostrých znení porovnať dátumy s futbalsfz.sk** — skúšobný korpus mal aspoň tri staršie znenia, než SFZ zverejňuje (Disciplinárny 2023 vs 2025, Organizačný a návštevný 2014 vs 2019, Revízny zástupný). Pri ostrom nahrávaní to overiť dokument po dokumente.
- [ ] **označenie znenia „1.0" je vymyslené číslo** a objaví sa v potvrdzovacej formulke

**Rozsah C — až keď existujú ďalšie zdroje**

- [ ] kurácia (dokumenty čakajúce na kurátora, otvorený rozpor s D25)
- [ ] helpdesk (Fáza 4b)
- [ ] prípadné jednorazové hlásenia podľa D40
