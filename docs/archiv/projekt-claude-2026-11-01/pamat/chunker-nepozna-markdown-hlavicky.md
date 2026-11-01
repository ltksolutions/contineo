---
name: chunker-nepozna-markdown-hlavicky
description: Chunker a hlavičky v tvare Markdownu — opravené (CHUNKER_VERSION 2); prepis cez model zahodil úroveň ČASŤ, preto sa ešte nepreindexováva
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

**Opravené 2026-09-14 (commit `cfa8c1e`), `CHUNKER_VERSION` 1 → 2.**

Text v databáze prechádza prepisom cez jazykový model (`llmRewrite.ts`) a hlavičky
v ňom nie sú `Článok 5`, ale `## čl. 5 — Názov`. Zmerané: **547 hlavičiek,
14 tvarov**, z toho 349× `## čl. N — …` a 126× `## čl. N ods. N–N — …`.

Chunker teraz pozná oba tvary. Rozšírené sú **vzory, nie parsovacia slučka** —
tá je odladená na deviatich predpisoch. Rozpoznanie článkov je späť na 92–99 %
(bolo 0 %), takže poistka `library.reindexWouldLoseArticles` prejde sama.

**`ods. N–N` je súčasťou čísla**, nie šum. Prvá verzia opravy ho zahadzovala:
počty úsekov aj podiel rozpoznaných článkov sedeli **dokonale**, a napriek tomu
bola horšia — citácia „čl. 2 ods. 1–6" by sa scvrkla na „čl. 2". Odhalilo sa to
až porovnaním **textu** úsekov. *Zhodné čísla nie sú dôkaz zhodného výsledku.*

**Analyzátor a chunker musia poznať ten istý tvar** — keď sa jeden naučí nový,
druhý sa musí naučiť tiež (`chunkingAnalysis.ts`).

## 🔴 Preindexovanie stále nespúšťať

Druhý nález: **prepis cez jazykový model zahodil úroveň `ČASŤ`.** V dnešnom
`versions[].markdown` nie je ani raz (Disciplinárny poriadok 0, Stanovy 0), hoci
uložené úseky ju v breadcrumbe majú — vznikli z pôvodného textu. Preindexovaním
by sa tá úroveň stratila aj z indexu.

Nie je to chyba chunkera, je to **strata v publikovanom texte** — v tom, čo ľudia
čítajú a potvrdzujú. Pôvodné PDF sú v GridFS, takže sa to dá opraviť.

Rozhodnúť (TODO, O2): (a) prepis má `ČASŤ` zachovať a dokumenty sa nahrajú znova,
alebo (b) `ČASŤ` sa vedome opúšťa a preindexuje sa tak, ako to je.

Nástroje: `npm run chunking:status`, `npm run chunking:analyze`.
Súvisí s [[chunking-per-dokument-d79]].
