# Multi-zdrojová ingescia + reconciliation číselníkov — návrh

> **Stav:** návrh na schválenie (2026-06-26). Žiadne zmeny v živom kóde.
> **Cieľ:** pridávať obsah do RAG z viacerých zdrojov (PDF/MD, **MCP konektory**, **web linky**, **API/DB**) tak, že tagovanie z číselníkov a filtre fungujú **rovnako pre každý zdroj**; a keď sa číselník zmení, vedieť **požiadať o úpravu už uložených dát** v RAG.
> **Súvisiace:** `docs/CISELNIKY_governance.md` (číselníky, validácia), `docs/rag-architecture.md` (indexy, tok), `docs/DATA_MODEL_konzistencia.md` (Model B).
> **Rozhodnutia (2026-06-26):** zdroje = MCP + web linky + API/DB; tagovanie = **vždy per-dokument (LLM návrh → kurátor)**; sync pri zmene číselníka = **change-request + dávka s náhľadom**.

---

## 1. Princíp: jeden tok, vymeniteľné adaptéry

Kľúčová myšlienka — **tagovacia a validačná vrstva sa nemení podľa zdroja.** Mení sa len to, *ako* sa obsah dostane k spoločnému medzitvaru. Od momentu „máme Markdown + metadáta o pôvode" je tok identický s tým z `CISELNIKY_governance.md` (kap. 5).

```
┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  PDF / MD   │   │ MCP konektor │   │  Web link    │   │   API / DB   │
│  (upload)   │   │ (Notion…)    │   │  (URL)       │   │  (register)  │
└──────┬──────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │  adaptér         │ adaptér          │ adaptér          │ adaptér
       └──────────────────┴───────┬──────────┴──────────────────┘
                                   ▼
                  ┌─────────────────────────────────┐
                  │  SPOLOČNÝ MEDZITVAR              │
                  │  { markdown, provenance, raw }   │
                  └─────────────────┬───────────────┘
                                    ▼
   [chunkovanie] → [LLM návrh tagov z codelists] → [kurátor review]
                 → [VALIDAČNÁ BRÁNA] → document_chunks (+ embedding)
```

Tým pádom je pridanie nového zdroja = napísať **iba adaptér**. Filtre (`sectionKey`, `companyCode`, `scope`, `accessLevel`, `language`, `tags`) sú „zadarmo", lebo vznikajú až v spoločnej vrstve.

> **Pozn. k tagovaniu (rozhodnutie 2026-06-26):** každý dokument — bez ohľadu na zdroj — prejde **per-dokument** tokom: LLM navrhne hodnoty z číselníka, kurátor potvrdí. Žiadne tiché „per-konektor" auto-tagovanie; konzistentná kvalita aj pre dôveryhodné zdroje. (Per-zdroj predvyplnenie hodnôt ako *návrh* je povolené — viď 2.4 — ale finálne potvrdzuje človek.)

---

## 2. Source adaptér — kontrakt

Každý zdroj implementuje rovnaké rozhranie. Koncepčne:

```ts
interface SourceAdapter {
  type: "file" | "mcp" | "web" | "api";
  // 1. nájde položky na import (zoznam dokumentov / stránok / záznamov)
  discover(config): Promise<SourceRef[]>;
  // 2. stiahne jednu položku
  fetch(ref: SourceRef): Promise<{ raw: Buffer|string, mime: string, meta: object }>;
  // 3. normalizuje na Markdown (PDF/HTML/JSON → MD)
  toMarkdown(raw, mime): Promise<string>;
  // 4. vyplní provenance (pôvod) — viď kap. 3
  provenance(ref): SourceProvenance;
}
```

### 2.1 Adaptér: súbory (existujúce)
PDF / MD upload. `toMarkdown` = AI konverzia (Claude, fallback llama3.2-vision) pre PDF/sken, MD priamo. `sourceType: "pdf" | "scan" | "md"`.

