# Dátový model — rozhodnutie a migračný plán (A → B)

> **Rozhodnutie (2026-06-25): kanonický je Model B** (model z verejnej stránky `/technologia`).
> Tento dokument je jediný zdroj pravdy pre názvy kolekcií a polí.
>
> **Prechod je hotový (stav 2026-09-16).** Kód aj Atlas bežia na Modeli B:
> `documents`, `document_chunks`, polia v camelCase. Model A je história — tabuľky
> nižšie ho držia preto, aby bolo pri staršom zázname alebo zálohe vidieť, čo sa na
> čo premenovalo. Z cieľových kolekcií ešte nevznikli `conversations` a `tickets`.

## Východisko: prečo Model B

Doména Contineo = SFZ a podriadené zväzy, normy s paragrafmi, helpdesk. Plochý prístup `access_level: public|internal` (Model A) na to nestačí — potrebujeme doménovú štruktúru (Zväz/oblasť), verzovanie noriem, citácie § a helpdesk. To presne pokrýva Model B.

## Dva modely (Model A je história)

| | Model A — pôvodné (Fáza 3) | Model B — kanonický | Stav |
|---|---|---|---|
| Chunky | `rag_chunks` | **`document_chunks`** | ✅ |
| Dokumenty (CMS) | `rag_documents` | **`documents`** | ✅ |
| Konverzácie | `rag_chat_history` | **`conversations`** | ⬜ nevznikla — nemá zapisovateľa |
| Kurácia | — | ~~**`qa_pairs`**~~ → úsek v `document_chunks` so `sourceType: "qa"` | ✅ 2026-09-15 (bez vlastnej kolekcie) |
| Helpdesk | — | **`tickets`** (nová) | ⬜ plán (Fáza 4b) |
| Crawl log | `rag_crawl_log` | `crawl_log` | ⬜ crawler neexistuje (D13: re-import je manuálny) |
| Osoby v organizácii | — | **`persons`** | ✅ Fáza 8 |
| Potvrdenia oboznámenia | — | **`acknowledgements`** | ✅ Fáza 8 |
| Trasy onboardingu | — | **`onboarding_tracks`** | ✅ Fáza 8 |

## Mapovanie polí na chunku (`rag_chunks` → `document_chunks`)

| Model A | Model B | Poznámka |
|---|---|---|
| `text` | `text` | bez zmeny |
| `embedding` | `embedding` | + `embeddingModel: "voyage-4"` |
| `document_id` | `documentId` | + `versionId` |
| `access_level` (public/internal) | `accessLevel` | viditeľnosť/RBAC — **ortogonálne** k scope; do camelCase ako všetko ostatné |
| `tags` (voľný text) | `sectionKey` (z číselníka) | + `tags` voliteľne ostávajú |
| `chunk_index` | `chunkIndex` | premenované do camelCase |
| — | `companyCode` (SFZ/SsFZ) | **nové** — pre koho platí |
| — | `scope` (global/company/region) | **nové** — úroveň platnosti (celoštátne / Zväz / oblasť) |
| — | `articleRef` (§ 12 ods. 3) | **nové** — pre citáciu |
| — | `heading` | **nové** |
| — | `isActive` + `effectiveFrom/To` | **nové** — verzovanie noriem |
| — | `chunkingId` | **nové** (D57) — identita členenia, oddelená od identity textu |
| — | `sourceType` | **nové** — `"qa"` značí úsek z overenej odpovede, nie z dokumentu |
| — | `derivedFrom[]` | **nové** — dokumenty, z ktorých overená odpoveď vznikla |
| — | `embeddingModel` / `embeddingDim` / `embeddingProvider` / `embeddedAt` | **nové** (ADR-001) — identita vektorového priestoru |

