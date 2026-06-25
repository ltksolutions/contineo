# Contineo RAG – Projektový plán

> **Platforma:** Contineo.app  
> **Stack:** Next.js · MongoDB Atlas + Voyage AI · Ollama  
> **Jazyk obsahu:** Slovenčina  
> **Prístup:** Verejný + Prihlásený (normy)  
> **Hosting:** Vercel + EU Cloud  
> **Verzia:** 1.0 · Interný dokument

---

## Obsah

1. [Prehľad a kontext projektu](#1-prehľad-a-kontext-projektu)
2. [Zdrojové dáta a use-case](#2-zdrojové-dáta-a-use-case)
3. [Architektúra systému](#3-architektúra-systému)
4. [Hybrid Search – vektorové + fulltextové vyhľadávanie](#4-hybrid-search--vektorové--fulltextové-vyhľadávanie)
5. [Import a CMS pipeline](#5-import-a-cms-pipeline)
6. [Výber nástrojov](#6-výber-nástrojov)
7. [Fázový plán implementácie](#7-fázový-plán-implementácie)
8. [MongoDB schémata](#8-mongodb-schémata)
9. [Plánovanie rizík](#9-plánovanie-rizík)
10. [Ďalší postup](#10-ďalší-postup)

---

## 1. Prehľad a kontext projektu

Contineo RAG je inteligentný systém pre vyhľadávanie a generovanie odpovedí nad vlastnými dátami futbalsfz.sk a pridružených projektov. Využíva technológiu **Retrieval-Augmented Generation (RAG)**, ktorá kombinuje vektorové vyhľadávanie s generatívnymi jazykovými modelmi — lokálnych aj komerčných.

| Parameter | Hodnota |
|---|---|
| **Používatelia** | Zamestnanci SFZ, funkcionári, fanúšikovia, verejnosť |
| **Jazyk obsahu** | Primárne slovenčina |
| **Aktualizácia dát** | Dynamická – denne a týždenne podľa zdroja |
| **Prístup k dátam** | Verejný chatbot + interný (za prihlásením) |
| **EU hosting** | MongoDB Atlas EU · Vercel Blob EU |

---

## 2. Zdrojové dáta a use-case

### 2.1 Zdrojové dokumenty

| Zdroj | Typ | Frekvencia | Prístup |
|---|---|---|---|
| futbalsfz.sk | Web crawl | Denne | Verejný |
| dajmspolugol.sk | Web crawl | Denne | Verejný |
| PDF normy STN / EN | PDF | Týžd. / ad hoc | Interné |
| Zákon o športe | PDF / Web | Mesačne | Verejný |
| FAQ stránky | Web crawl | Týžd. | Verejný |
| Projektové stránky | Web crawl | Týžd. | Verejný |

### 2.2 Hlavné use-cases

| Use-case | Popis |
|---|---|
| **Verejný chatbot** | Odpovede na otázky o futbale, registrácii, pravidlách — bez prihlásenia |
| **Interný asistent** | Prístup k normám STN/EN po prihlásení — pre zamestnancov SFZ |
| **FAQ automat** | Automatizované odpovede na časté otázky z web stránok |
| **Projektová dokumentácia** | Vyhľadávanie v projektových stránkach a dokumentoch |

---

## 3. Architektúra systému

### 3.1 Prehľad vrstiev

```
┌─────────────────────────────────────────────────────────┐
│  ZDROJE DÁT                                             │
│  futbalsfz.sk · dajmspolugol.sk · PDF normy · Zákony    │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│  INGESTION PIPELINE                                     │
│  Crawler (Crawlee) → AI konverzia (Claude API)          │
│  → Chunker (LangChain.js) → vloženie textu do MongoDB   │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│  MONGODB ATLAS + AUTOMATED EMBEDDING                    │
│  Voyage AI (voyage-4) generuje vektory AUTOMATICKY      │
│  Text + vektor + metadata v jednom dokumente (EU host)  │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│  RAG API VRSTVA (Next.js Route Handlers)                │
│  [volit.] LLM rewriting → $vectorSearch → $rerank       │
│  MongoDB auto-embed dotazu + Voyage reranker            │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│  LLM BACKEND (generovanie odpovede)                     │
│  Primárny: Ollama (llama3.2, mistral) – lokálny, EU     │
│  Fallback:  Claude API / GPT-4o – pre zložité dotazy    │
└─────────────────────┬───────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js / Vercel)                            │
│  Verejný chatbot (bez prihlásenia) – PUBLIC dokumenty   │
│  Interný chatbot (NextAuth.js) – PUBLIC + INTERNAL      │
└─────────────────────────────────────────────────────────┘
```

**Kľúčová výhoda:** žiadny samostatný Qdrant, žiadna ručná VoyageAI integrácia, žiadna sync logika. Text + vektor + metadata sú v jednom dokumente a vektory zostávajú vždy aktuálne pri zmene dát.

### 3.2 Tok dotazu používateľa (runtime)

| Krok | Akcia | Detail |
|---|---|---|
| **1** | Používateľ pošle otázku | napr. „Ako sa registruje hráč?" cez Next.js API route |
| **2** | [Voliteľné] LLM preprocessing | rewriting, rozklad na pod-otázky, extrakcia kľúčových pojmov |
| **3** | MongoDB `$vectorSearch` | text dotazu sa AUTOMATICKY zvektorizuje (Voyage AI), nájdu sa najpodobnejšie chunky |
| **4** | MongoDB `$rerank` | Voyage reranker preusporiada výsledky podľa relevancie + filter `access_level` |
| **5** | LLM generovanie odpovede | kontext (chunky) + otázka → odpoveď s citáciami, streamovaná cez SSE |

---

## 4. Hybrid Search – vektorové + fulltextové vyhľadávanie

MongoDB Atlas podporuje oba typy vyhľadávania natívne v jednom pipeline, čo umožňuje vybrať správny engine podľa charakteru dotazu — alebo ich kombinovať.

### 4.1 Kedy ktorý engine

| Situácia | Lepší engine | Dôvod |
|---|---|---|
| „Ako sa registruje hráč?" | **Vektorové** | Sémantika, synonymá, zámer |
| „§ 15 ods. 3 registračného poriadku" | **Fulltext** | Presná zhoda, čísla, paragrafy |
| „STN EN ISO 9001" | **Fulltext** | Kódy noriem, skratky |
| „Čo robiť keď mi zamietli transfer?" | **Vektorové** | Zámer, nie kľúčové slovo |
| „dajmspolugol 2026" | **Fulltext** | Vlastné mená, roky |
| Väčšina bežných otázok | **Hybrid** | Najspoľahlivejší výsledok |

### 4.2 Rozhodovacia logika (klasifikátor)

Prompt sa klasifikuje pred vyhľadávaním — buď rýchlou heuristikou (bez LLM, zadarmo), alebo lokálnym LLM modelom pre presnejšiu klasifikáciu:

```
Prompt
  │
  ├── heuristika (rýchla, bez tokenov)
  │     ├── obsahuje § / ISO / STN / číslo → "fulltext"
  │     ├── ≤ 3 slová → "fulltext"
  │     ├── ≥ 8 slov → "vector"
  │     └── ostatné → "hybrid"
  │
  └── [voliteľne] lokálny LLM klasifikátor (presnejší)
        └── odpoveď: "fulltext" | "vector" | "hybrid"
```

```
"fulltext"  →  $search → $rerank → LLM odpoveď
"vector"    →  $vectorSearch → $rerank → LLM odpoveď
"hybrid"    →  $rankFusion (oba) → $rerank → LLM odpoveď
```

### 4.3 Hybrid pipeline (`$rankFusion`)

MongoDB 8.x podporuje `$rankFusion` s Reciprocal Rank Fusion (RRF) — zlúčenie výsledkov oboch engines v jednom aggregation pipeline:

```javascript
db.document_chunks.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          // Vektorové vyhľadávanie (sémantika)
          vector: [
            {
              $vectorSearch: {
                index: "rag_vector_index",
                path: "embedding",
                query: "Ako sa registruje hráč?",
                numCandidates: 100,
                limit: 20,
                filter: { accessLevel: "public" }
              }
            }
          ],
          // Fulltextové vyhľadávanie (presná zhoda)
          fulltext: [
            {
              $search: {
                index: "rag_text_index",
                text: {
                  query: "Ako sa registruje hráč",
                  path: "text",
                  fuzzy: { maxEdits: 1 }   // tolerancia preklepov
                }
              }
            },
            { $limit: 20 }
          ]
        }
      },
      // Váhy: vektorové má väčšiu váhu pre prirodzený jazyk
      combination: { weights: { vector: 0.6, fulltext: 0.4 } }
    }
  },
  // Voyage reranker na záver – preusporiada zlúčené výsledky
  {
    $rerank: {
      index: "rag_rerank_index",
      query: "Ako sa registruje hráč?",
      path: "text",
      limit: 5
    }
  }
])
```

### 4.4 Atlas Search index pre fulltext

Okrem Vector Search indexu treba vytvoriť aj Atlas Search index (`rag_text_index`) pre fulltext:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "text": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "access_level": { "type": "token" },
      "language":     { "type": "token" },
      "tags":         { "type": "string" }
    }
  }
}
```

> **Tip:** Pre slovenčinu môžeš vyskúšať `lucene.slovak` analyzer (stemming) — správne spracuje tvary slov ako „hráča", „hráčom", „hráči" ako rovnaký koreň.

### 4.5 Porovnanie prístupov

| Prístup | Rýchlosť | Náklady | Kvalita |
|---|---|---|---|
| Fulltext only | ⚡ Najrýchlejší | 💚 Zadarmo | Pre presné dotazy |
| Vector only | 🔵 Rýchly | 💛 Voyage tokeny | Pre sémantiku |
| Hybrid (`$rankFusion`) | 🔵 Rýchly | 💛 Voyage tokeny | Najspoľahlivejší |
| Hybrid + `$rerank` | 🟡 Stredný | 🟠 Voyage tokeny × 2 | Najvyššia kvalita |

---

## 5. Import a CMS pipeline

Import umožňuje bežnému používateľovi nahrať PDF, sken alebo URL webu a publikovať obsah do interného CMS portálu — pri súčasnom pridaní do RAG vyhľadávania. Konverziu zabezpečuje **jeden multimodálny AI engine** (Claude API primárne, lokálny vision model ako fallback), takže odpadajú samostatné nástroje na OCR a parsing PDF.

### 4.1 Tok importu

```
KROK 1 – UPLOAD
  PDF (drag & drop) / URL webu a podstránky / bulk / sken
        │
        ▼
KROK 2 – AI KONVERZIA → MARKDOWN
  PDF/sken → rozdelenie na bloky 5–10 strán
  Každý blok → Claude API (text, tabuľky, OCR, popis obrázkov)
  Fallback: llama3.2-vision (lokálne)
  Web: Crawlee → HTML → Claude → Markdown
  Obrázky → extrakcia originálu → Vercel Blob (EU)
  Zlúčenie blokov → jeden Markdown
        │
        ▼
KROK 3 – AI NÁVRH METADÁT
  Z Markdownu: názov, kategória, tagy, zhrnutie, access_level
  Používateľ potvrdí alebo upraví
        │
        ▼
KROK 4 – REVIEW (človek v slučke)
  ┌─────────────────────┬─────────────────────┐
  │  Markdown editor    │  Live náhľad        │
  └─────────────────────┴─────────────────────┘
  Formulár: názov, kategória, access_level, tagy
  [ Zahodiť ]   [ Uložiť koncept ]   [ Publikovať ]
        │
        ▼
KROK 5 – ULOŽENIE + CHUNKING + AUTO-EMBED
  Originál PDF  → Vercel Blob
  Markdown (celý) → documents (CMS)
  Markdown chunky → document_chunks (auto-embed Voyage v MongoDB)
```

### 4.2 AI konverzný engine (primárny + fallback)

| Vrstva | Model | Použitie |
|---|---|---|
| **Primárny** | Claude API (multimodal) | Najvyššia kvalita na PDF, tabuľky aj skeny. Číta PDF natívne. |
| **Fallback** | llama3.2-vision (Ollama) | Keď API zlyhá, alebo pre citlivé interné dok. (dáta lokálne, úspora). |
| **Veľké PDF** | spracovanie po blokoch | Rozdelenie na 5–10 strán, paralelné spracovanie, zlúčenie Markdownu. |
| **Obrázky** | popis + extrakcia | AI vytvorí alt text pre RAG, originál sa uloží do Vercel Blob. |

### 4.3 Jeden Markdown zdroj — dve využitia

| Využitie | Detail |
|---|---|
| **CMS publikovanie** | Celý Markdown sa zobrazí ako článok na internom portáli. Používateľ má možnosť zobraziť aj originál PDF (náhľad/download z Blob). |
| **RAG vyhľadávanie** | Markdown sa rozseká na chunky uložené v `document_chunks` s automatickým embeddingom (Voyage). Citácie v odpovedi odkážu späť na CMS článok. |

---

## 6. Výber nástrojov

| Vrstva | Nástroj | Dôvod výberu |
|---|---|---|
| **Crawler** | Crawlee (Node.js) | Natívny JS/TS, Playwright podpora, rate-limiting, robots.txt |
| **PDF parsing** | Claude API (multimodal) | PDF→Markdown, tabuľky, OCR, popis obrázkov v jednom |
| **Konverzia fallback** | llama3.2-vision (Ollama) | Lokálny vision model pre citlivé dok. a úspory |
| **Chunking** | LangChain.js | Sémantický chunking, overlap, rekurzívny split, metadata |
| **Databáza + vektory** | MongoDB Atlas EU | Jedna DB pre dáta, vektory aj metadata, EU host, GDPR |
| **Embedding** | Voyage AI voyage-4 (Automated) | Auto-embed v MongoDB, žiadny ručný pipeline, top kvalita SK |
| **Embedding pre kód** | voyage-code-3 (voliteľne) | Pre technické / štruktúrované dokumenty a normy |
| **Vyhľadávanie** | MongoDB `$vectorSearch` (HNSW) | Natívny ANN, filter metadát, kombinácia s textovým hľadaním |
| **Re-ranking** | MongoDB `$rerank` (Voyage) | Natívny reranker priamo v query engine, bez extra služby |
| **LLM primárny** | Ollama (llama3, mistral) | Lokálny, bez poplatkov, EU, privátne dáta |
| **LLM fallback** | Claude API / GPT-4o | Komplexné otázky, kde lokálny model nestačí |
| **LLM preprocessing** | Ollama (rýchly model) | Query rewriting, decomposition, extrakcia pojmov |
| **Úložisko súborov** | Vercel Blob (EU) | Originál PDF + extrahované obrázky, natívne v Next.js |
| **CMS** | Next.js + MongoDB | Markdown články, slug routing, zobrazenie originálu |
| **Orchestrácia** | LangChain.js / Mastra.ai | Natívny pre Next.js, podpora MongoDB auto-embed |
| **Scheduler** | Vercel Cron Jobs | Jednoduché, v existujúcom stacku, bez extra infraštr. |
| **Auth** | NextAuth.js | Oddelenie verejný / interný obsah, rolovanie prístupov |

---

## 7. Fázový plán implementácie

### Fáza 1 – Základ infraštruktúry `[1 týždeň]`

- [ ] Registrácia MongoDB Atlas (EU región) + vytvorenie clustera
- [ ] Vytvorenie Voyage AI model API key v Atlas (menu AI Models)
- [ ] Vytvorenie Vector Search indexu s Automated Embedding (voyage-4)
- [ ] Inštalácia Ollama lokálne (dev) pre LLM preprocessing + generovanie
- [ ] Vytvorenie Next.js projektu so základnou adresárovou štruktúrou
- [ ] Definícia schémy dokumentov (zdroj, typ, jazyk, prístup, hash, timestamp)
- [ ] Nastavenie `.env` (MONGODB_URI, VOYAGE/Atlas key, OLLAMA_URL, ANTHROPIC_API_KEY)

### Fáza 2 – Ingestion pipeline `[2 týždne]`

- [ ] Crawler pre futbalsfz.sk a dajmspolugol.sk (Crawlee + Playwright)
- [ ] Detekcia zmenených stránok pomocou SHA-256 hash comparison
- [ ] AI konverzia noriem STN, EN a zákonov (Claude API)
- [ ] Upload interface pre manuálne pridávanie PDF dokumentov
- [ ] Chunking stratégia: 512 tokenov, 50 token overlap, zachovanie metadát
- [ ] Vloženie chunkov (text + metadata) do MongoDB — vektory sa generujú AUTOMATICKY
- [ ] Overenie health indexu a token usage v Atlas UI

### Fáza 3 – RAG API vrstva `[1–2 týždne]`

- [ ] Next.js Route Handler: `/api/chat` (POST, streaming SSE)
- [ ] [Voliteľné] LLM preprocessing: query rewriting, decomposition, pojmy
- [ ] MongoDB `$vectorSearch` s textom dotazu (auto-embed, top-k = 5–10)
- [ ] MongoDB `$rerank` (Voyage reranker) na zlepšenie relevancie
- [ ] Zostavenie systémového promptu s kontextom a zdrojmi
- [ ] LLM call: Ollama primárny, Claude API / GPT-4o fallback (streaming)
- [ ] Citácie zdrojov priamo v odpovedi chatbota

### Fáza 4 – Import & CMS pipeline `[2 týždne]`

- [ ] Upload UI: drag & drop PDF, URL webu, bulk, sken (Next.js)
- [ ] AI konverzia PDF/sken → Markdown (Claude API, fallback llama3.2-vision)
- [ ] Spracovanie veľkých PDF po blokoch 5–10 strán + zlúčenie
- [ ] Extrakcia obrázkov → Vercel Blob + AI alt text popis
- [ ] AI návrh metadát: názov, kategória, tagy, zhrnutie, access_level
- [ ] Review UI: Markdown editor + live náhľad + formulár metadát
- [ ] Uloženie: originál → Blob, Markdown → `documents`, chunky → `document_chunks`
- [ ] CMS zobrazenie článku + možnosť náhľadu originálneho PDF
- [ ] **Migrácia na Model B:** premenovať kolekcie (`rag_chunks`→`document_chunks`, `rag_chat_history`→`conversations`, `rag_documents`→`documents`) + preindexovať Atlas — viď `docs/DATA_MODEL_konzistencia.md`
- [ ] **Doménové značkovanie pri importe z číselníka:** `sectionKey`, `companyCode`, `scope`, `articleRef` + verzovanie `isActive`/`effectiveFrom/To`

### Fáza 5 – Prístupové úrovne `[1 týždeň]`

- [ ] Integrácia NextAuth.js (prihlasovanie pre interných používateľov)
- [ ] Tagging dokumentov pri importe: `PUBLIC` / `INTERNAL`
- [ ] `$vectorSearch` filter `access_level` podľa úrovne prístupu používateľa
- [ ] **Doménový filter `scope` + `companyCode`** (na koho norma platí) — beží súbežne s `access_level` (kto smie vidieť); sú ortogonálne
- [ ] Verejný chatbot (bez prihlásenia) – len PUBLIC dokumenty
- [ ] Interný chatbot (po prihlásení) – PUBLIC + INTERNAL dokumenty
- [ ] Role-based access control (RBAC) pre správcu obsahu a CMS

### Fáza 4b – Kuračný cyklus + Helpdesk `[plán]`

- [ ] `qa_pairs`: schválené odpovede správcu späť do znalostí (kontrola kvality a kurácia)
- [ ] `tickets`: eskalácia z bota/e-mailu, prepojenie na `conversations`, SLA, životný cyklus

### Fáza 6 – Scheduler & monitoring `[1 týždeň]`

- [ ] Vercel Cron Jobs: denne crawlovanie webov, týždenne PDF re-check
- [ ] Change detection: hash diff, re-import iba zmenených dokumentov
- [ ] Logovanie crawlov a importu do MongoDB (audit trail)
- [ ] Admin dashboard: počet dokumentov, posledný crawl, token usage, chyby
- [ ] Emailové alerty pri zlyhaní crawlera alebo konverzie

### Fáza 7 – Produkcia & optimalizácia `[priebežne]`

- [ ] Eval pipeline pre meranie kvality a relevancie odpovedí
- [ ] User feedback: thumbs up/down, uloženie do MongoDB
- [ ] Fine-tuning systémových promptov podľa feedbacku
- [ ] Monitoring nákladov (Claude API konverzia + Voyage tokeny vs lokál)
- [ ] Priebežné testovanie nových lokálnych modelov (Ollama)
- [ ] Optimalizácia chunking stratégie podľa výsledkov vyhľadávania

---

## 8. MongoDB schémata

> **Kanonický dátový model = Model B** (rozhodnuté 2026-06-25). Schémy nižšie sú **stav Fázy 3 (Model A)**.
> Cieľové názvy: `rag_chunks` → `document_chunks`, `rag_chat_history` → `conversations`, `rag_documents` → `documents`, + nové `qa_pairs`, `tickets` a doménové polia (`sectionKey`, `companyCode`, `scope`, `articleRef`, verzovanie `isActive`/`effectiveFrom/To`).
> Úplné mapovanie a fázová migrácia: **`docs/DATA_MODEL_konzistencia.md`**.

### 7.1 Kolekcia: `documents` (CMS – celý dokument)

```javascript
{
  _id:          ObjectId,
  title:        "Registračný poriadok SFZ 2026",
  slug:         "registracny-poriadok-sfz-2026",   // CMS URL
  category:     "normy",
  accessLevel:  "public" | "internal",
  tags:         ["registrácia", "hráči"],
  summary:      "AI-generované zhrnutie...",
  markdown:     "# Registračný poriadok\n\n...",    // celý obsah pre CMS
  originalFile: {
    blobUrl:    "https://...blob.../original.pdf",  // náhľad / download
    filename:   "poriadok.pdf",
    sizeBytes:  248000,
    mime:       "application/pdf"
  },
  images:       [{ url: "...", alt: "AI popis" }],
  sourceType:   "pdf" | "web" | "scan",
  sourceUrl:    "https://futbalsfz.sk/...",         // ak web
  status:       "draft" | "published",
  contentHash:  "sha256...",
  createdBy:    ObjectId,
  createdAt:    ISODate,
  publishedAt:  ISODate
}
```

### 7.2 Kolekcia: `document_chunks` (RAG vyhľadávanie)

```javascript
{
  _id:             ObjectId,
  documentId:      ObjectId,               // → documents (citácie, mazanie)
  versionId:       ObjectId,
  text:            "Hráč sa registruje cez ISSF systém...",
  embedding:       [0.021, -0.34, ...],    // generuje MongoDB AUTOMATICKY (Voyage)
  embeddingModel:  "voyage-4",
  // tagging / domain filtering
  sectionKey:      "prestupovy_poriadok",
  companyCode: "SsFZ",                 // "SFZ" = platí pre všetkých
  scope:           "company",          // global | company | region
  accessLevel:     "public" | "internal",  // viditeľnosť / RBAC
  language:        "sk",
  articleRef:      "§ 12 ods. 3",
  heading:         "Štart hráča",
  chunkIndex:      3,
  tags:            ["normy", "registrácia", "hráči"],
  isActive:        true,                    // false = archivovaná verzia
  effectiveFrom:   ISODate,
  effectiveTo:     ISODate,
  createdAt:       ISODate
}
```

### 7.3 Vector Search Index (Automated Embedding)

```json
{
  "fields": [
    {
      "type": "text",
      "path": "text",
      "model": "voyage-4"
    },
    { "type": "filter", "path": "accessLevel" },
    { "type": "filter", "path": "companyCode" },
    { "type": "filter", "path": "scope" },
    { "type": "filter", "path": "sectionKey" },
    { "type": "filter", "path": "isActive" },
    { "type": "filter", "path": "language" },
    { "type": "filter", "path": "sourceType" }
  ]
}
```

### 7.4 Kolekcia: `conversations`

```javascript
{
  _id:        ObjectId,
  sessionId:  "uuid-v4",
  userId:     null | ObjectId,    // null = anonymný používateľ
  question:   "Ako sa registruje hráč?",
  answer:     "...",
  sources:    ["https://...", "https://..."],
  modelUsed:  "llama3.2",
  latencyMs:  1240,
  feedback:   null | "positive" | "negative",
  createdAt:  ISODate
}
```

### 7.5 Kolekcia: `crawl_log`

```javascript
{
  _id:           ObjectId,
  jobId:         "uuid-v4",
  sourceUrl:     "https://futbalsfz.sk",
  startedAt:     ISODate,
  finishedAt:    ISODate,
  pagesCrawled:  142,
  pagesUpdated:  8,
  errors:        ["url1 – 404", "url2 – timeout"],
  status:        "success" | "partial" | "failed"
}
```

---

## 9. Plánovanie rizík

| Riziko | Pravdep. | Dopad | Mitigácia |
|---|---|---|---|
| Ollama pomalý pre produkčné zaťaženie | Stredná | Vysoký | Dedikovaný GPU server alebo Claude/GPT-4o fallback |
| Crawling blokovaný webom (rate limit / bot) | Stredná | Stredný | Crawlee rate limiter, robots.txt, custom User-Agent |
| Slabá kvalita slovenčiny v lokálnom LLM | Stredná | Vysoký | Voyage-4 má dobrú SK podporu, fallback Claude API |
| Automated Embedding v Atlas v public preview | Stredná | Stredný | Overiť SLA/limity preview, sledovať GA dátum |
| Zmena HTML štruktúry crawlovaného webu | Vysoká | Stredný | Hash diff monitoring, email alert, manuálna kontrola |
| GDPR / únik interných noriem | Nízka | Kritický | `$vectorSearch` filter `access_level`, EU hosting, audit log |
| Náklady na Voyage AI tokeny pri veľkom objeme | Stredná | Nízky | Monitoring v Atlas UI, voyage-4-lite pre menšie dok. |
| Nepresná AI konverzia zložitých PDF / skenov | Stredná | Stredný | Review krok (človek v slučke), fallback model, bloky |

---

## 10. Ďalší postup

Odporúčame začať s **Fázou 1** — do 2–3 dní môžete mať funkčný proof-of-concept s jedným zdrojom (napr. futbalsfz.sk) a overiť celý pipeline od crawlingu až po RAG odpoveď.

### Okamžité kroky (deň 0–1)

1. V MongoDB Atlas vytvoriť Voyage AI model API key (menu **Services > AI Models**)
2. Vytvoriť Vector Search index s Automated Embedding (model `voyage-4`)
3. Inštalácia Ollama + stiahnutie modelu `llama3.2` pre LLM generovanie
4. Vytvorenie Next.js projektu: `npx create-next-app@latest contineo-rag`
5. Nastavenie `.env`: `MONGODB_URI`, `ATLAS_VOYAGE_KEY`, `OLLAMA_URL`, `ANTHROPIC_API_KEY`
6. Vložiť pár testovacích chunkov a overiť `$vectorSearch` s textovým dotazom

### Quick Start

```bash
# 1. Stiahnuť LLM model pre generovanie odpovedí
ollama pull llama3.2

# 2. Vytvoriť Next.js projekt
npx create-next-app@latest contineo-rag --typescript --tailwind

# 3. Nainštalovať závislosti
npm install mongodb langchain @langchain/mongodb
npm install crawlee playwright next-auth @anthropic-ai/sdk

# Pozn.: žiadny Qdrant ani samostatný embedding SDK
# vektorizáciu rieši MongoDB Automated Embedding (Voyage AI)
```

### Príklad `$vectorSearch` dotazu

```javascript
// Text dotazu sa zvektorizuje AUTOMATICKY priamo v MongoDB
db.document_chunks.aggregate([
  {
    $vectorSearch: {
      index: "rag_vector_index",
      path: "embedding",
      query: "Ako sa registruje hráč?",  // TEXT, nie vektor
      numCandidates: 100,
      limit: 10,
      filter: { accessLevel: "public" }
    }
  }
])
```

---

> **Poznámka:** Tento dokument je živým projektovým plánom. Odporúčame ho aktualizovať po každom sprintovom review a evidovať odchýlky od plánu. Všetky rozhodnutia o nástrojoch sú revízibilné na základe výsledkov Fázy 1 (proof-of-concept).