### 2.2 Adaptér: MCP konektory
Číta obsah cez pripojené MCP nástroje (napr. Notion, Atlassian/Confluence, Google Drive, SharePoint).
- `discover` → zoznam stránok/dokumentov cez `search`/`list` nástroj konektora.
- `fetch` → obsah konkrétnej stránky (často už Markdown/HTML).
- `provenance` → `connector` (id konektora), `externalId` (id stránky), `url`, `fetchedAt`.
- **Pozor:** rešpektovať RBAC zdroja — ak je stránka v zdroji „internal", predvyplniť `accessLevel: internal` ako *návrh* pre kurátora (kap. 2.4).
- **Oprávnenia (rozhodnuté 2026-06-26):** import beží pod **servisným účtom** (nie v kontexte konkrétneho používateľa). Dôsledky: stabilný a predvídateľný rozsah viditeľnosti, import nezávisí od toho, kto ho spustil. Servisný účet musí mať v zdroji prístup k všetkému, čo sa má indexovať; jeho rozsah je bezpečnostné rozhodnutie a treba ho zdokumentovať. `accessLevel` v RAG sa rieši samostatne (RBAC pri dotaze), nie cez práva servisného účtu.

### 2.3 Adaptér: web linky (jednorazové URL)
Používateľ vloží URL → stiahnutie HTML → čistenie (boilerplate removal) → Markdown.
- `sourceType: "web"`, `provenance.url`, `contentHash` z normalizovaného textu.
- Klientsky renderované stránky: ak `fetch` vráti prázdny shell, eskalovať na render s JS (browser), inak označiť ako neúspešné.
- **Bezpečnosť:** web obsah je *nedôveryhodný* — vždy plný per-dokument review, žiadne predvyplnené dôveryhodné defaulty okrem `accessLevel: public`.

