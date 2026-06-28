# Centrálne číselníky pre indexovanie obsahu — návrh a governance

> **Stav:** návrh na schválenie (aktualizované 2026-06-26). Žiadne zmeny v živom kóde; vzory číselníkov publikované v `app/src/codelists/`.
> **Cieľ:** každý obsah pridaný do RAG je už na vstupe správne „popísaný" — povinné parametre sa priraďujú **výhradne z centrálnych číselníkov**, nie voľným textom.
> **Naviazanie:** Fáza 4 (Import & CMS) a Fáza 5 (Prístupové úrovne) v `docs/Contineo_RAG_Projektovy_plan.md`.
> **Súvisiace:** `docs/DATA_MODEL_konzistencia.md` (Model B), `docs/rag-architecture.md` (indexy, tok dotazu), `docs/INGESTION_zdroje_reconciliation.md` (multi-zdrojová ingescia + reconciliation pri zmene číselníka), `docs/PRISTUPOVE_PRAVA.md` (RBAC/ABAC + tenant izolácia).
>
> **Zmena 2026-06-26:** pole `associationCode` premenované na **`companyCode`** (význam ostáva: *pre koho obsah platí*); `scope` hodnota `association` → **`company`**; `sectionKey` je **hierarchický** (parent → sekcia); historické chunky sa pri migrácii **preznačkujú**.

---

## 1. Prečo centrálne číselníky

Z hybridnej schémy vyhľadávania (`$rankFusion` vektor + fulltext, `filter: { sectionKey, companyCode, isActive … }`) vyplýva jednoduchá pravda: **filter rozhoduje skôr ako sémantika.** Ak je chunk otagovaný nesprávnou alebo neexistujúcou hodnotou (`sectionKey: "sutazny-poriadok"` vs `"sutazny_poriadok"`), žiadny embedding ho nevytiahne — filter ho odreže ešte pred porovnaním vektorov aj pred fulltextom.

Voľný text v poliach ako `sectionKey`, `companyCode`, `scope` je preto najväčšie riziko kvality. Centrálny číselník zabezpečí, že:

- existuje **jediný zoznam povolených hodnôt** pre každý riadený parameter,
- hodnota je **rovnaká pri ingescii aj pri dotaze** (inak filter nikdy nesadne),
- nové hodnoty vznikajú **kontrolovane** (governance), nie preklepom pri importe,
- vektor index aj fulltext index používajú **tú istú doménu hodnôt**.

Princíp: **„closed vocabulary" pre povinné parametre.** Čo nie je v číselníku, sa do `document_chunks` nedostane.

---

## 2. Katalóg riadených parametrov

Všetky parametre nižšie sú **povinné** a viazané na číselník. Polia zodpovedajú Modelu B (`document_chunks`) podľa `DATA_MODEL_konzistencia.md`.

| Parameter | Pole v `document_chunks` | Typ číselníka | Použité v indexe | Povinné |
|---|---|---|---|---|
| Sekcia normy | `sectionKey` | **hierarchický** (parent → sekcia) | vektor `filter` + fulltext `token` | áno |
| Pre koho platí | `companyCode` | plochý, viazaný na zoznam firiem/organizácií | vektor `filter` + fulltext `token` | áno |
| Úroveň platnosti | `scope` | enum (3 hodnoty) | vektor `filter` + fulltext `token` | áno |
| Viditeľnosť / RBAC | `accessLevel` | enum (2 hodnoty) | vektor `filter` + fulltext `token` | áno |
| Jazyk obsahu | `language` | enum (ISO 639-1) | vektor `filter` | áno |
| Kategória dokumentu | `category` | plochý, na úrovni `documents` | (CMS, filter voliteľne) | áno |
| Typ zdroja | `sourceType` | enum | (CMS) | áno |
| Voľné štítky | `tags` | **riadený slovník** (controlled) | fulltext `string` | nie* |

\* `tags` ostávajú voliteľné (môže byť 0 štítkov), ale ak sú vyplnené, **musia** pochádzať z riadeného slovníka — žiadny „free text".

> **Pozn. k ortogonalite (z `DATA_MODEL_konzistencia.md`):** `accessLevel` = *kto* smie vidieť (public/internal, RBAC). `scope` + `companyCode` = *na koho* sa obsah vzťahuje. Sú to dve nezávislé vrstvy a obe existujú súčasne — nepliesť ich.

### 2.1 Detail hodnôt (seed — návrh / kostra)

**`scope`** (enum, uzavretý):

| Hodnota | Význam |
|---|---|
| `global` | platí celoštátne / pre všetkých |
| `company` | platí pre konkrétnu firmu/organizáciu (`companyCode`) |
| `region` | platí pre oblasť / región |

