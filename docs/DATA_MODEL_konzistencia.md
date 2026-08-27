# Dátový model — rozhodnutie a migračný plán (A → B)

> **Rozhodnutie (2026-06-25): kanonický je Model B** (model z verejnej stránky `/technologia`).
> Implementácia (Model A) k nemu dorastie po fázach. Tento dokument je jediný zdroj pravdy pre názvy kolekcií a polí.

## Východisko: prečo Model B

Doména Contineo = SFZ a podriadené zväzy, normy s paragrafmi, helpdesk. Plochý prístup `access_level: public|internal` (Model A) na to nestačí — potrebujeme doménovú štruktúru (Zväz/oblasť), verzovanie noriem, citácie § a helpdesk. To presne pokrýva Model B.

## Dva modely (stav pred zladením)

| | Model A — implementované (Fáza 3) | Model B — kanonický cieľ |
|---|---|---|
| Chunky | `rag_chunks` | **`document_chunks`** |
| Dokumenty (CMS) | `rag_documents` | **`documents`** |
| Konverzácie | `rag_chat_history` | **`conversations`** |
| Kurácia | — | **`qa_pairs`** (nová) |
| Helpdesk | — | **`tickets`** (nová) |
| Crawl log | `rag_crawl_log` | `crawl_log` (interná, nemení sa prioritne) |
| Osoby v organizácii | — | **`persons`** (nová, Fáza 8) |
| Potvrdenia oboznámenia | — | **`acknowledgements`** (nová, Fáza 8) |
| Trasy onboardingu | — | **`onboarding_tracks`** (nová, Fáza 8) |

## Mapovanie polí na chunku (`rag_chunks` → `document_chunks`)

| Model A | Model B | Poznámka |
|---|---|---|
| `text` | `text` | bez zmeny |
| `embedding` | `embedding` | + `embeddingModel: "voyage-4"` |
| `document_id` | `documentId` | + `versionId` |
| `access_level` (public/internal) | **ostáva** `access_level` | viditeľnosť/RBAC — **ortogonálne** k scope |
| `tags` (voľný text) | `sectionKey` (z číselníka) | + `tags` voliteľne ostávajú |
| `chunk_index` | `chunk_index` | bez zmeny |
| — | `companyCode` (SFZ/SsFZ) | **nové** — pre koho platí |
| — | `scope` (global/company/region) | **nové** — úroveň platnosti (celoštátne / Zväz / oblasť) |
| — | `articleRef` (§ 12 ods. 3) | **nové** — pre citáciu |
| — | `heading` | **nové** |
| — | `isActive` + `effectiveFrom/To` | **nové** — verzovanie noriem |

> **Dôležité:** `access_level` a `scope`/`companyCode` **nie sú to isté** a nevylučujú sa.
> `access_level` = KTO to smie vidieť (public vs internal, RBAC).
> `scope`+`companyCode` = NA KOHO sa norma vzťahuje (celoštátne / konkrétny Zväz / oblasť).
> V Modeli B existujú **obe** vrstvy súčasne.

## Fázová migrácia (mapované na existujúci plán fáz)

1. **Premenovanie kolekcií** (`rag_chunks`→`document_chunks`, `rag_chat_history`→`conversations`, `rag_documents`→`documents`).
   Malá, mechanická zmena kódu + preindexovanie Atlas. *Samostatný krok, nízke riziko.*
2. **Doménové polia + verzovanie** (`sectionKey`, `companyCode`, `scope`, `articleRef`, `isActive`, `effectiveFrom/To`).
   Naviazať na **Fázu 4 (Import & CMS)** a **Fázu 5 (Prístupové úrovne)** — značkovanie z číselníka pri importe.
3. **Kuračný cyklus** (`qa_pairs`) — schválené odpovede späť do znalostí. Nová mini-fáza po Fáze 4.
4. **Helpdesk** (`tickets`, prepojenie na `conversations`, SLA, životný cyklus). Samostatná feature-fáza.

## Čo sa NEmení teraz
Živý RAG kód (`app/src/`) a MongoDB Atlas ostávajú na Modeli A a bežia ďalej. Tento dokument je zámer; samotný refaktor + migrácia DB príde po fázach. Verejný web (Model B) sa nemení.

## Otvorené (na potvrdenie pri implementácii)
- `rag_documents` → `documents`, alebo ponechať prefix `rag_`? (návrh: bez prefixu, jednotne s `document_chunks`).
- Ponechať `tags` popri `sectionKey`, alebo úplne nahradiť? (návrh: ponechať voliteľne pre voľné štítky).

---

## Kolekcie onboardingu (Fáza 8)

> Rozhodnutie: `docs/ADR-003-onboarding-a-potvrdzovanie.md` · Detailné schémy a indexy:
> `docs/ONBOARDING_KONCEPCIA.md` kap. 3. Tu je len to, čo patrí do jediného zdroja pravdy
> pre názvy kolekcií a polí.

