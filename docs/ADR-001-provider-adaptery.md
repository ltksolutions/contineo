# ADR-001 — Tri provider adaptéry vyberané konfiguráciou tenanta

> **Stav:** ✅ prijaté · **Dátum:** 2026-07-25 · **Revízia:** 2026-07-26 (overenie voyage-4-nano, sekcia 3) · **Nahrádza:** stack rozhodnutia v `docs/rag-architecture.md` (sekcia „Stack rozhodnutia")
> **Súvisiace:** `docs/OPEN_DECISIONS.md` (D15 — modely/fallback/náklady), `docs/DATA_MODEL_konzistencia.md`, `docs/PRISTUPOVE_PRAVA.md`
> **Implementácia:** `app/src/lib/providers/` — kroky 1–4 hotové (2026-07-26). Zostáva krok 5 (preprocessing a klasifikátor).

---

## 1. Kontext

Contineo dnes beží v jednej konfigurácii: MongoDB Atlas + Voyage AI (auto-embed a `$rerank` priamo v DB) + Ollama `llama3.2` s fallbackom na Claude API. Voľba providera je zadrôtovaná v kóde — `llmGenerator.ts` volá natvrdo `OLLAMA_URL/api/chat` a `api.anthropic.com/v1/messages`.

Potrebujeme obslúžiť dva protichodné typy nasadenia z jednej codebase:

| | Cloud / multi-tenant | On-prem / uzavreté |
|---|---|---|
| Databáza | MongoDB Atlas EU | MongoDB Community 8.2 na VM |
| Embedding | Atlas Automated Embedding (`voyage-4`) | vlastná služba, bez volania von |
| Rerank | `$rerank` stage v Atlase | vlastná služba |
| Generovanie | Claude API | vLLM na vlastnom GPU |
| Motivácia | nízke náklady, žiadna prevádzka | dáta neopustia perimeter (čl. 9, utajované) |

### Čo zisťovanie ukázalo

**Dobrá správa — retrieval je prenositeľný.** MongoDB Search a Vector Search sú od verzie **8.2 v Community Edition** pod SSPL, `mongot` je open-source a MongoDB deklaruje feature parity so self-managed nasadením. Self-hosted zvládne `$search`, `$vectorSearch`, `$rankFusion` aj `$scoreFusion`. **Hybridný dotaz je teda identický kód v oboch režimoch** — to je základ celého rozhodnutia.

**Zlá správa — tri veci sa lámu:**

1. **`$rerank`** je zatiaľ **Atlas-only** a vyžaduje MongoDB 8.3. On-prem neexistuje — rerank sa musí presunúť z agregačnej pipeline do aplikačnej vrstvy.
2. **Automated Embedding** síce beží aj na Community self-managed, ale **potrebuje Voyage API kľúč** — čiže volá von. Pre T1/T2 prijateľné, pre air-gapped T3 vylúčené.
3. **Anthropic Citations API** je Claude-only. Lokálne modely budú citácie naďalej generovať promptom, so slabšou zárukou platnosti odkazu.

**Anthropic nemá vlastný embedding ani reranker** — v dokumentácii odporúča Voyage AI, ktoré od 2/2025 vlastní MongoDB. Neexistuje teda „všetko od jedného dodávateľa" variant.

---

## 2. Rozhodnutie

Zavádzame **tri nezávislé provider adaptéry**, vyberané **konfiguráciou tenanta, nie kódom**. Abstrakčnou hranicou je **naše vlastné rozhranie**, nie cudzí drôtový formát.

```
EmbeddingProvider  → embed(texts[])            → vectors[]
   ├── atlas-auto   Automated Embedding (voyage-4) — embedding je súčasť dotazu
   ├── tei          TEI (voyage-4-nano) — HTTP, model má explicitnú podporu
   └── infinity     Infinity (BGE-M3) — HTTP, OpenAI-compat

RerankProvider     → rerank(query, candidates) → scored[]
   ├── atlas-stage  $rerank v agregačnej pipeline (voyage-rerank-2.5)
   └── infinity     Infinity / TEI (BAAI/bge-reranker-v2-m3) — po retrievale

GenerationProvider → stream(messages, tools?)  → tokens
   ├── anthropic    natívne Anthropic SDK — Citations + prompt caching
   └── openai       OpenAI-kompatibilné (vLLM / SGLang / Ollama)
```

### Prečo nie jeden univerzálny OpenAI-kompatibilný prevodník

OpenAI-kompatibilné rozhranie je **najmenší spoločný menovateľ** — dostaneš len to, čo vedia všetci providers naraz. Pri Claude to stojí dve konkrétne veci:

- **Citations API** — vracia overiteľné odkazy na vety v zdrojoch, `cited_text` sa neráta do output tokenov. V OpenAI schéme neexistuje. Pri našom akceptačnom prahu *presnosť citácie ≥ 85 %* (D9) to nie je kozmetika.
- **Prompt caching** — `cache_control` sa cez OpenAI-compat vrstvu nespoľahlivo prenáša na správnu úroveň. Pri chate s históriou 30–50 tis. tokenov je to rozdiel rádovo 2–3× v cene za dotaz.

Preto: **OpenAI-compat pri lokálnych modeloch** (Ollama, vLLM, SGLang ho hovoria natívne — tam je zadarmo), **natívne SDK pri Claude**.

### Serving runtime pre on-prem

**Infinity** ako primárna voľba pre embedding aj rerank:

- jeden proces obslúži **embedding aj reranking** — TEI potrebuje kontajner na model, teda dva
- **viac modelov v jednej inštancii** — pri multi-tenant, kde tenant môže mať iný model, zásadné
- OpenAI-kompatibilný endpoint — rovnaký vzor konfiguračnej výmeny ako vLLM
- priepustnosť na GPU porovnateľná s TEI

**TEI** tam, kde ho model výslovne podporuje — konkrétne pri `voyage-4-nano`, ktorý má na karte modelu štítok `text-embeddings-inference`, kým podpora v Infinity potvrdená nie je. TEI je aj vyladenejší na jeden model pri vysokej záťaži (Rust, Flash Attention), takže je zálohou aj vtedy, ak zdieľaný pool narazí na strop priepustnosti.

**Praktické rozdelenie:** `voyage-4-nano` → TEI · `BGE-M3` a `BGE-reranker-v2-m3` → Infinity (obslúži embedding aj rerank z jedného procesu).

**vLLM** pre generovanie. Ollama len pre lokálny vývoj — pod záťažou serializuje požiadavky.

---

## 3. Dátový model — tenant profil

Nová kolekcia `tenant_profiles`. Jeden dokument na tenanta, načítaný pri štarte requestu a cachovaný.

```js
{
  _id: ObjectId,
  companyCode: "SFZ",              // kľúč, zhodný s companyCode na chunkoch
  tier: "T1",                      // T1 shared | T2 enclave | T3 air-gap
  displayName: "Slovenský futbalový zväz",

  providers: {
    embedding: {
      kind: "atlas-auto",          // atlas-auto | infinity | tei
      model: "voyage-4",
      dim: 1024,
      index: "rag_vector_index"    // vektorový index viazaný na tento model
    },
    rerank: {
      kind: "atlas-stage",         // atlas-stage | infinity | tei | none
      model: "voyage-rerank-2.5",
      index: "rag_rerank_index",
      topK: 8
    },
    generation: {
      kind: "anthropic",           // anthropic | openai
      model: "claude-sonnet-5",
      citations: true,             // len pri kind: "anthropic"
      promptCaching: true,
      maxTokens: 1024
    }
  },

  limits: {
    maxQueriesPerDay: 5000,
    maxContextChunks: 8
  },

  dataResidency: "eu",             // eu | on-prem | air-gap
  createdAt, updatedAt
}
```

### Príklad — T3 air-gap tenant

```js
{
  companyCode: "MINV",
  tier: "T3",
  providers: {
    embedding:  { kind: "tei", url: "http://tei:8080",
                  model: "voyage-4-nano", dim: 1024, index: "rag_vector_nano" },
                  // dim 1024 = MRL-truncation z natívnych 2048 (viď O1)
    rerank:     { kind: "infinity", url: "http://infinity:7997",
                  model: "BAAI/bge-reranker-v2-m3", topK: 8 },
    generation: { kind: "openai",   url: "http://vllm:8000/v1",
                  model: "Qwen3-8B", citations: false, promptCaching: false }
  },
  dataResidency: "air-gap"
}
```

Rovnaký `$rankFusion`, rovnaká aplikácia, iný profil.

### Poznámka k `voyage-4-nano` (overené 2026-07-26)

`voyage-4-nano` je **open-weights, Apache 2.0**, 340M parametrov, postavený na architektúre Qwen3. Overenie na karte modelu prinieslo tri veci:

**1. Zdieľaný vektorový priestor je potvrdený výrobcom.** Voyage uvádza, že embeddingy z modelov `voyage-4-large`, `voyage-4`, `voyage-4-lite` a `voyage-4-nano` sú **priamo porovnateľné a zameniteľné**, a že prechod medzi nimi nevyžaduje pre-indexáciu. Cloud teda môže embedovať cez `voyage-4` v Atlase a on-prem lokálne cez `voyage-4-nano` — bez re-embedu. To je kotva prenositeľnosti oboch režimov.

**2. Pre tento model odporúčame TEI, nie Infinity.** Karta modelu má explicitný štítok `text-embeddings-inference`; podpora v Infinity nikde potvrdená nie je. Model navyše vyžaduje `trust_remote_code`, ktorý nie každý server prepúšťa. Dokumentovaný je aj beh na vLLM (`runner="pooling"`, architektúra `VoyageQwen3BidirectionalEmbedModel`).

**3. Je to výhradne embedding model.** Nevie generovať text. Na HuggingFace má zavádzajúci štítok `text-generation` a automaticky vygenerovaný úryvok s `AutoModelForCausalLM` — oboje sú artefakty po základnej architektúre Qwen3. Primárny štítok je `Feature Extraction` a všetky ukážky používajú `encode_query()` / `encode_document()`. **Do generation adaptéra nepatrí.**

**Čo zostáva overiť:** `voyage-4-nano` dáva predvolene **2048 dimenzií**, náš Atlas index má **1024**. Model podporuje MRL-truncation na 2048/1024/512/256, čo je presne na tento účel navrhnuté — ale zhodu 1024-rozmerného nano s 1024-rozmerným `voyage-4` z Atlasu treba **zmerať**, nie predpokladať. Viď O1.

---

## 4. Polia na chunku

`document_chunks` sa rozširuje o metadáta embeddingu. Bez nich tichý upgrade modelu neviditeľne rozbije retrieval — nespadne nič, len sa zhoršia odpovede.

```js
{
  // ... existujúce polia (documentId, sectionKey, companyCode, articleRef, text, …)

  embedding: [0.0123, -0.044, ...],

  // NOVÉ — identita vektorového priestoru
  embeddingModel:   "voyage-4",     // POVINNÉ — model, ktorý vektor vyrobil
  embeddingDim:     1024,           // POVINNÉ — kontrola pri zápise aj čítaní
  embeddingVersion: "2026-07",      // verzia/snapshot modelu, ak ju provider dáva
  embeddedAt:       ISODate(),      // kedy vznikol — pre plánovanie re-embedu
  embeddingProvider:"atlas-auto"    // atlas-auto | infinity | tei
}
```

### Pravidlá

1. **Vektory nie sú prenositeľné medzi modelmi.** `voyage-4` a `BGE-M3` majú obe 1024 dimenzií, ale sémanticky sú to nekompatibilné priestory. Miešanie v jednom indexe ticho degraduje výsledky.
2. **Jeden vektorový index na model**, nie na tenanta. Tenanti s rovnakým modelom index zdieľajú, izoláciu rieši filter `companyCode` (nemení sa, viď `PRISTUPOVE_PRAVA.md`).
3. **Zmena modelu = úplný re-embed** korpusu tenanta. Nie je to migrácia, je to prepočet. Naplánovať ako dávkovú úlohu s prepnutím indexu až po dokončení.
4. **Dotaz a korpus musia mať rovnaký `embeddingModel`.** Kontrola pri zostavovaní dotazu — pri nezhode tvrdé zlyhanie, nie tichý fallback.
5. Pri `$rerank` (Atlas) sa reranking deje **v pipeline**; pri Infinity **až po retrievale** nad `$rankFusion` výsledkom. Počet kandidátov na vstupe rerankera drž rovnaký (`limit: 20`), aby boli režimy porovnateľné na eval sade D9.

---

## 5. Miesta v kóde, ktoré sa menia

| Súbor | Zmena | Rozsah |
|---|---|---|
| `app/src/lib/providers/types.ts` | ✅ **hotové** — rozhrania `EmbeddingProvider`, `RerankProvider`, `GenerationProvider` | nový |
| `app/src/lib/providers/factory.ts` (AtlasInlineEmbedding) | ✅ **hotové** — no-op, embedding je súčasť `$vectorSearch` | nový |
| `app/src/lib/providers/embedding/http.ts` | ✅ **hotové** — TEI `/embed` aj Infinity `/embeddings`, vrátane MRL truncation | nový |
| `app/src/lib/providers/factory.ts` (AtlasStageRerank) | ✅ **hotové** — prispeje `$rerank` stage do pipeline | nový |
| `app/src/lib/providers/rerank/http.ts` | ✅ **hotové** — TEI aj Infinity `/rerank`, volá sa po retrievale | nový |
| `app/src/lib/providers/generation/anthropic.ts` | ✅ **hotové** — natívne SDK, Citations + `cache_control` | nový |
| `app/src/lib/providers/generation/openai.ts` | ✅ **hotové** — OpenAI-compat streaming (vLLM/SGLang/Ollama) | nový |
| `app/src/lib/providers/factory.ts` | ✅ **hotové** — `getProviders(tenantProfile)` → trojica adaptérov | nový |
| `app/src/lib/tenantProfile.ts` | ✅ **hotové** — načítanie + cache profilu podľa `companyCode` | nový |
| `app/src/lib/llmGenerator.ts` | ✅ **hotové** (prepis) — `streamOllama` a `streamClaude` sa presúvajú do adaptérov; ostáva len zostavenie promptu, SSE obálka a `buildSources()`. Verejná signatúra `generateAnswer(opts)` **zostáva nezmenená** | veľký |
| `app/src/lib/mongoSearch.ts` | ✅ **hotové** — `useStageRerank` v `SearchOptions`; `$rerank` stage sa pridáva podmienene podľa `rerank.kind`; pri `infinity` sa vracia neprerankovaný výsledok a rerank rieši volajúci | stredný |
| `app/src/app/api/chat/route.ts` | ✅ **hotové** — načíta tenant profil, odovzdá ho do search aj generovania; pri `rerank.kind === "infinity"` vloží rerank krok medzi search a generovanie | stredný |
| `app/src/lib/queryPreprocessor.ts` | **úprava** — Ollama/Claude fetch nahradiť `GenerationProvider` (preprocessing má vlastný, lacnejší profil) | stredný |
| `app/src/lib/queryClassifier.ts` | **úprava** — to isté; zvážiť úplné zrušenie LLM vetvy (heuristika stačí, LLM pridá 200–500 ms) | malý |
| `app/src/lib/mongodb.ts` | **úprava** — `getCollection("tenant_profiles")` | triviálny |

### Poradie implementácie

1. ✅ `types.ts` + `factory.ts` + `tenantProfile.ts` — kostra bez zmeny správania
2. ✅ `generation/*` + prepis `llmGenerator.ts` — najväčší prínos, izolovaná zmena
3. ✅ Polia na chunku + `embeddingGuard.ts` + `scripts/reembed.mjs`
4. ✅ `embedding/http.ts` + `rerank/http.ts` + podmienený `$rerank` v `mongoSearch.ts` a `route.ts`
5. ⬜ Preprocessing a klasifikátor

**Stav 2026-07-26:** kroky 1–4 hotové, pokryté 82 testami (`npm test`) a `tsc --noEmit`.
Integračne neoverené — TEI aj Infinity čakajú na stroj s GPU.

---

## 6. Dôsledky

### Pozitívne

- Jedna codebase obslúži cloud aj air-gap nasadenie; rozdiel je konfiguračný záznam
- Modely sa dajú A/B testovať na eval sade D9 bez zásahu do aplikácie
- Pridanie nového providera = nový adaptér, žiadna zmena volajúcich
- Tenant si môže zvoliť pomer cena/kvalita (Haiku vs. Sonnet vs. lokálny Qwen3)

### Negatívne

- Tri implementácie namiesto jednej — väčšia testovacia matica
- Feature parita medzi režimami **nie je úplná** a nikdy nebude (viď tabuľka nižšie)
- Tenant profil je nový bod zlyhania — chybný záznam rozbije tenanta; nutná validácia schémy pri zápise

### Feature parita — čo v ktorom režime chýba

| Schopnosť | Cloud (Atlas + Claude) | On-prem (Mongo + Infinity + vLLM) |
|---|---|---|
| `$rankFusion` hybrid | ✅ | ✅ identický |
| Automated Embedding | ✅ | ⚠️ volá Voyage API — pre air-gap nepoužiteľné |
| `$rerank` v pipeline | ✅ | ❌ rerank v aplikačnej vrstve |
| Overiteľné citácie (Citations API) | ✅ | ❌ len promptom |
| Prompt caching | ✅ | ⚠️ prefix caching vo vLLM, iná sémantika |
| Dáta neopustia perimeter | ❌ | ✅ |

---

## 7. Riziká

| Riziko | Dopad | Zmiernenie |
|---|---|---|
| Tichá zmena embedding modelu providerom | Neviditeľná degradácia retrievalu | `embeddingModel` + `embeddingVersion` povinné na chunku; kontrola zhody pri dotaze |
| `$rerank` sa nikdy nedostane do Community | Trvalá divergencia režimov | Rerank cez Infinity je referenčný; Atlas `$rerank` je optimalizácia, nie základ |
| Citations len v Claude | Cloud režim kvalitnejší v kľúčovej metrike | Zmerať rozdiel na D9; ak je veľký, je to argument pre cloud aj pri T1 |
| Prompt vyladený na Claude podáva horšie na Qwen3 | Falošná predstava zameniteľnosti | Prompt je súčasť profilu, nie globálny; D9 sa púšťa pri každom modeli zvlášť |
| MRL-truncation 2048→1024 nezachová zhodu s `voyage-4` z Atlasu | Stráca sa symetria vektorových priestorov medzi cloudom a on-prem | Zmerať kosínusovú podobnosť na vzorke; záloha = zjednotiť na 2048 dim, alebo BGE-M3 + akceptovaný re-embed pri migrácii |

---

## 8. Otvorené otázky

- **O1** — Sedia dimenzie v zdieľanom priestore? `voyage-4-nano` dáva natívne 2048 dim, náš index má 1024. Treba zmerať, či MRL-truncation na 1024 zachová porovnateľnosť s `voyage-4` z Atlasu (kosínusová podobnosť na vzorke rovnakých textov, embedovaných oboma cestami). Alternatíva: zjednotiť oba režimy na 2048. *Vyžaduje stroj s GPU, priorita 🔴*
  - ~~Zvládne Infinity `voyage-4-nano`?~~ — nahradené: TEI má explicitnú podporu (štítok `text-embeddings-inference`), takže otázka „ktorý server" je vyriešená.
- **O2** — Preprocessing lokálne alebo cez Claude Haiku? Pri ~0,001 € za prepis sa lokálny model nemusí oplatiť prevádzkovať. *Rozhodnúť po meraní latencie*
- **O3** — Zrušiť LLM vetvu klasifikátora úplne? Heuristika beží pod 1 ms zadarmo. *Zmerať prínos na D9*
- **O4** — Ako verzovať prompty per model, aby sa dali porovnávať na D9? *Návrh: `prompts/{model}/system.md`, verzia v profile*

---

## 9. Dopad na existujúce dokumenty

| Dokument | Zmena |
|---|---|
| `docs/rag-architecture.md` | Sekcia „Stack rozhodnutia" — doplniť odkaz na tento ADR, stack už nie je jedna fixná kombinácia |
| `docs/OPEN_DECISIONS.md` | D15 (modely/fallback/náklady) — doplniť odkaz na ADR-001 |
| `docs/DATA_MODEL_konzistencia.md` | Nové polia na `document_chunks` + nová kolekcia `tenant_profiles` |
| `docs/GDPR_DATA_PROTECTION.md` | `dataResidency` v profile určuje, kam odchádza obsah promptu — doplniť do záznamu o spracovateľských činnostiach |
| `web/` | Diagram + stránka Technológia aktualizované súčasne s týmto ADR |
