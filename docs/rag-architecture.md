# Contineo RAG — Architektúra a technický základ

> Živý technický dokument. Aktualizuj po každom sprint review.  
> Zdrojový plán: `docs/Contineo_RAG_Projektovy_plan.md`  
> Implementácia: `app/src/`  
> **Dátový model: kanonický je Model B** (kód `app/src/` aj schémy zladené vo Fáze 4) — pozri `docs/DATA_MODEL_konzistencia.md`. Doménové polia (`sectionKey`, `scope`…) sú v schéme; ich napĺňanie pri importe rieši Fáza 4/5.
> **Číselníky a ingescia:** centrálne číselníky a tagovanie → `docs/CISELNIKY_governance.md`; multi-zdrojová ingescia (MCP, web, API) + reconciliation pri zmene číselníka → `docs/INGESTION_zdroje_reconciliation.md`; prístupové práva (RBAC/ABAC + tenant izolácia, enforcement vo filtri) → `docs/PRISTUPOVE_PRAVA.md`.

---

## Stack rozhodnutia (zafixované pre Fázu 3)

> ⚠️ **Prekonané rozhodnutím ADR-001** (2026-07-25). Stack už nie je jedna fixná kombinácia — embedding, rerank a generovanie sú tri **vymeniteľné adaptéry** vyberané profilom tenanta (cloud alebo on-prem). Tabuľka nižšie popisuje **predvolený cloudový profil**. Viď `docs/ADR-001-provider-adaptery.md`.


| Vrstva | Rozhodnutie | Dôvod |
|---|---|---|
| **Databáza + vektory** | MongoDB Atlas EU | Jedna DB pre dáta, vektory aj fulltext, GDPR |
| **Embedding** | Voyage AI `voyage-4` (Automated) | Auto-embed v Atlas, žiadny ručný pipeline |
| **Vyhľadávanie** | Hybrid: `$rankFusion` (RRF) + `$rerank` | Kombinácia sémantiky + presnej zhody, najspoľahlivejší výsledok pre SK |
| **LLM primárny** | Ollama `llama3.2` | Lokálny, EU, bez poplatkov, dáta neopustia server |
| **LLM fallback** | Claude API `claude-sonnet-4-6` | Pre komplexné dotazy kde Ollama nestačí |
| **LLM preprocessing** | Ollama rýchly model | Query rewriting + decomposition, fallback Claude Haiku |
| **Auth** | NextAuth.js | Oddelenie public / internal obsahu |
| **Hosting** | Vercel + MongoDB Atlas EU | GDPR, EU región |

---

## Mobile first je povinnosť

**Každé rozhranie sa navrhuje najprv pre telefón a až potom pre širší displej.**
Nie je to preferencia, je to pravidlo projektu (2026-08-28).

Dôvod je v tom, ako sa k portálu ľudia dostanú: prihlasovací odkaz im príde
e-mailom a e-mail si väčšina otvorí v telefóne. Prvé stretnutie s Contineom
teda prebehne na displeji širokom 360 px — a rozhranie postavené na počítači
tam pretečie tak, že si to na vývojárskom monitore nikto nevšimne.

Čo to znamená v praxi:

- Východiskové štýly platia pre úzky displej; `@media (min-width: …)` **pridáva**
  to, čo si širší displej môže dovoliť. Nikdy opačne.
- Rozmery, ktoré nesmú pretiecť (výšky líšt, počty stĺpcov, pevné šírky), sa
  zapisujú do `globals.css` s dotazom na šírku, nie ako inline `style` — inline
  štýl nevie médiové dotazy a mlčky sa použije všade.
- Vodorovné posúvanie stránky je chyba. Široký obsah (tabuľky, diagramy) má
  vlastný `overflow-x: auto`, nie telo stránky.
- Klikacie prvky majú na dotyk aspoň ~40 px; ikona bez textu potrebuje
  `aria-label` aj `title`.
- **Overuje sa to na skutočnej šírke,** nie odhadom z kódu.

## Konvencie v kóde (2026-08-27)

**Identifikátory po anglicky, komentáre po slovensky.** Názvy modulov, typov,
funkcií, parametrov aj lokálnych premenných sú anglické; vysvetlenia — a je ich
v tomto projekte veľa, lebo zachytávajú *prečo* — zostávajú slovenské. Rovnako
popisy testov: majú sa dať prečítať ako veta, nie ako zoznam matcherov.

