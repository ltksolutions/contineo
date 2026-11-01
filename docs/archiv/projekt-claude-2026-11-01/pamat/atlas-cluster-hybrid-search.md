---
name: atlas-cluster-hybrid-search
description: "Overený stav Atlas clustra Contineo, dostupnosť $rankFusion / $rerank, a nameraný rozdiel medzi rerank modelmi"
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

# Atlas cluster a natívne hybridné vyhľadávanie (overené 2026-09-06)

## Cluster

Projekt `contineo.app`, cluster **Contineo**, M10 (General), Replica Set 3 nodes, AWS **eu-central-1 (Frankfurt)** — sedí s ADR-002 (dátová rezidencia v EÚ). 2 search indexy (`rag_vector_index`, `rag_text_index`), 581 aktívnych chunkov.

**VERSION 9.0.0, ale FCV 8.3.** Binárka je 9.0, featureCompatibilityVersion zostala na 8.3 — normálny stav po Atlas auto-upgrade (rollback musí ostať možný). Funkcie viazané na FCV 9.0 sú preto zatiaľ vypnuté. Pri ladení „prečo mi tá nová vec nejde" pozerať FCV, nie VERSION.

## Čo je overené ako funkčné

**`$rankFusion`** — beží. (Vyžaduje 8.0+; na 8.0.x by bol potrebný support case, to sa nás netýka.)

**`$rerank`** — beží, empiricky overené cez `scripts/rerank_probe.mjs`. Povinné sú **štyri** polia, server ich pýta postupne v tomto poradí:

```js
{ $rerank: { query: { text: "..." }, path: "text", model: "rerank-2", numDocsToRerank: 20 } }
```

Chýbajúce pole = `Failed to deserialize rerank stage spec: missing field \`X\``. Nie je to tichá chyba, server spec odmietne — čo je dobre.

## Rerank modely — všetkých päť prijatých

Atlas → AI Model APIs → Rate Limits uvádza dve skupiny; **limity sú skupinové**, takže prechod na novší model nestojí žiadnu kapacitu:

| Skupina | TPM | RPM |
|---|---|---|
| `rerank-2`, `rerank-3`, `rerank-2.5` | 2 000 000 | 2 000 |
| `rerank-2-lite`, `rerank-3-lite`, `rerank-2.5-lite` | 4 000 000 | 2 000 |

`$rerank` prijal všetkých päť skúšaných. Na `rerank-2` sme len preto, že ho má `rerankStages()` natvrdo ako default; parameter na zmenu cez profil tenanta (`rerankModel`) už existuje.

**Skóre z rôznych modelov sa NEDAJÚ porovnávať** — každý reranker má vlastnú kalibráciu.

## Namerané: modely sa rozchádzajú, rozhodnutie nie je bezpredmetné

`scripts/rerank_compare.mjs`, 20 otázok zo zlatej sady, top-5, rola internal (2026-09-06):

| dvojica | prekryv@5 | rovnaké #1 | identické poradie |
|---|---|---|---|
| bez reranku ⇄ rerank-2 | 56 % | 50 % | 0 % |
| bez reranku ⇄ rerank-2.5 | 59 % | 45 % | 0 % |
| bez reranku ⇄ rerank-3 | 60 % | 30 % | 0 % |
| rerank-2 ⇄ rerank-2.5 | 66 % | 40 % | 0 % |
| rerank-2 ⇄ rerank-3 | 70 % | 40 % | 0 % |
| rerank-2.5 ⇄ rerank-3 | 83 % | 80 % | 5 % |

Dva závery:

1. **Rerank robí veľa.** Oproti čistému `$rankFusion` mení viac než polovicu top-5 a v polovici prípadov aj prvé miesto. Nie je to kozmetika.
2. **Výber modelu je skutočné rozhodnutie.** `rerank-2` sa od novších líši v tretine top-5. `rerank-2.5` a `rerank-3` sú si navzájom blízke (83 %, rovnaké #1 v 80 %), takže spor je hlavne „stará dvojka verzus novšie", nie 2.5 verzus 3.

**Ktorý je lepší, sa stále nevie** a týmito číslami sa to zistiť nedá. Rozhodne až meranie proti zlatej sade. Výsledky behov: `eval/vysledky/rerank_compare_*.json`.

## Blokované: zlatá sada je prázdna

`eval/seed/questions_seed.json` má **74 otázok, ale 0 vyplnených `goldChunkIds` a 0 `goldAnswer`** (`status: "draft"`). Čaká na legislatívca SFZ — presne ako hovorí `docs/D9_EVAL_zlata_sada.md`. Metrika `retrieval_hit5` z `eval/run_eval.py` (prah ≥ 0.90) preto nemá proti čomu merať.

Vzhľadom na čísla vyššie to prestáva byť len administratívny dlh: kým sada nie je vyplnená, beží sa na modeli, ktorý bol vybraný ako predvoľba, nie ako výsledok merania.

## Ako testovať (a ako netestovať)

Kolekcia s chunkami je **`document_chunks`**, nie `chunks`. Dotaz nad neexistujúcou kolekciou **nevráti chybu, len prázdny výsledok** — „0 výsledkov" nie je dôkaz, že stage nefunguje:

- `Unrecognized pipeline stage name` → stage server nepozná (verzia / FCV)
- prázdny výsledok → stage prešiel, chyba je v dátach, názve kolekcie alebo indexu

Testy proti Atlasu spúšťať cez Control your Mac — pozri [[git-workflow-mounted-repo]]. Skripty čítajúce konfiguráciu z prostredia pozri [[env-prazdne-hodnoty]].
