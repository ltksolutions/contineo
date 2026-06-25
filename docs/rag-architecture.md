# Contineo RAG — Architektúra a technický základ

> Živý technický dokument. Aktualizuj po každom sprint review.  
> Zdrojový plán: `docs/Contineo_RAG_Projektovy_plan.md`  
> Implementácia: `app/src/`  
> **Dátový model: kanonický je Model B** (kód `app/src/` aj schémy zladené vo Fáze 4) — pozri `docs/DATA_MODEL_konzistencia.md`. Doménové polia (`sectionKey`, `scope`…) sú v schéme; ich napĺňanie pri importe rieši Fáza 4/5.
> **Číselníky a ingescia:** centrálne číselníky a tagovanie → `docs/CISELNIKY_governance.md`; multi-zdrojová ingescia (MCP, web, API) + reconciliation pri zmene číselníka → `docs/INGESTION_zdroje_reconciliation.md`.

---

## Stack rozhodnutia (zafixované pre Fázu 3)

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
    { "type": "rerank", "path": "text", "model": "voyage-rerank-2" }
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
> Nové kolekcie `qa_pairs` (kurácia) a `tickets` (helpdesk) — Fáza 4b.

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
  _id, title, slug, category,
  accessLevel: "public" | "internal",
  tags: [], summary: "", markdown: "",
  originalFile: { blobUrl, filename, sizeBytes, mime },
  sourceType: "pdf" | "web" | "scan",
  sourceUrl: "",
  status: "draft" | "published",
  contentHash: "sha256...",
  createdBy, createdAt, publishedAt
}
```

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
| **Fáza 2** | Ingestion pipeline (crawler, PDF→MD, chunking) | 🔲 plánovaná |
| **Fáza 3** | RAG API vrstva (`/api/chat`) | ✅ dokončená |
| **Fáza 4** | Import & CMS pipeline | 🔲 plánovaná |
| **Fáza 5** | Prístupové úrovne (NextAuth, RBAC) | 🔲 plánovaná |
| **Fáza 6** | Scheduler & monitoring | 🔲 plánovaná |
| **Fáza 7** | Produkcia & optimalizácia | 🔲 priebežná |

Podrobný popis fáz: `docs/Contineo_RAG_Projektovy_plan.md`