**Premenovanie je dokončené** (2026-09-04/06): `hodnotenia.ts` je `ratings.ts`,
`cennik.ts` je `pricing.ts`, `sada.ts` zanikla so zlatou sadou (ADR-008)
a `auth.ts` má `allowedEmails()` a `isAllowed()`. Slovenské zostávajú **zámerne**
už len parametre `chunker.mjs` — sú to jeho vlastné názvy a prekladajú sa
v `chunkingProfile.ts`.

**Hodnoty, ktoré vracia API, sú anglické a strojové** — `"no-effective-version"`,
`"already-acknowledged"`, `"invalid-email"`. Sú to kľúče pre volajúceho, nie text
pre človeka; ten sa k nim priradí až v rozhraní, podľa jazyka (`i18n.ts`).

---

## Implementované súbory (Fáza 3)

```
app/src/
├── lib/
│   ├── mongodb.ts           ← Singleton klient, getCollection()
│   ├── queryClassifier.ts   ← Heuristika + Ollama LLM klasifikátor
│   ├── queryPreprocessor.ts ← Rewriting + decomposition (Ollama → Claude)
│   ├── mongoSearch.ts       ← fulltextSearch / vectorSearch / hybridSearch
│   └── llmGenerator.ts      ← SSE streaming (Ollama → Claude fallback)
└── app/api/chat/
    ├── route.ts             ← POST /api/chat — hlavný RAG endpoint
    └── README.md            ← Dokumentácia endpointu
```

---

## Tok dotazu (runtime)

```
POST /api/chat { query: "Ako sa registruje hráč?" }
        │
        ▼
[1] classifyQuery()
    heuristika (< 1ms, bez tokenov) alebo Ollama LLM (max 2s)
    → "fulltext" | "vector" | "hybrid"
        │
        ▼
[2] preprocessQuery()   ← iba pre vector/hybrid a dlhé dotazy
    Ollama llama3.2 → Claude Haiku (fallback)
    → { rewritten, subQueries[], keywords[] }
        │
        ▼
[3] MongoDB search
    fulltext  →  $search (Atlas Search / lucene.standard)
    vector    →  $vectorSearch (Voyage auto-embed) + $rerank
    hybrid    →  $rankFusion (vector 60% + fulltext 40%) + $rerank
    + sub-queries: až 3 parallelné hybridSearch, deduplikácia
        │
        ▼
[4] generateAnswer()
    Ollama llama3.2 streaming → Claude sonnet-4-6 (fallback)
    → SSE: { type: "token" } ... { type: "done", sources, model }
```

---

## MongoDB Atlas indexy (nutné vytvoriť v Atlas UI)

### 1. Vector Search index — `rag_vector_index`
Kolekcia: `document_chunks`
```json
{
  "fields": [
    { "type": "text",   "path": "text", "model": "voyage-4" },
    { "type": "filter", "path": "accessLevel" },
    { "type": "filter", "path": "companyCode" },
    { "type": "filter", "path": "scope" },
    { "type": "filter", "path": "sectionKey" },
    { "type": "filter", "path": "isActive" },
    { "type": "filter", "path": "language" }
  ]
}
```

### 2. Atlas Search index — `rag_text_index`
Kolekcia: `document_chunks`
```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "text":            { "type": "string", "analyzer": "lucene.standard" },
      "accessLevel":     { "type": "token" },
      "companyCode": { "type": "token" },
      "scope":           { "type": "token" },
      "sectionKey":      { "type": "token" },
      "isActive":        { "type": "boolean" },
      "tags":            { "type": "string" }
    }
  }
}
```

> **Tip pre SK:** Vyskúšaj `lucene.slovak` analyzer — správne stemuje tvary „hráča/hráčom/hráči".

### 3. Rerank index — `rag_rerank_index`
Kolekcia: `document_chunks`
```json
{
  "fields": [
    { "type": "rerank", "path": "text", "model": "rerank-2" }
  ]
}
```

---

## Env premenné

Pozri `app/.env.local.example`. Kľúčové:

```env
MONGODB_URI=mongodb+srv://...
MONGODB_DB=contineo
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
ANTHROPIC_API_KEY=sk-ant-...
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

---

## Klasifikátor dotazov — rozhodovacia logika

```
Dotaz
  ├── obsahuje § / STN / ISO / rok / URL  →  "fulltext"
  ├── ≤ 3 slová                           →  "fulltext"
  ├── ≥ 8 slov                            →  "vector"
  └── ostatné (4–7 slov)                 →  "hybrid"

[voliteľne] Ollama LLM klasifikátor (useLLMClassifier: true)
  max 2s timeout, fallback na heuristiku