**`accessLevel`** (enum, uzavretý):

| Hodnota | Význam |
|---|---|
| `public` | verejný obsah, dostupný bez prihlásenia |
| `internal` | iba prihlásení interní používatelia |

**`companyCode`** (číselník, rozšíriteľný cez governance):

| Kód | Názov | Poznámka |
|---|---|---|
| `SFZ` | Slovenský futbalový zväz | `SFZ` = platí pre všetkých (nadradený) |
| `SsFZ` | Stredoslovenský futbalový zväz | regionálna organizácia |
| … | (doplniť ostatné firmy/organizácie) | governance |

**`sectionKey`** (číselník, **hierarchický** — najdôležitejší routing filter). Hierarchia cez pole `parent`: nadradená skupina (`parent: null`) → konkrétna sekcia (`parent: <kľúč skupiny>`). Kostra:

| Kľúč | Parent | Sekcia |
|---|---|---|
| `normy` | — | Normy a poriadky (skupina) |
| `sutazny_poriadok` | `normy` | Súťažný poriadok |
| `prestupovy_poriadok` | `normy` | Prestupový poriadok |
| `…` | `…` | (doplniť podľa reálneho korpusu) |

> **Konvencia kľúčov:** `snake_case`, bez diakritiky, ASCII, stabilné (kľúč sa nikdy nemení — mení sa len `label`). Diakritika a pekný názov idú do `label`, nie do kľúča. Pri filtrovaní možno filtrovať na konkrétnu sekciu (`sutazny_poriadok`) alebo na celú skupinu cez `parent`.

**`sourceType`** (enum): `pdf`, `web`, `scan`.
**`category`** (číselník na úrovni `documents`): napr. `norma`, `smernica`, `zakon`, `manual`, `metodicky_pokyn` — doplniť podľa korpusu.
**`language`** (ISO 639-1): počiatočne `sk`; pripraviť `cs`, `en` ak pribudne obsah.
**`tags`** (riadený slovník): tematické štítky ako `registracia`, `start_hraca` — slúžia na fulltext, nie na tvrdé filtrovanie. Sú riadené, aby sa nerozsypali na synonymá.

> Reálne počiatočné hodnoty sú publikované ako vzory v `app/src/codelists/` (kostra + 1–2 príklady na číselník).

---

## 3. Úložisko a štruktúra číselníkov

**Rozhodnutie: hybrid.** Zdroj pravdy je **verzovaný seed v repe**, runtime kópia žije v **MongoDB kolekcii `codelists`** (spravovateľná cez admin/CMS). Repo = auditovateľnosť a review cez git; DB = rýchle čítanie a UI správa.

### 3.1 Kolekcia `codelists` (MongoDB)

Jedna kolekcia pre všetky číselníky, rozlíšené poľom `codelist`:

```js
{
  _id,
  codelist: "sectionKey",        // ktorý číselník
  key: "sutazny_poriadok",       // strojová hodnota (ide do document_chunks)
  label: "Súťažný poriadok",     // zobrazované meno (SK, s diakritikou)
  description: "",               // voliteľný popis pre kurátora
  parent: "normy",              // hierarchia (sectionKey); inak null
  isActive: true,                // deaktivácia bez mazania
  sortOrder: 10,
  synonyms: ["SP"],              // pomôcka pre LLM klasifikátor a vyhľadávanie
  source: "seed",                // "seed" | "admin" — odkiaľ vznikla
  version: 3,                    // verzia záznamu
  createdAt, updatedAt, updatedBy
}
```

**Index:** unikátny `{ codelist: 1, key: 1 }` — zabráni duplicitným kľúčom v rámci jedného číselníka.

### 3.2 Seed v repe (zdroj pravdy)

Verzované súbory, jeden na číselník:

```
app/src/codelists/
├── sectionKey.json
├── companyCode.json
├── scope.json
├── accessLevel.json
├── language.json
├── category.json
├── sourceType.json
├── tags.json
└── README.md
```

Formát (`sectionKey.json`):

```json
{
  "codelist": "sectionKey",
  "closed": false,
  "hierarchical": true,
  "items": [
    { "key": "normy", "label": "Normy a poriadky", "parent": null },
    { "key": "sutazny_poriadok", "label": "Súťažný poriadok", "parent": "normy", "synonyms": ["SP"] }
  ]
}
```

`closed: true` = uzavretý enum (`scope`, `accessLevel`, `sourceType`); `closed: false` = rozšíriteľný cez governance (`sectionKey`, `companyCode`, `tags`, `category`, `language`). `hierarchical: true` má len `sectionKey`.

