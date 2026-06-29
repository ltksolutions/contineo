# CMS — Koncepčný návrh (Contineo)

> **Stav:** návrh na diskusiu (2026-06-29). Žiadne zmeny v živom kóde.
> **Cieľ:** zadefinovať CMS ako jadro obsahovej vrstvy Continea. CMS má **tri zodpovednosti**:
> 1. **media manager** — správa dokumentov, ktoré workre spracujú do RAG,
> 2. **content engine** — zdroj obsahu pre generovanie **verejného webu (knowledge base / helpdesk)**,
> 3. **správa vstupných kanálov** — odkiaľ a ako obsah do CMS prichádza.
> **Nadväzuje na:** `DATA_MODEL_konzistencia.md` (Model B), `CISELNIKY_governance.md` (tagy/validácia), `INGESTION_zdroje_reconciliation.md` (source adaptéry, reconciliation), `PRISTUPOVE_PRAVA.md` (RBAC/ABAC, 2 režimy nasadenia), `rag-architecture.md` (kolekcie, indexy).
> **Zámerne nerieši:** konkrétny UI dizajn, výber editor knižnice, finálny tech-stack admin rozhrania — to príde po schválení konceptu.
>
> **Doménová univerzálnosť:** Contineo (contineo.app) je **univerzálna aplikácia** pre ľubovoľnú organizáciu s vlastným obsahom (firmy, inštitúcie, zväzy…). Futbalové/SFZ príklady v tomto dokumente (`companyCode: SsFZ`, „normy", „precedencia noriem", „legislatívec") sú **iba ukážka nasadenia do veľkej organizácie**, nie obmedzenie produktu. Všetky koncepty (číselníky, multi-tenant hierarchia, RBAC, kurácia) sú doménovo neutrálne — „norma" je len jeden druh dokumentu, „zväz" je len jeden druh tenanta.

---

## 0. Pozícia CMS v systéme

CMS je **jediné miesto pravdy pre obsah**. Všetok obsah doň vstupuje cez kanály, je v ňom spravovaný a kurovaný, a z neho vystupuje do dvoch cieľov: do RAG (na vyhľadávanie/odpovede) a na verejný web (KB/helpdesk).

```
   VSTUPNÉ KANÁLY                 CMS (jadro)                    VÝSTUPY
┌──────────────────┐      ┌───────────────────────┐      ┌────────────────────┐
│ upload (PDF/MD)  │      │  documents (knižnica)  │  ──► │  RAG pipeline       │
│ MCP konektory    │ ───► │  + verzie, stavy,      │      │  (document_chunks,  │
│ web linky (URL)  │      │    tagy z číselníkov,  │      │   vyhľadávanie)     │
│ API / DB         │      │    provenance          │      ├────────────────────┤
│ (helpdesk: web   │      │  web obsah (články,    │  ──► │  PUBLIC WEB         │
│  widget / e-mail)│      │   FAQ, stránky, navig.)│      │  (KB / helpdesk,    │
└──────────────────┘      └───────────────────────┘      │   SK/EN)            │
                                     ▲                     └────────────────────┘
                          kurátor / admin (review, publish)
```

**Kľúčové rozlíšenie dvoch typov obsahu v CMS:**

| | **Dokument (norma/predpis/manuál)** | **Web obsah (článok/FAQ/stránka)** |
|---|---|---|
| Primárny účel | zdroj pre RAG vyhľadávanie | čítanie ľuďmi na verejnom webe |
| Pôvod | upload, MCP, web, API | ručne napísaný kurátorom / odvodený z `qa_pairs` |
| Štruktúra | originálny súbor + Markdown + § citácie | Markdown + SEO meta + zaradenie do navigácie |
| Verzovanie | `effectiveFrom/To`, `isActive` (právna platnosť) | draft/publish, plánované publikovanie |
| Môže ísť do RAG? | **áno** (primárne) | **voliteľne** (článok ako zdroj odpovede) |
| Môže ísť na web? | voliteľne (link na originál / náhľad) | **áno** (primárne) |

> Tieto dva typy **nie sú oddelené systémy** — žijú v jednom CMS a zdieľajú tagovanie z číselníkov, RBAC a kurátorský review. Líšia sa životným cyklom a cieľom publikovania.

---

## Časť A — CMS ako media manager pre RAG

### A.1 Knižnica dokumentov

Centrálny zoznam nad kolekciou `documents` (Model B). Funkcie:

- **Zoznam + filtre** podľa číselníkových polí: `sectionKey`, `companyCode`, `scope`, `accessLevel`, `language`, `category`, `sourceType`, `tags`, stav spracovania, stav publikácie.
- **Detail dokumentu**: metadáta, originálny súbor (`originalFile.blobUrl`), vygenerovaný Markdown, provenance (`source.*`), zoznam vytvorených chunkov, história verzií.
- **Hromadné akcie**: re-tag, re-process, archivácia, zmena `accessLevel` (cez review).
- **Vyhľadávanie v knižnici** (oddelene od RAG dotazu — admin pohľad).

### A.2 Životný cyklus dokumentu

Dva ortogonálne stavy — **stav spracovania** (technický, čo robia workre) a **stav obsahu** (kurátorský/publikačný). Dnes `documents.status` má len `draft|published`; navrhujeme to rozšíriť.

```
STAV SPRACOVANIA (processingStatus)        STAV OBSAHU (status)
────────────────────────────────          ───────────────────────
uploaded                                    draft
  → converting   (PDF/scan → MD)              → in_review   (kurátor tagy/obsah)
  → chunking                                  → published   (v RAG / na webe)
  → embedding    (Voyage auto-embed)          → archived    (isActive:false)
  → indexed      (hotovo, v Atlas)
  → failed       (chyba — s dôvodom)
```

- **Spracovanie a publikovanie sú nezávislé.** Dokument môže byť `indexed` (technicky pripravený) a zároveň `in_review` (kým ho kurátor neschváli, nejde do produkčného filtra). Do RAG dotazu vstupujú len `published` + `isActive` chunky.
- **`failed`** vždy nesie dôvod (konverzia zlyhala, embedding timeout, validačná brána zablokovala chýbajúci povinný tag) a umožní retry.

### A.3 Verzovanie

- Nová verzia dokumentu = nový `versionId`; staré chunky `isActive:false`, nové sa znova otagujú per-dokument (viď `INGESTION` kap. 4 re-sync).
- **Právna platnosť** cez `effectiveFrom/effectiveTo` + `isActive` (D6) — oddelené od „technicky najnovšia verzia". Default v dotaze = platná dnes.
- História verzií viditeľná v detaile; možnosť porovnať a vrátiť sa.

### A.4 Tagovanie a kurátorský review

Plne nadväzuje na `CISELNIKY_governance.md` a per-dokument tok z `INGESTION`:

1. **LLM návrh** hodnôt z číselníka (+ confidence) — bez ohľadu na zdroj.
2. **Review UI**: dropdowny napĺňané z kolekcie `codelists`, predvyplnené návrhom LLM; kurátor potvrdí/opraví.
3. **Validačná brána** (closed vocabulary): BLOCK ak chýba povinný tag alebo hodnota nie je v aktívnom číselníku → dokument ostáva `in_review`/`failed`, nedostane sa do `document_chunks`.

### A.5 Náhľad chunkov a re-processing

- Náhľad, ako sa dokument rozsekal na chunky (hranice noriem + breadcrumb, D1), s ich tagmi a `articleRef`.
- **Re-chunk / re-embed** na požiadanie (napr. po zmene chunkovacej stratégie).
- **Re-tag** bez re-embed (tag je metadáta — lacné, viď reconciliation kap. 5.1 v `INGESTION`).

### A.6 Prepojenie na reconciliation a provenance

- Pri zmene číselníka beží `codelist_change_requests` (preview → approve → execute) nad chunkmi dokumentu — CMS je miesto, kde kurátor vidí **plný zoznam dotknutých dokumentov** a schvaľuje.
- Každý dokument nesie `source.*` (typ, konektor, externalId, url, fetchedAt, contentHash, adapterVersion) pre re-fetch a audit.

---

## Časť B — CMS ako obsah pre public web (verejná KB / helpdesk)

> **Toto je doteraz neprebraná časť.** Public web je dnes len marketingová stránka (`web/`, i18n `[lang]` SK/EN). Tu navrhujeme, ako z CMS generovať **verejnú knowledge base / helpdesk**.

### B.1 Typy web obsahu

| Typ | Popis | Príklad |
|---|---|---|
| **KB článok** | kurátorský návod/vysvetlenie, Markdown, zaradený do kategórie | „Ako zaregistrovať hráča" |
| **FAQ** | otázka + odpoveď; často odvodené zo schválených `qa_pairs` | „Dokedy platí registrácia?" |
| **Kategória / rozcestník** | zoskupenie článkov, landing pre tému | „Registrácie", „Súťaže" |
| **Statická stránka** | O projekte, Kontakt, GDPR, Podmienky | `/o-nas`, `/gdpr` |
| **Navigácia** | menu, breadcrumb, poradie sekcií | hlavné menu KB |
| **Oznam / aktualita** | časovo viazaný obsah (voliteľné) | „Nový súťažný poriadok od …" |

### B.2 Vzťah ku RAG (obojsmerný)

Toto je najsilnejšia synergia a treba ju rozhodnúť explicitne:

- **RAG → web:** schválená dvojica `qa_pairs` (D11 — kurovaná odpoveď) sa môže **publikovať ako FAQ článok**. Z reálnych otázok používateľov tak rastie verejná KB.
- **Web → RAG:** KB článok môže byť zároveň **zdroj pre RAG** (`accessLevel: public`), aby chatbot odpovedal aj z kurátorských článkov, nielen z noriem.
- **Norma → web:** norma sa na webe nezobrazuje celá ako „článok", ale ako **kanonický odkaz/náhľad** (názov, sekcia, platnosť, link na originál) — kurátorský výklad ostáva v KB článku.

### B.3 Publikačný workflow

```
draft  →  in_review  →  scheduled (voliteľné)  →  published  →  unpublished/archived
```

- **Plánované publikovanie** (`publishAt`) a stiahnutie (`unpublishAt`).
- **Verzie web obsahu** oddelené od právneho verzovania noriem (tu ide o redakčné verzie).
- **Náhľad pred publikovaním** (preview URL).

### B.4 i18n (SK/EN)

- Nadväzuje na existujúci `[lang]` routing a `web/lib/dictionaries.js`.
- Každý web obsah má jazykové varianty; **EN preklad** ako návrh (AI) → kurátor potvrdí (rovnaký princíp ako tagovanie; rozhodnuté — D-CMS-5).

### B.5 Generovanie webu

- **SSG/ISR** z CMS (Next.js) — pri publikovaní sa stránka pregeneruje; revalidácia on-publish.
- **SEO**: `slug`, meta title/description, OG, `sitemap.js`/`robots.js` (už existujú) sa rozšíria o KB obsah; štruktúrované dáta (`JsonLd.js`) pre FAQ/článok.
- **Prístup:** verejná KB = anonymná (`accessLevel: public`); **interná KB** pre prihlásených cez SSO (public + internal) — nadväzuje na 2 režimy nasadenia z `PRISTUPOVE_PRAVA.md`.
- **Vyhľadávanie na webe** môže využiť rovnaký RAG/fulltext nad `public` obsahom.

### B.6 Helpdesk väzba

- Verejný web hostí **chat widget** (D14, s `companyCode` kontextom + rate-limit) a vstup do **helpdesku** (kolekcia `tickets`).
- Z konverzácie/ticketu, ktorý sa vyrieši, môže vzniknúť KB článok (zatváranie slučky: otázka → odpoveď → publikovaná znalosť).
- E-mail z helpdesku sa **nikdy neodosiela automaticky** (D12) — vždy cez review.

---

## Časť C — Správa vstupných kanálov

### C.1 Čo je „kanál"

**Kanál = nakonfigurovaná, pomenovaná inštancia source adaptéra** (z `INGESTION` kap. 2) plus jej nastavenia, plán a predvolené hodnoty. Adaptér je *technika* (ako stiahnuť obsah); kanál je *spravovaná konfigurácia* (konkrétny Notion priestor, konkrétny register, konkrétny e-mail box).

### C.2 Kolekcia `channels` (návrh)

```js
{
  _id,
  name: "Notion — Smernice SsFZ",
  type: "file" | "mcp" | "web" | "api" | "email",
  adapter: "atlassian" | "notion" | "web" | "registerXY" | ...,
  config: { /* per-adaptér: priestor, dotaz, URL zoznam, API endpoint, mailbox */ },
  defaults: {                       // NÁVRHY tagov, nie auto-zápis
    companyCode: "SsFZ", scope: "company", accessLevel: "internal", language: "sk"
  },
  schedule: "manual" | "cron(…)",   // D13: crawl manuálne/on-demand; web jednorazové
  serviceAccount: "svc-import",     // MCP beží pod servisným účtom (rozhodnuté)
  status: "active" | "paused" | "error",
  lastRunAt, lastRunStatus,
  createdBy, createdAt
}
```

### C.3 História behov — `channel_runs` (návrh)

```js
{
  _id, channelId, startedAt, finishedAt,
  trigger: "manual" | "scheduled",
  discovered: 12, fetched: 12, new: 3, changed: 2, skipped: 7, failed: 0,
  items: [ { externalId, title, result: "new"|"changed"|"skipped"|"failed", error? } ],
  log: "…"
}
```

### C.4 Admin funkcie nad kanálmi

- **CRUD kanálov** + test pripojenia (`discover` na sucho).
- **Spustiť teraz** (manual run) / **naplánovať** (Fáza 6 scheduler).
- **Monitoring**: prehľad behov, počty new/changed/failed, alert pri chybe.
- **Fronta na review**: položky stiahnuté kanálom čakajú na per-dokument review (A.4) — kanál nikdy nepublikuje priamo do RAG bez kurátora (okrem dôveryhodných defaultov ako návrh).
- **Change detection**: re-sync cez `contentHash`/`lastModified` (`INGESTION` kap. 4).

### C.5 Špeciálne kanály

- **Web widget / e-mail ako helpdesk vstup**: nie sú zdroj „dokumentov" pre RAG, ale vstup **tiketov/konverzácií**. Modelovo ich tiež vedieme ako kanály (typ `email`/`widget`), aby bola správa vstupov jednotná. **Poradie (D-CMS-3): najprv web widget, e-mailový kanál ako druhý krok** — hoci e-mail je dnes hlavný kanál otázok, cieľom je presun používateľov na widget.
- **API/DB registre**: poradie a formát zatiaľ neurčené (odložené v `INGESTION` kap. 7).

---

## D. Dátový model — nové a rozšírené kolekcie

| Kolekcia | Stav | Účel |
|---|---|---|
| `documents` | **rozšíriť** | + `processingStatus`, `contentType` (`document`/`web`), `webPublish` (slug, seo, navParent, publishAt), `versions[]`. **Web obsah žije tu (D-CMS-1)** — žiadna samostatná kolekcia. |
| `document_chunks` | bez zmeny | RAG chunky (Model B) |
| `qa_pairs` | existuje (Fáza 4b) | kurované odpovede; zdroj pre FAQ na webe |
| `tickets` | existuje (plán) | helpdesk; väzba na konverzácie a na KB |
| ~~`web_pages`~~ | **zamietnuté** | web obsah nie je samostatná kolekcia — žije v `documents` cez `contentType` (D-CMS-1) |
| `navigation` | **nová** | menu/štruktúra verejnej KB (poradie, hierarchia, jazyk) |
| `categories` | **nová** | kategórie/rozcestníky KB |
| `channels` | **nová** | nakonfigurované vstupné kanály |
| `channel_runs` | **nová** | história a monitoring behov kanálov |
| `cms_users` / `cms_uploaders` | existuje (plán) | allowlist + roly v CMS |

> **Princíp konzistencie:** všetky doménové polia ostávajú z číselníkov (`codelists`), názvoslovie Model B, polia v camelCase, `companyCode`/`accessLevel` význam nezmenený.

---

## E. Roly a oprávnenia v CMS

Nadväzuje na `PRISTUPOVE_PRAVA.md` — **práva v CMS sa neodvodzujú z rolí sportnet.online**, ale z ručného allowlistu (`cms_uploaders`).

| Rola | Môže |
|---|---|
| **Admin** | správa kanálov, číselníkov, používateľov CMS, reconciliation execute |
| **Kurátor** | upload/import, tagovanie a review, publish do RAG aj na web, qa_pairs→FAQ |
| **Redaktor (web)** | tvorba a publikovanie web obsahu (KB/FAQ/stránky), bez správy číselníkov |
| **Legislatívec** *(konzultačná)* | potvrdenie precedencie noriem (D5), platnosti `effectiveFrom/To` |
| **Čitateľ (interný)** | prístup k internej KB cez SSO (nie editácia) |

---

## F. Hlavné user flows

1. **Norma do RAG**: kurátor nahrá PDF → `converting`→`indexed`; LLM navrhne tagy → kurátor potvrdí (validačná brána) → `published` → vstupuje do dotazu.
2. **KB článok na web**: redaktor napíše Markdown → zaradí do kategórie/navigácie → preview → `published`; voliteľne `accessLevel:public` aj do RAG.
3. **FAQ z reálnej otázky**: schválený `qa_pair` → kurátor jedným krokom publikuje ako FAQ na web.
4. **Nový kanál**: admin vytvorí MCP kanál (Notion) → test `discover` → naplánuje sync → stiahnuté položky padnú do review fronty → kurátor potvrdí.
5. **Zmena číselníka**: admin spustí change-request → preview dotknutých dokumentov → approve → batch remap (bez re-embed) → rollback 1 level k dispozícii.

---

## G. Naviazanie na fázy

| Oblasť | Fáza | Poznámka |
|---|---|---|
| Knižnica dokumentov, processing stavy, review UI | **Fáza 4 (Import & CMS)** | jadro media managera |
| Verzovanie noriem (`effectiveFrom/To`, `isActive`) | **Fáza 4 / 5** | D6 |
| Reconciliation UI (`codelist_change_requests`) | **Fáza 4b** | preview/approve/execute |
| qa_pairs kurácia → FAQ | **Fáza 4b** | zatváranie slučky |
| Web obsah (KB/FAQ/stránky), generovanie, i18n | **nová Fáza (CMS-Web)** | doteraz neplánované — pridať do roadmapy |
| Správa kanálov (`channels`, `channel_runs`, monitoring) | **Fáza 6 (Scheduler & monitoring)** | adaptéry MCP/API tu |
| Helpdesk (`tickets`, widget, e-mail) | **samostatná feature-fáza** | D12, D14 |

---

## H. Rozhodnutia (uzavreté 2026-06-29)

- **D-CMS-1 — Úložisko web obsahu:** **rozšíriť `documents` o `contentType`** (`document` | `web`); web-špecifické polia v podobjekte `webPublish`. Jeden review/RBAC/tagging tok pre všetok obsah, žiadny druhý systém.
- **D-CMS-2 — Editor:** **Markdown + náhľad**, s WYSIWYG vrstvou nad Markdownom (Markdown ostáva kanonické úložisko; WYSIWYG je len komfortný editor nad ním).
- **D-CMS-3 — E-mail ako kanál:** **štart cez web widget vložený do stránky; e-mailový kanál ako druhý krok.** E-mail je dnes hlavný kanál, ktorým sa používatelia obracajú s otázkami, ale cieľom je presun na widget. Helpdesk preto najprv postavíme na widgete (`tickets` + `channels`), e-mailový adaptér sa doplní na tej istej štruktúre ako ďalší kanál.
- **D-CMS-4 — Verejná KB zdroj:** **len kurátorské články + kanonický odkaz na normu** — žiadne automatické generovanie článkov z noriem (kvalita, žiadne halucinácie).
- **D-CMS-5 — EN preklady:** **AI-návrh → kurátor potvrdí** (rovnaký princíp ako tagovanie).
- **D-CMS-6 — Priame publikovanie z dôveryhodného kanála:** **nie** — kanál smie hodnoty len *predvyplniť ako návrh*, finálny publish vždy potvrdzuje človek (drží kvalitu).

> Po uzavretí týchto rozhodnutí ich preniesť aj do `OPEN_DECISIONS.md` (ako D16+) pri najbližšej revízii backlogu.

---

*Dokument je zámer a podklad na diskusiu. Po odsúhlasení doplniť do `TODO.md`, `CHANGELOG.md` a roadmapy (`web/components/Roadmap.js`) a prípadne založiť D16+ v `OPEN_DECISIONS.md`.*