```

---

## Kolekcie MongoDB (schéma)

> **Kanonické názvy = Model B** (zladené vo Fáze 4). Polia v camelCase. Doménové polia
> (`sectionKey`, `companyCode`, `scope`, `articleRef`, verzovanie) sú súčasťou schémy; ich
> napĺňanie pri importe rieši Fáza 4/5. Plné mapovanie a migrácia: `docs/DATA_MODEL_konzistencia.md`.
> Kurácia **nemá vlastnú kolekciu** (D11, revidované 2026-09-15): stav páru je na zázname
> v `evaluations`, do indexu ide úsek so `sourceType: "qa"` a poľom `derivedFrom`.
> Nová kolekcia `tickets` (helpdesk) — Fáza 4b.
> Nové kolekcie `persons`, `acknowledgements`, `onboarding_tracks` a rozšírenie `documents.versions[]` — Fáza 8,
> viď `docs/ONBOARDING_KONCEPCIA.md` a `docs/ADR-003-onboarding-a-potvrdzovanie.md`. Onboarding **nevolá žiadny model** —
> reťaz z `docs/AKO_TO_BEZI.md` pri ňom nebeží.

### `document_chunks` — RAG vyhľadávanie
```js
{
  _id, documentId, versionId, text,
  embedding: [],                 // Atlas auto-embed (Voyage), 1024 dims
  embeddingModel: "voyage-4",
  // tagging / domain filtering
  sectionKey: "sutazny_poriadok",
  companyCode: "SsFZ",       // "SFZ" = applies to everyone
  scope: "company",          // global | company | region
  accessLevel: "public",         // public | internal — visibility / RBAC
  language: "sk",
  articleRef: "§ 12 ods. 3",
  heading: "Štart hráča",
  chunkIndex: 3,
  tags: ["normy", "registrácia"],
  isActive: true,                // false = archived version
  effectiveFrom, effectiveTo,
  createdAt: ISODate
}
```

### `documents` — CMS (celý dokument)
```js
{
  _id, documentId, documentKey,     // documentKey = identita dokumentu (D80)
  title, slug, category,
  companyCode, accessLevel: "public" | "internal",
  language, tags: [], summary: "", markdown: "",
  chunkingProfile,                  // pomenovaný profil členenia (D79)
  folderId, folderPath: [],         // virtuálne priečinky (D56)
  ownerDepartmentId, internalNumber,
  versions: [{ versionId, label, effectiveFrom, effectiveTo, isActive,
               contentHash, markdown, originalFile, fixes: [], textFixes: [],
               publishedAt, publishedBy }],
  sourceType: "pdf" | "web" | "scan",
  sourceUrl: "",
  status: "draft" | "published",
  createdBy, createdAt, publishedAt
}
```

> **Pôvodné súbory sú v GridFS, nie vo Vercel Blobe** (`lib/fileStore.ts`,
> `/api/library/file/[id]`) — neverejná cesta s kontrolou role a organizácie.
> Plný tvar `versions[]` a jeho pravidlá: `docs/DATA_MODEL_konzistencia.md`.

### `conversations` — logy konverzácií
```js
{
  _id, sessionId, userId,
  question, answer, sources[],
  modelUsed, latencyMs,
  feedback: null | "positive" | "negative",
  createdAt
}
```

---

## Ďalšie fázy (plán)

| Fáza | Obsah | Stav |
|---|---|---|
| **Fáza 1** | Infraštruktúra (Atlas, Ollama, Next.js) | ✅ dokončená |
| **Fáza 2** | Ingestion pipeline (crawler, PDF→MD, chunking) | 🟡 čiastočne — prevod a členenie bežia (`lib/conversion.ts`, `lib/chunker.mjs`); crawler sa nerobí (D13: re-import je manuálny) |
| **Fáza 3** | RAG API vrstva (`/api/chat`) | ✅ dokončená |
| **Fáza 4** | Import & CMS pipeline | 🟡 z veľkej časti hotová — knižnica, nahrávanie, editor, publikovanie, členenie (D53–D60). Otvorené: kanály, reconciliation, číselníky v DB |
| **Fáza 5** | Prístupové úrovne (NextAuth, RBAC) | 🟡 čiastočne — prihlásenie a roly bežia, izolácia organizácie je v podmienke dotazu (D29/D32). Otvorené: `securityFilter()` vo vyhľadávaní, skupiny, Sportnet OAuth |
| **Fáza 6** | Scheduler & monitoring | 🔲 plánovaná |
| **Fáza 7** | Produkcia & optimalizácia | 🔲 priebežná |
| **Fáza 8** | Onboarding a potvrdzovanie noriem | ✅ postavená — potvrdenia, termíny, pripomienky, reťaz dôkazov, schvaľovanie |

Podrobný popis fáz: `docs/Contineo_RAG_Projektovy_plan.md`