### 3.3 Synchronizácia seed → DB

Idempotentný `seed` skript (Fáza 4): načíta JSON-y, `upsert` do `codelists`. Pravidlá:

- záznam z DB s `source: "admin"`, ktorý nie je v seede → **ostáva** (admin ho pridal vedome),
- záznam v seede → vždy zdroj pravdy pre `label`/`synonyms`/`parent`,
- skript **nikdy nemaže** — len `isActive: false` (mäkká deaktivácia), aby sa nerozbili historické chunky.

---

## 4. Governance — ako vznikajú a menia sa hodnoty

| Akcia | Kto | Ako | Stopa |
|---|---|---|---|
| Pridať hodnotu do uzavretého enumu (`scope`, `accessLevel`, `sourceType`) | vývojár | iba cez seed v repe + PR | git |
| Pridať hodnotu do rozšíriteľného číselníka (`sectionKey`, `companyCode`, `tags`, `category`, `language`) | kurátor obsahu | admin UI → `source: "admin"`, neskôr spätne do seedu | `codelists` + git |
| Premenovať zobrazované meno (`label`) | kurátor | admin UI alebo seed | `version++`, `updatedBy` |
| Zmeniť strojový `key` | **zakázané** | namiesto toho: deaktivovať starý + pridať nový + migrovať chunky | RFC |
| Deaktivovať hodnotu | kurátor | `isActive: false` (nemazať) | audit |

**Zlaté pravidlo:** `key` je nemenný a navždy. Mení sa iba `label`. Premenovanie kľúča = migrácia dát (preznačkovanie chunkov), nie editácia číselníka.

---

## 5. Tagovacia a validačná vrstva pri ingescii

**Rozhodnutie: hybrid — LLM navrhne, človek potvrdí.** Najvyššia kvalita pre normy, kde zlý tag = neviditeľný obsah.

### 5.1 Tok

```
Upload (PDF / web / sken)
        │
        ▼
[1] Konverzia → Markdown + chunkovanie (rešpektuje § / článok / odsek)
        │
        ▼
[2] LLM klasifikátor proti číselníku
    pre každý povinný parameter navrhne hodnotu LEN z codelists
    + confidence; pri tags vyberá z riadeného slovníka
        │
        ▼
[3] Review UI (kurátor)
    dropdowny naplnené z codelists, predvyplnené návrhom LLM
    kurátor potvrdí / opraví; pri nízkom confidence zvýraznené
        │
        ▼
[4] VALIDÁCIA (tvrdá brána pred zápisom)
    ─ každý povinný parameter má hodnotu?           inak BLOCK
    ─ hodnota existuje v codelists a isActive?       inak BLOCK
    ─ scope=company ⇒ companyCode vyplnený?          inak BLOCK
    ─ language ∈ ISO povolené?                       inak BLOCK
        │
        ▼
[5] Zápis do document_chunks (+ embedding auto z Voyage)
```

### 5.2 Validačné pravidlá (invariants)

1. **Žiadny chunk bez kompletného povinného tagovania** sa neuloží do `document_chunks`.
2. Každá hodnota povinného poľa **musí** existovať v `codelists` ako `isActive: true`.
3. Krížové pravidlo: `scope = "company"` ⇒ `companyCode` musí byť vyplnený a existovať.
4. `tags`, ak vyplnené, musia byť podmnožinou riadeného slovníka.
5. `sectionKey` musí byť existujúci kľúč; ak je to skupina (`parent: null`), kurátor by mal preferovať konkrétnu sekciu, ak existuje.
6. LLM **nikdy** nevytvára nové hodnoty číselníka — len vyberá z existujúcich. Návrh novej hodnoty ide cez governance (kap. 4), nie cez ingesciu.

### 5.3 Konzistencia s dotazom (kritické)

Tá istá doména hodnôt sa musí použiť aj pri zostavovaní filtra v dotaze. Ak query klasifikátor / preprocessing nastaví `sectionKey` alebo `companyCode`, **musí** ich brať z `codelists` (rovnaké kľúče ako pri ingescii). Inak sa filter pri vyhľadávaní nikdy nezhodne s otagovaným obsahom. Toto je najčastejší skrytý zdroj „nič nenašlo".

---

## 6. Väzba na indexy (Atlas)

Hodnoty z číselníkov tečú priamo do filtrov definovaných v `rag-architecture.md`:

