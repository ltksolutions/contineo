# Contineo RAG — Architektúra a technický základ

> Živý technický dokument. Aktualizuj po každom sprint review.  
> Zdrojový plán: `docs/Contineo_RAG_Projektovy_plan.md`  
> Implementácia: `app/src/`  
> **Dátový model: kanonický je Model B** — pozri `docs/DATA_MODEL_konzistencia.md`. Schémy nižšie (`rag_chunks`, `access_level`) popisujú **stav implementovaný vo Fáze 3 (Model A)**; migrujú sa na Model B po fázach.

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
Kolekcia: `rag_chunks`
```json
{
  "fields": [
    { "type": "text", "path": "text", "model": "voyage-4" },
    { "type": "filter", "path": "access_level" },
    { "type": "filter", "path": "language" }
  ]
}
```

### 2. Atlas Search index — `rag_text_index`
Kolekcia: `rag_chunks`
```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "text":         { "type": "string", "analyzer": "lucene.standard" },
      "access_level": { "type": "token" },
      "tags":         { "type": "string" }
    }
  }
}
```

> **Tip pre SK:** Vyskúšaj `lucene.slovak` analyzer — správne stemuje tvary „hráča/hráčom/hráči".

### 3. Rerank index — `rag_rerank_index`
Kolekcia: `rag_chunks`
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

> **Pozn. ku kanonickým názvom:** nižšie sú názvy **implementované dnes (Model A)**. Kanonický cieľ je **Model B**:
> `rag_chunks` → `document_chunks`, `rag_chat_history` → `conversations`, `rag_documents` → `documents`, + nové `qa_pairs`, `tickets`
> a doménové polia (`sectionKey`, `associationCode`, `scope`, `articleRef`, verzovanie). Mapovanie a migrácia: `docs/DATA_MODEL_konzistencia.md`.

### `rag_chunks` — RAG vyhľadávanie
```js
{
  _id, document_id, text,
  embedding: [],          // generuje Atlas automaticky (Voyage)
  access_level: "public" | "internal",
  language: "sk",
  chunk_index: 3,
  tags: ["normy", "registrácia"],
  created_at: ISODate
}
```

### `rag_documents` — CMS (celý dokument)
```js
{
  _id, title, slug, category,
  access_level: "public" | "internal",
  tags: [], summary: "", markdown: "",
  original_file: { blob_url, filename, size_bytes, mime },
  source_type: "pdf" | "web" | "scan",
  source_url: "",
  status: "draft" | "published",
  content_hash: "sha256...",
  created_by, created_at, published_at
}
```

### `rag_chat_history` — logy konverzácií
```js
{
  _id, session_id, user_id,
  question, answer, sources[],
  model_used, latency_ms,
  feedback: null | "positive" | "negative",
  created_at
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
