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