- **Vektor index `rag_vector_index`** — `filter` polia: `accessLevel`, `companyCode`, `scope`, `sectionKey`, `isActive`, `language`.
- **Fulltext index `rag_text_index`** — `token` polia: `accessLevel`, `companyCode`, `scope`, `sectionKey`; `tags` ako `string`.

Keďže oba indexy filtrujú podľa tých istých polí, **stačí jeden zdroj hodnôt** (`codelists`) a obe vetvy hybridného vyhľadávania ostanú konzistentné.

> **Pozor — premenovanie `associationCode → companyCode` sa dotýka aj indexov:** `filter`/`token` path v oboch Atlas indexoch treba zmeniť a indexy **preindexovať**. Viď kap. 9 (propagácia).

---

## 7. Naviazanie na fázy

| Krok | Fáza | Poznámka |
|---|---|---|
| Definícia číselníkov + seed v repe (vzory) | **Fáza 4** | rozširuje bod „Doménové značkovanie pri importe z číselníka" |
| Kolekcia `codelists` + seed skript | **Fáza 4** | nová mini-úloha |
| LLM klasifikátor proti číselníku + Review UI | **Fáza 4** | nadväzuje na „AI návrh metadát" a „Review UI" |
| Validačná brána pred zápisom chunkov | **Fáza 4** | tvrdá podmienka pri ukladaní |
| Premenovanie `associationCode → companyCode` (kód + indexy) | **Fáza 4** | súčasť migrácie na Model B |
| Preznačkovanie historických chunkov | **Fáza 4** | viď kap. 8, bod 6 |
| `accessLevel` + RBAC napojenie | **Fáza 5** | viditeľnosť ortogonálne k scope |
| Query-time konzistencia filtra | **Fáza 5** | filter z `codelists` aj pri dotaze |

---

## 8. Uzavreté rozhodnutia (pôvodných 6 otvorených otázok)

1. **Plný zoznam `sectionKey`** — štruktúra je **hierarchická** (skupina → sekcia). Publikovaná kostra + príklady vo vzore; plnú sadu kľúčov treba uzamknúť prechodom reálneho korpusu noriem (úloha Fázy 4). Kľúče `snake_case`, nemenné.
2. **Pole „pre koho platí"** — premenované `associationCode → companyCode` (význam ostáva). Číselník rozšíriteľný cez governance; vzor obsahuje `SFZ`, `SsFZ`.
3. **`category`** — riadený rozšíriteľný číselník; vzor: `norma`, `smernica` (+ návrh `zakon`, `manual`, `metodicky_pokyn`). Finalizácia podľa korpusu.
4. **`tags` slovník** — riadený, štartuje malou sadou a rastie cez governance (nie „free text"). Vzor: `registracia`, `start_hraca`.
5. **Admin UI rozsah (Fáza 4)** — minimálne: čítanie + pridanie hodnoty + deaktivácia (`isActive`). Správa synoným a `parent` voliteľne neskôr.
6. **Migrácia existujúcich `rag_chunks`** — **preznačkovať aj historické chunky** podľa nových číselníkov (rozhodnuté). Realizácia ako dávková úloha v rámci migrácie na Model B (Fáza 4), s logom a možnosťou rollbacku.

---

## 9. Propagácia premenovania `associationCode → companyCode`

Premenovanie poľa sa musí premietnuť konzistentne. **V dokumentoch hotové; v živom kóde a indexoch je to súčasť migrácie (Fáza 4) — needitované bez súhlasu.**

| Miesto | Súbor | Stav |
|---|---|---|
| Governance doc | `docs/CISELNIKY_governance.md` | ✅ hotové |
| Architektúra (schéma + indexy) | `docs/rag-architecture.md` | ✅ hotové |
| Dátový model (mapovanie) | `docs/DATA_MODEL_konzistencia.md` | ✅ hotové |
| Projektový plán | `docs/Contineo_RAG_Projektovy_plan.md` | ✅ hotové |
| Schéma `document_chunks` (pole) | DB + kód | migrácia |
| Atlas `rag_vector_index` (filter path) | Atlas UI | migrácia + preindex |
| Atlas `rag_text_index` (token path) | Atlas UI | migrácia + preindex |
| Vyhľadávací filter | `app/src/lib/mongoSearch.ts` | migrácia (kód) |
| Slovník/UI | `web/lib/dictionaries.js`, `web/components/Tech.js` | migrácia (kód) |
| Dokumentácia endpointu | `app/src/app/api/chat/README.md` | migrácia (kód) |
| Diagramy | `docs/contineo_diagram.svg`, `web/public/contineo_diagram.svg` | migrácia |
| Historické chunky (hodnoty) | `rag_chunks`/`document_chunks` | migrácia (preznačkovať) |
