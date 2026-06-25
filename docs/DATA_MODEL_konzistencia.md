# Konzistencia dátového modelu — na rozhodnutie

Pri audite (jún 2026) som našiel **dva odlišné dátové modely** v jednom repozitári. Treba zvoliť kanonickú verziu, nech web aj implementácia hovoria to isté.

## Stav: dve „pravdy"

### A) Implementácia + interné docs
Súbory: `app/src/lib/mongoSearch.ts`, `app/src/app/api/chat/`, `docs/rag-architecture.md`, `docs/Contineo_RAG_Projektovy_plan.md`

```
Kolekcie:  rag_chunks · rag_documents · rag_chat_history
Polia:     access_level (public|internal) · language · tags · chunk_index
```

### B) Verejná stránka /technologia (+ nový diagram)
Súbory: `web/components/Tech.js`, `web/lib/dictionaries.js`, `contineo_diagram.*`

```
Kolekcie:  document_chunks · qa_pairs · tickets · conversations
Polia:     sectionKey · associationCode · scope (global|zvaz|oblast) · articleRef · isActive · effectiveFrom/To
```

## V čom je rozdiel
- **Iné názvy kolekcií** pre to isté („chunky" = `rag_chunks` vs `document_chunks`).
- **Iný model prístupu/rozsahu**: implementácia rieši `access_level` (public/internal), web rieši `scope` + `associationCode` (SFZ/Zväz/oblasť) — to je doménový model pre futbalové zväzy.
- **Web má navyše** `qa_pairs`, `tickets`, `conversations`, verzovanie (`isActive`, `effectiveFrom/To`) a citácie (`articleRef`) — implementácia ich (zatiaľ) nemá.

## Možnosti
1. **Web je cieľový stav (odporúčané)** — implementácia sa postupne prispôsobí modelu B (zväzové `scope`/`associationCode`, verzovanie, `qa_pairs`, `tickets`). Web netreba meniť; doplniť do `rag-architecture.md` poznámku „cieľová schéma = model B, migrácia vo Fáze 4/5".
2. **Implementácia je realita** — web/technologia sa prepíše na model A (`rag_chunks`, `access_level`). Stráca sa zväzová špecifickosť v marketingu.
3. **Zladiť názvy, ponechať dve úrovne** — premenovať `rag_chunks` → `document_chunks` (a pod.) hneď, ostatné polia migrovať neskôr.

## Otvorené otázky pre rozhodnutie
- Kanonický názov kolekcie chunkov: `document_chunks` vs `rag_chunks`?
- Prístupový model: `access_level` (public/internal) **a/alebo** `scope`+`associationCode`?
- Kedy reálne vzniknú `qa_pairs`, `tickets`, `conversations` v implementácii (ktorá fáza)?

> Toto je návrh na diskusiu, nič som zatiaľ neprepísal. Po rozhodnutí viem zladiť kód aj docs jedným commitom.
