# Contineo RAG – Kód

## Štruktúra

```
src/
├── app/
│   └── api/
│       └── chat/
│           └── route.ts          ← Hlavný RAG endpoint (POST /api/chat)
└── lib/
    ├── mongodb.ts                ← MongoDB singleton klient
    ├── queryClassifier.ts        ← Klasifikácia: fulltext | vector | hybrid
    ├── queryPreprocessor.ts      ← LLM rewriting + decomposition
    ├── mongoSearch.ts            ← fulltextSearch / vectorSearch / hybridSearch
    └── llmGenerator.ts           ← Streaming odpoveď (Ollama → Claude fallback)
```

## Flow

```
POST /api/chat { query }
       │
       ├─ classifyQuery()         heuristika alebo Ollama LLM
       │    → "fulltext" | "vector" | "hybrid"
       │
       ├─ preprocessQuery()       [voliteľné] Ollama → Claude fallback
       │    → rewritten, subQueries, keywords
       │
       ├─ fulltextSearch()        $search (Atlas Search / Lucene)
       │   vectorSearch()         $vectorSearch + $rerank (Voyage)
       │   hybridSearch()         $rankFusion (RRF) + $rerank (Voyage)
       │
       └─ generateAnswer()        Ollama streaming → Claude fallback
            → SSE stream (token po tokene) + sources na záver
```

## Inštalácia závislostí

```bash
npm install mongodb langchain @langchain/mongodb
npm install next-auth @anthropic-ai/sdk
npm install crawlee playwright
```

## Env premenné (.env.local)

```env
MONGODB_URI=mongodb+srv://...
MONGODB_DB=contineo
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
ANTHROPIC_API_KEY=sk-ant-...
```

## MongoDB Atlas indexy

> Kolekcia: `document_chunks` (Model B). Polia v camelCase.

### Vector Search index (rag_vector_index)
```json
{
  "fields": [
    { "type": "text",   "path": "text", "model": "voyage-4" },
    { "type": "filter", "path": "accessLevel" },
    { "type": "filter", "path": "associationCode" },
    { "type": "filter", "path": "scope" },
    { "type": "filter", "path": "sectionKey" },
    { "type": "filter", "path": "isActive" },
    { "type": "filter", "path": "language" }
  ]
}
```

### Atlas Search index pre fulltext (rag_text_index)
```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "text":            { "type": "string", "analyzer": "lucene.standard" },
      "accessLevel":     { "type": "token" },
      "associationCode": { "type": "token" },
      "scope":           { "type": "token" },
      "sectionKey":      { "type": "token" },
      "isActive":        { "type": "boolean" },
      "tags":            { "type": "string" }
    }
  }
}
```

### Rerank index (rag_rerank_index)
```json
{
  "fields": [
    { "type": "rerank", "path": "text", "model": "voyage-rerank-2" }
  ]
}
```

## Príklad volania z frontendu

```typescript
const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "Ako sa registruje hráč?" }),
})

const reader = response.body!.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const lines = decoder.decode(value).split("\n\n").filter(Boolean)
  for (const line of lines) {
    if (!line.startsWith("data:")) continue
    const event = JSON.parse(line.slice(5))

    if (event.type === "token") {
      // Pridaj token k odpovedi
      setAnswer(prev => prev + event.token)
    }
    if (event.type === "done") {
      // Zobraz zdroje
      setSources(event.sources)
      console.log("Model:", event.model)
    }
    if (event.type === "error") {
      console.error("Chyba:", event.message)
    }
  }
}
```