### 2.4 Adaptér: API / DB
Štruktúrované zdroje (interný register, vlastné API). `fetch` vráti JSON/riadky → `toMarkdown` ich vyrenderuje do čitateľného textu (alebo sa indexujú polia priamo).
- `sourceType: "api"`, `provenance.connector`, `externalId` = primárny kľúč záznamu.
- Mapovanie polí zdroja → odporúčané hodnoty číselníka môže byť deterministické (napr. stĺpec „zväz" → `companyCode`), ale stále ako **návrh** pre review.

> **Predvyplnenie ≠ auto-zápis.** Adaptér smie *navrhnúť* hodnoty filtrov (z RBAC zdroja, z polí, z domény URL). Finálne ich potvrdzuje kurátor cez rovnakú validačnú bránu. To drží kvalitu a zároveň šetrí prácu pri hŕbe obsahu.

---

## 3. Provenance — pôvod obsahu (nutné pre re-sync a reconciliation)

Aby sa obsah dal neskôr **re-fetchnúť, re-tagovať a auditovať**, každý dokument si nesie pôvod. Rozširuje existujúce polia v `documents` (`sourceType`, `sourceUrl`, `contentHash`).

### `documents.source` (nové / rozšírené)
```js
source: {
  type: "file" | "mcp" | "web" | "api",   // hrubý typ zdroja
  sourceType: "pdf",                        // jemný (codelist sourceType)
  connector: "atlassian",                   // id MCP/API konektora (null pre file/web)
  externalId: "PAGE-12345",                 // id v zdrojovom systéme (pre re-fetch)
  url: "https://…",                         // ak existuje
  fetchedAt: ISODate,                       // kedy naposledy stiahnuté
  contentHash: "sha256…",                   // detekcia zmien (re-import len ak sa zmenilo)
  adapterVersion: "1"                       // verzia adaptéra (reproducibilita)
}
```

### Dôsledok pre `document_chunks`
Chunk už nesie tagy (`sectionKey`, `companyCode`, …) + `documentId`/`versionId`. Cez `documentId` sa vždy dohľadá `source`. **Netreba duplikovať provenance na chunk** — stačí väzba na dokument. To je dôležité pre reconciliation: vieme, ktorý zdroj/ktorá hodnota číselníka kde je.

> **Rozšírenie `sourceType` (codelist):** pôvodný uzavretý enum `pdf/web/scan` sa rozširuje o `md`, `mcp`, `api`. Keďže `sourceType` je `closed: true`, zmena ide cez seed v repe (PR). Vzor `app/src/codelists/sourceType.json` aktualizovaný.

---

## 4. Re-sync zdrojov (obsah sa zmenil v zdroji)

Oddelený problém od reconciliation číselníkov — tu sa mení **obsah**, nie tag.
- **Change detection:** porovnaj `contentHash` pri opakovanom `fetch`. Ak rovnaký → preskoč. Ak iný → nová verzia dokumentu (`versionId`), staré chunky `isActive: false`, nové sa znova otagujú per-dokument.
- **MCP/API:** ak konektor poskytuje `lastModified`/`updatedAt`, použiť ho pred sťahovaním (lacnejšie než hash).
- **Web linky:** jednorazové = bez auto-sync; opakovaný import na požiadanie. (Periodický crawl celých domén je samostatná Fáza 6, mimo tohto návrhu.)

---

## 5. Reconciliation — zmena v číselníku → úprava dát v RAG

Toto je jadro tvojej požiadavky: *„keď sa niečo zmení v číselníkoch, dať sa požiadať o zmenu dát v RAG."*

### 5.1 Prečo je to lacné
Tag (`sectionKey`, `companyCode`, …) je **metadáta**, nie text. Pri jeho zmene sa **nemení `text` ani `embedding`** — netreba znova volať Voyage. Ide len o `updateMany` nad `document_chunks` + prípadný preindex filtrovaného poľa v Atlas. To je rádovo lacnejšie a rýchlejšie než re-ingescia.

### 5.2 Typy zmien a ich dopad

| Operácia na číselníku | Dopad na dáta | Akcia |
|---|---|---|
| **Relabel** (zmena `label`) | žiadny — `key` ostáva | nič (chunky držia `key`, nie `label`) |
| **Deactivate** (`isActive: false`) | chunky s hodnotou „osirejú" (nový filter ich nenájde) | vyžiadať remap alebo archiváciu dotknutých chunkov |
| **Rename key** (starý → nový) | filter prestane sedieť | dávkový remap `oldKey → newKey` |
| **Merge** (viac → jeden) | viac hodnôt zlúčiť | remap `{k1,k2} → k` |
| **Split** (jeden → viac) | nejednoznačné | re-klasifikácia dotknutých chunkov (LLM + review), nie automatický remap |

> **Pravidlo:** `key` je nemenný „natvrdo" (viď governance kap. 4). „Rename key" sa preto **technicky realizuje ako merge**: pridá sa nový `key`, starý sa deaktivuje a chunky sa remapujú. Tým ostáva história čistá.

### 5.3 Mechanizmus: change-request + náhľad (rozhodnuté)

Nová kolekcia `codelist_change_requests`:
```js
{
  _id,
  codelist: "sectionKey",
  op: "rename" | "merge" | "split" | "deactivate",
  from: ["stara_sekcia"],          // dotknuté kľúče
  to:   ["nova_sekcia"],           // cieľ (prázdne pre deactivate; viac pre split)
  filterScope: { companyCode: "SsFZ" },  // voliteľné zúženie (len časť dát)
  status: "draft"|"previewed"|"approved"|"executing"|"done"|"rolledback",
  preview: {
    affectedChunks: 0,
    affectedDocs: 0,
    documents: [                   // PLNÝ zoznam dotknutých dokumentov (rozhodnuté)
      { documentId, title, source: { type, connector, url }, chunkCount }
    ]
  },
  snapshotId: "…",                 // pre rollback — drží sa len 1 level (posledná zmena)
  createdBy, approvedBy, createdAt, executedAt
}
```

**Tok:**
```
[1] Návrh zmeny (kurátor / admin UI alebo dôsledok editu číselníka)
        │
        ▼
[2] PREVIEW — systém spočíta dotknuté chunky/dokumenty
    cez document_chunks.find({ <pole>: { $in: from }, ...filterScope })
    → PLNÝ zoznam dotknutých dokumentov (id, názov, zdroj, počet chunkov)
        │
        ▼
[3] Schválenie kurátorom (vidí celý zoznam dopadu pred vykonaním)
        │
        ▼
[4] EXECUTE — dávkový updateMany (remap hodnoty), bez re-embed
    + snapshot starých hodnôt (rollback, 1 level)
    + (ak treba) trigger Atlas reindex filtrovaného poľa
        │
        ▼
[5] LOG + možnosť ROLLBACK zo snapshotu (len posledná zmena)
```

> **Rollback retencia (rozhodnuté 2026-06-26): 1 level.** Drží sa snapshot **len poslednej** vykonanej zmeny daného číselníka — umožní vrátiť práve uskutočnený remap. Staršie snapshoty sa po úspešnom vykonaní novej zmeny zahodia. Pre hlbšiu históriu slúži audit log (kto/kedy/čo), nie dáta na rollback.

### 5.4 Osirené chunky (orphaned)
Ak sa hodnota deaktivuje **bez** remapu, chunky s ňou ostanú v DB, ale **nový filter ich nenájde** (query používa len aktívne kľúče — governance kap. 5.3). Preto:
- preview pri `deactivate` vždy hlási počet osirených chunkov,
- kurátor musí zvoliť: *remap na inú hodnotu* alebo *archivovať* (`isActive: false` na chunku) alebo *re-klasifikovať*.
- Voliteľný „health check" job: periodicky hľadá chunky, ktorých tag nie je v aktívnom číselníku, a hlási ich.

### 5.5 Konzistencia s dotazom
Po reconciliation musí query-time filter používať **nové** kľúče. Keďže oboje (ingescia aj dotaz) čítajú z `codelists` (governance kap. 5.3), stačí aktualizovať číselník — filter sa prispôsobí automaticky. Bez toho by remap dát a filter v dotaze rozišli.

---

## 6. Naviazanie na fázy

| Krok | Fáza | Poznámka |
|---|---|---|
| Source adaptér: rozhranie + file (PDF/MD) | **Fáza 4** | refaktor existujúcej ingescie do adaptéra |
| Provenance polia v `documents` + `sourceType` rozšírenie | **Fáza 4** | seed update hotový (vzor) |
| Adaptér: web linky (jednorazové URL) | **Fáza 4 / 6** | čistenie HTML → MD |
| Adaptér: MCP konektory | **Fáza 6+** | závisí od pripojených MCP serverov |
| Adaptér: API / DB | **Fáza 6+** | per zdroj |
| Re-sync (hash/lastModified) | **Fáza 6** | naviazať na Change detection v pláne |
| `codelist_change_requests` + preview + execute | **Fáza 4b** | po zavedení `codelists` |
| Health check osirených chunkov | **Fáza 6** | monitoring |

---

## 7. Rozhodnutia a otvorené otázky

**Uzavreté (2026-06-26):**

3. **Re-fetch oprávnenia pre MCP** — import beží pod **servisným účtom** (nie v kontexte používateľa). Viď kap. 2.2.
4. **Rollback retencia** — **1 level** (drží sa snapshot len poslednej zmeny daného číselníka). Viď kap. 5.3.
5. **Granularita preview** — **plný zoznam dotknutých dokumentov** pred schválením. Viď kap. 5.3.

**Odložené (rieši sa neskôr, nie teraz):**

1. **Poradie MCP konektorov** — neurčené. Adaptéry sa budú robiť podľa neskoršej priority.
2. **API/DB zdroje** — konkrétne registre a formát zatiaľ neurčené.
