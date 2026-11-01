---
name: o7-on-prem-embedding
description: "O7 — vlastný embedding a rerank pre on-prem vetvu Continea: čo z neho platí, čo je odložené a prečo"
type: project
sources: [cowork-import]
imported_at: 2026-09-15T09:35:44Z
---

# O7 — on-prem embedding a rerank (stav 2026-08-27)

Plán je v `docs/O7_plan_overenia.md` (vznikol 28. 7. v inej relácii, do repozitára doplnený až 27. 8.).

## Dva nálezy, ktoré prežili aj odklad

**Nález A — TEI `voyage-4-nano` NEPODPORUJE.** Otvorená [issue #816](https://github.com/huggingface/text-embeddings-inference/issues/816) zo 6. 2. 2026, bez PR. Štítok `text-embeddings-inference` na karte modelu je v rozpore s issue v samotnom repozitári TEI.

**Poučenie, ktoré platí všeobecne: štítok na karte modelu nie je záväzok podpory — overovať v repozitári servera, nie na karte modelu.**

Dôsledok bol vážny: ADR-001 na tomto predpoklade **zatvorilo otázku** „ktorý server pre nano" a jeho príklad T3 profilu (`kind: "tei"` + `voyage-4-nano`) sa nedal postaviť. Opravené 2026-08-27 ako **ADR-001 dodatok 10**: T3 príklad prepísaný na `kind: "infinity"` (vLLM/Infinity, OpenAI tvar), otázka znovu otvorená ako **O7-a**.

**Nález B — chýbajúce prompty sú tichá chyba.** `voyage-4-nano` používa iné prompty pre dotaz („Represent the query…") a pre dokument („Represent the document…"); `EmbeddingProvider.embed(texts: string[])` o nich nevie. Bez nich sa vektory posunú do inej časti priestoru — **nespadne to, len horšie hľadá** — a meranie O1 (zdieľaný vektorový priestor) na produkčný adaptér neplatí.

Nie je to živá chyba: reťaz beží cez `atlas-auto` (prompty rieši Voyage cez `input_type`) a `embed()` sa v projekte nikde nevolá. Je to pasca pre prvého, kto prepne tenanta na on-prem.

**Zavedená poistka (2026-08-27):** `HttpEmbeddingProvider.embed()` v `app/src/lib/providers/embedding/http.ts` **tvrdo zlyhá** s odkazom na fázu 0. Drôtový tvar volania zostal v `embedRaw()`, takže testy tvaru požiadavky a parsovania odpovede platia ďalej. Rovnaký princíp ako `embeddingGuard.ts`.

## Čo je odložené a prečo

**Fázy 1–5 idú za Fázu 8 (onboarding).** Nebola to zmena názoru na O7 — zmenilo sa poradie práce pred ním:

1. Fáza 8 **nevolá žiadny model**, takže spĺňa `eu-full` bez O7 (ADR-003 kap. 5.5).
2. D34 zaraďuje on-prem na vetvu veľkých organizácií, ktorá nie je primárny produkt.
3. O12 rozhodlo zostať na Verceli — odložil sa celý smer odchodu zo zdieľanej infraštruktúry, ktorého je O7 súčasťou (`T2` aj `eu-full` ho potrebujú rovnako, ADR-002 dodatok 10).

**Vrátiť sa, keď** o on-prem alebo vyhradené prostredie požiada konkrétny zákazník alebo tender.

**Zostáva z fázy 0** (~pol dňa, len kód, žiadne inštalácie): rozlíšenie dotaz/dokument v `EmbeddingProvider`, prompty do konfigurácie adaptéra (sú vlastnosťou modelu, nie natvrdo v kóde), test „ten istý text ako dotaz a ako dokument dá rôzne vektory", odovzdať typ z `mongoSearch.ts` a `import.mjs`. Poistka to teraz aj vynúti — fáza 1 sa bez toho nespustí.

Fázy 1–5 vyžadujú Docker Desktop, Ollamu, `pip install infinity-emb` na používateľovom stroji a HF účet; 1–2 dni sústredenej práce.