> **Dôležité:** `access_level` a `scope`/`companyCode` **nie sú to isté** a nevylučujú sa.
> `access_level` = KTO to smie vidieť (public vs internal, RBAC).
> `scope`+`companyCode` = NA KOHO sa norma vzťahuje (celoštátne / konkrétny Zväz / oblasť).
> V Modeli B existujú **obe** vrstvy súčasne.
>
> **Doplnené 2026-08-27 (D32):** `scope: global` teda **neudeľuje prístup** — hovorí len, že norma
> sa vzťahuje na všetkých. Viditeľnosť má tri zdroje a žiadny ďalší: zhoda `companyCode`,
> menovité `sharedWithCompanyCodes[]`, alebo `accessLevel: public`. **`companyCode.parent`
> neudeľuje nič** — hierarchia je štruktúra pre relevanciu a precedenciu (`PRECEDENCIA_NORIEM.md`
> R4), nie kľúč k obsahu. Zámena týchto dvoch osí je presne tá tichá chyba, pred ktorou
> odsek vyššie varuje.
>
> ♻️ **Doplnené 2026-09-17 (D90):** viditeľnosť má už len **jeden** zdroj — zhodu `companyCode`.
> `sharedWithCompanyCodes[]` je zrušené a `accessLevel: public` znamená verejný v kanáloch vlastnej
> organizácie, nie pre iného tenanta.

## Fázová migrácia (mapované na existujúci plán fáz)

1. **Premenovanie kolekcií** ✅ hotové — `rag_chunks`→`document_chunks`,
   `rag_documents`→`documents`. `rag_chat_history`→`conversations` **nie**: tá
   kolekcia zatiaľ nevznikla, lebo do nej nemá kto písať.
2. **Doménové polia + verzovanie** ✅ hotové (`sectionKey`, `companyCode`, `scope`,
   `articleRef`, `isActive`, `effectiveFrom/To`) — značkovanie z číselníka beží pri
   nahratí aj pri importe.
3. **Kuračný cyklus** ✅ 2026-09-15 — overená odpoveď späť do znalostí. Bez kolekcie `qa_pairs`: stav je na zázname v `evaluations`, do indexu ide úsek so `sourceType: "qa"` (D11 revidované).
4. **Helpdesk** (`tickets`, prepojenie na `conversations`, SLA, životný cyklus). Samostatná feature-fáza.

## Čo zostáva
Živý kód (`app/src/`) aj Atlas **už sú na Modeli B**. Otvorené sú len kolekcie, ktoré
nemajú zapisovateľa: `conversations` (história rozhovorov) a `tickets` (helpdesk,
Fáza 4b). Verejný web (Model B) sa nemení.

## Otvorené (na potvrdenie pri implementácii)
- ~~`rag_documents` → `documents`, alebo ponechať prefix `rag_`?~~ ✅ bez prefixu — potvrdené implementáciou.
- Ponechať `tags` popri `sectionKey`, alebo úplne nahradiť? (návrh: ponechať voliteľne pre voľné štítky).

---

## Kolekcie onboardingu (Fáza 8)

> Rozhodnutie: `docs/decisions/ADR-003-onboarding-a-potvrdzovanie.md` · Detailné schémy a indexy:
> `docs/ONBOARDING_KONCEPCIA.md` kap. 3. Tu je len to, čo patrí do jediného zdroja pravdy
> pre názvy kolekcií a polí.

| Kolekcia | Účel | Poznámka ku konzistencii |
|---|---|---|
| `persons` | kto do organizácie patrí (meno, oddelenie, typ osoby, trasy, roly) | **doménová** vrstva nad technickou `auth_users`, ktorú zakladá `src/lib/authAdapter.ts`. `auth_users` zostáva bez zmeny. Väzba cez `persons.id` = `auth_users.id`. |
| `acknowledgements` | auditný záznam „prečítal som a zaväzujem sa" | **append-only**. Nesie odtlačky (`email`, `fullName`, `documentTitle`, `versionLabel`) a doslovné znenie formulky, aby bol čitateľný bez `$lookup` do kolekcií, ktoré sa medzitým zmenili. |
| `onboarding_tracks` | poradie krokov onboardingu | stav dokončenia sa **neukladá** — odvodzuje sa z `acknowledgements` (D27). Žiadna `onboarding_progress`. |

### Rozšírenie `documents` o `versions[]`

`documents` bol pôvodne plochý (`status: draft|published`, `contentHash`) a verzovanie
v ňom chýbalo — `versionId` existoval len na `document_chunks`, teda v RAG vrstve.
**`versions[]` zaviedla Fáza 8 (D25, 2026-08-27)** a je v `lib/documents.ts`.

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