| Kolekcia | Účel | Poznámka ku konzistencii |
|---|---|---|
| `persons` | kto do organizácie patrí (meno, útvar, typ osoby, trasy, roly) | **doménová** vrstva nad technickou `auth_users`, ktorú zakladá `src/lib/authAdapter.ts`. `auth_users` zostáva bez zmeny. Väzba cez `persons.id` = `auth_users.id`. |
| `acknowledgements` | auditný záznam „prečítal som a zaväzujem sa" | **append-only**. Nesie odtlačky (`email`, `fullName`, `documentTitle`, `versionLabel`) a doslovné znenie formulky, aby bol čitateľný bez `$lookup` do kolekcií, ktoré sa medzitým zmenili. |
| `onboarding_tracks` | poradie krokov onboardingu | stav dokončenia sa **neukladá** — odvodzuje sa z `acknowledgements` (D27). Žiadna `onboarding_progress`. |

### Rozšírenie `documents` o `versions[]`

`documents` je dnes plochý (`status: draft|published`, `contentHash`) a **verzovanie
v ňom chýba** — `versionId` existuje len na `document_chunks`, teda v RAG vrstve.
`CMS_KONCEPCIA.md` (A.3) ho plánuje, ale zatiaľ len ako zámer.

**Fáza 8 ho zavádza skôr než CMS** (D25), pretože bez neho sa potvrdenie nedá naviazať na
konkrétne znenie a je právne bezcenné. **Nie je to však potreba onboardingu** — verzovanie je
povinnosť celého systému: `documents` je spoločné úložisko pre obsah zo všetkých vstupných
kanálov a zneplatňovanie starých znení je vlastnosť dokumentu, nie kanála. Vzniká preto
v **cieľovom** tvare, aký potrebuje CMS:

```js
versions: [{
  versionId, label, effectiveFrom, effectiveTo, isActive,
  contentHash, originalFile, markdown, changeNote,
  requiresReacknowledgement,        // vypĺňa človek, nikdy sa neodvodzuje
  publishedAt, publishedBy
}]
```

**Vzťah k `document_chunks.versionId`:** je to tá istá hodnota. Chunk patrí verzii dokumentu;
potvrdenie sa viaže na tú istú verziu. Bez toho by sa nedalo povedať, či text, ktorý človek
čítal, je ten, z ktorého bot odpovedá.

**Vzťah k `isActive` a `effectiveFrom/To` (D6):** nemení sa. Právna platnosť zostáva oddelená
od „technicky najnovšia verzia" — viď `PRECEDENCIA_NORIEM.md`.

**Vzťah k vstupným kanálom (D25):** zmena obsahu zistená pri re-syncu (`contentHash`) zakladá
**novú položku** vo `versions[]`, nikdy neprepisuje existujúcu; predchádzajúca dostane
`effectiveTo`. Nová verzia z kanála prichádza ako `isActive: false` a platnosť jej určí
kurátor — automat vie len to, že sa zmenil súbor. Rovnaký princíp ako D-CMS-6.

---

## Identita vektorového priestoru (ADR-001)

`document_chunks` nesie metadáta o tom, ktorý model vektor vyrobil. Bez nich
tichý upgrade modelu neviditeľne rozbije retrieval — nič nespadne, len sa
zhoršia odpovede.

```js
{
  embedding: [ ... ],
  embeddingModel:    "voyage-4",     // POVINNÉ na nových chunkoch
  embeddingDim:      1024,           // kontrola pri zápise aj čítaní
  embeddingProvider: "atlas-auto",   // atlas-auto | tei | infinity
  embeddedAt:        ISODate(),      // pre plánovanie re-embedu
}
```

**Pravidlá**

1. Vektory nie sú prenositeľné medzi modelmi. `voyage-4` a `BGE-M3` majú obe
   1024 dimenzií, ale sémanticky sú to nekompatibilné priestory.
2. **Výnimka — rodina voyage-4.** Modely `voyage-4`, `voyage-4-large`,
   `voyage-4-lite` a `voyage-4-nano` zdieľajú vektorový priestor (potvrdené
   výrobcom) a sú navzájom zameniteľné bez re-embedu.
3. Jeden vektorový index na model, nie na tenanta. Izoláciu rieši filter
   `companyCode` (viď `PRISTUPOVE_PRAVA.md`).
4. Zmena modelu mimo zdieľanú rodinu = **úplný prepočet** korpusu tenanta.
   Index sa prepína až po dokončení.
5. Dotaz a korpus musia byť z rovnakého priestoru. Kontroluje to
   `app/src/lib/embeddingGuard.ts` — pri nezhode tvrdé zlyhanie, nie tichý fallback.

**Nástroje:** `app/scripts/reembed.mjs --stav | --backfill | --reembed`
