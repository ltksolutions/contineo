# Otvorené rozhodnutia — backlog (Contineo)

> **Účel:** jeden zoznam vecí, ktoré treba zmapovať a rozhodnúť pred/počas implementácie. Každé rozhodnutie má návrh (odporúčanie), aby sa dalo rýchlo uzavrieť.
> **Stav:** založené 2026-06-26. Koncepčné návrhy (číselníky, ingescia, reconciliation, prístup, web) sú hotové — toto je ďalšia vrstva rozhodnutí.
> **Súvisiace:** `docs/CISELNIKY_governance.md`, `docs/INGESTION_zdroje_reconciliation.md`, `docs/PRISTUPOVE_PRAVA.md`, `docs/rag-architecture.md`, `docs/TODO.md`.
> **Legenda priority:** 🔴 vysoká (blokujúce / ovplyvňuje správnosť) · 🟡 stredná · 🟢 nízka. **Stav:** ⬜ otvorené · 🔄 rozpracované · ✅ rozhodnuté.

## Prehľad

| ID | Rozhodnutie | Okruh | Priorita | Fáza | Stav |
|---|---|---|---|---|---|
| D1 | Chunking stratégia | Vyhľadávanie | 🔴 | 2/4 | ✅ |
| D2 | Query → filtre (extrakcia entít) | Vyhľadávanie | 🔴 | 4/5 | ✅ |
| D3 | Odpovedacia politika | Vyhľadávanie | 🔴 | 3/4 | ✅ |
| D4 | Ladenie rankingu (váhy/prahy) | Vyhľadávanie | 🟡 | 7 | ✅ |
| D5 | Precedencia / konflikt noriem | Doménová logika | 🔴 | 4/5 | ✅ |
| D6 | Verzovanie a platnosť (ročníky) | Doménová logika | 🔴 | 4 | ✅ |
| D7 | Sportnet webhook + sync | Identita | 🟡 | 5 | ✅ |
| D8 | Onboarding tenanta | Identita | 🟡 | 5 | ✅ |
| D9 | Eval & kvalita pred go-live | Compliance | 🔴 | 7 (pripraviť skoro) | ✅ → `D9_EVAL_zlata_sada.md` |
| D10 | GDPR / audit / retencia | Compliance | 🔴 | prierezové | ✅ |
| D11 | Helpdesk + qa_pairs governance | Prevádzka | 🟡 | 4b | ✅ |
| D12 | Email politika (auto-reply) | Prevádzka | 🟡 | 4b/6 | ✅ |
| D13 | Scheduler / freshness | Prevádzka | 🟡 | 6 | ✅ |
| D14 | Widget / embedding | Prevádzka | 🟢 | 5/6 | ✅ |
| D15 | Modely / fallback / náklady | Prevádzka | 🟢 | 7 | ✅ → ADR-001 (O1 zmerané 26.7.) |
| D16 | Kotva citácie na stranu originálu | Vyhľadávanie | 🟡 | 7 | ⬜ |
| D17 | Tabuľky pri extrakcii z PDF | Ingescia | 🟡 | 7 | 🔄 čiastočne |

---

## Okruh 1 — Vyhľadávanie a kvalita odpovedí

### D1 — Chunking stratégia 🔴
**Otázka:** veľkosť chunku, prekryv, ako rešpektovať § / článok / odsek, ako niesť kontext (nadpis, `articleRef`) do každého chunku, ako spracovať tabuľky a dlhé odseky.
**Prečo:** najväčší jediný vplyv na kvalitu vyhľadávania; embedding reprezentuje práve obsah chunku.
**Odporúčanie:** štruktúrne chunkovanie po hraniciach normy (článok/§/odsek), nie podľa fixného počtu znakov; do každého chunku vložiť „breadcrumb" (norma → sekcia → §) a vyplniť `heading`/`articleRef`; cieľová veľkosť ~300–800 tokenov s malým prekryvom len tam, kde odsek prečnieva.
**✅ Rozhodnuté (2026-06-26):** štruktúrne po hraniciach normy + breadcrumb kontext v každom chunku, ~300–800 tokenov. Implementácia v ingestion pipeline (Fáza 2/4).

### D2 — Query → filtre (extrakcia entít) 🔴
**Otázka:** ako z otázky určiť `sectionKey`, riadiaci zväz (`companyCode`/súťaž), jazyk.
**Prečo:** bez toho nefunguje routing rozpisov ani zúženie na sekciu.
**Odporúčanie:** ľahká LLM extrakcia entít (súťaž, zväz, téma) proti číselníkom + kontext prihláseného používateľa (jeho zväzy/kluby) ako default; filtre vždy validovať voči `codelists` (governance kap. 5.3).
**✅ Rozhodnuté (2026-06-26):** LLM extrakcia entít z otázky + kontext prihláseného používateľa; filtre validované voči `codelists`.

### D3 — Odpovedacia politika 🔴
**Otázka:** formát citácií, správanie pri slabej zhode (radšej „neviem"), jazyk odpovede, tón, dĺžka.
**Odporúčanie:** vždy citovať normu + verziu + `articleRef`; pri skóre pod prah neodpovedať vecne, ale ponúknuť ticket/upresnenie (žiadne halucinácie); odpovedať v jazyku otázky; vecný, úradne presný tón.
**✅ Rozhodnuté (2026-06-26):** citačná politika + žiadne halucinácie; pri slabej zhode upresnenie/ticket; jazyk otázky; vecný úradný tón.

### D4 — Ladenie rankingu 🟡
**Otázka:** váhy `$rankFusion` (teraz 60/40), `numCandidates`, prah rerank, kedy fulltext vs vektor.
**Odporúčanie:** ponechať default 60/40, ladiť až podľa eval setu (D9); zafixovať až po meraní.
**✅ Rozhodnuté (2026-06-26):** default 60/40 + rerank; ladiť až podľa zlatej sady (D9).

---

## Okruh 2 — Doménová logika

### D5 — Precedencia / konflikt noriem 🔴
**Otázka:** keď „Rozpis súťaží" zväzu upresňuje pravidlo zo „Súťažného poriadku SFZ", ktoré platí pre danú súťaž?
**Prečo:** priamo ovplyvňuje správnosť odpovede; futbal má vrstvené predpisy.
**Odporúčanie:** „lex specialis v medziach": pre konkrétnu súťaž platí rozpis riadiaceho zväzu tam, kde upresňuje, ale nesmie ísť nad rámec SFZ poriadku; v odpovedi uviesť **oba** zdroje (SFZ poriadok + rozpis zväzu) a ktorý je špecifickejší. Potvrdiť s legislatívcom.
**✅ Rozhodnuté (2026-06-26):** lex specialis v medziach SFZ poriadku; odpoveď uvádza oba zdroje a označí špecifickejší. Pravidlá R1–R4 spísané v **`docs/PRECEDENCIA_NORIEM.md`**. *Ešte formálne potvrdiť konkrétne § s legislatívcom SFZ.*

### D6 — Verzovanie a platnosť (ročníky) 🔴
**Otázka:** ako koexistujú verzie (starý/nový rozpis, novelizácia poriadku), čo je „platná" verzia pri dotaze, hranice súťažného ročníka.
**Odporúčanie:** `effectiveFrom/To` + `isActive`; pri dotaze default = aktuálne platná verzia k dnešku; umožniť explicitný dotaz na historickú verziu; ročník viazať na `effectiveFrom/To` rozpisu.
**✅ Rozhodnuté (2026-06-26):** `effectiveFrom/To` + `isActive`; default platná verzia k dnešku, historická na explicitný dotaz; ročník viazaný na dátumy platnosti rozpisu.

---

## Okruh 3 — Identita, sync a onboarding

### D7 — Sportnet webhook + sync 🟡 *(čaká na CRM connector)*
**Otázka:** aké udalosti webhook posiela, čo pri zmene/zrušení príslušnosti osoby, výkon pri 130k osobách.
**Odporúčanie:** sync pri logine + webhook na zmeny; cache `person_memberships`; pri zrušení príslušnosti okamžite odobrať skupiny (default-deny). Detail polí podľa CRM API.
**✅ Rozhodnuté (2026-06-26):** login + webhook + cache; okamžité odobratie skupín pri zrušení príslušnosti. *Detail polí podľa CRM API (čaká na connector).*

### D8 — Onboarding tenanta 🟡
**Otázka:** zdieľané vs. per-tenant číselníky, default skupiny, kto je prvý admin/uploader nového zväzu.
**Odporúčanie:** doménové číselníky (`sectionKey`, `category`) zdieľané naprieč futbalom; `companyCode`, skupiny a `cms_uploaders` per tenant; prvý admin sa nastaví ručne pri onboardingu.
**✅ Rozhodnuté (2026-06-26):** doménové číselníky zdieľané; `companyCode`, skupiny, `cms_uploaders` per tenant; prvý admin ručne.

---

## Okruh 4 — Prevádzka a compliance

### D9 — Eval & kvalita pred go-live 🔴 *(pripraviť skoro, brána pred spustením)*
**Otázka:** sada zlatých otázok, metriky (presnosť, citovateľnosť, miera „neviem"), akceptačné prahy.
**Odporúčanie:** zostaviť 50–100 reálnych otázok s overenými odpoveďmi a zdrojmi; merať pred každým väčším releasom; go-live až po dosiahnutí prahu. V normatívnej doméne je zlá odpoveď drahá.
**✅ Rozhodnuté (2026-06-26):** zlatá sada 50–100 otázok + akceptačný prah ako brána pred go-live; merať pred každým releasom. *Začať zbierať otázky už počas Fázy 4.*
**Kostra hotová (2026-07-25):** 74 návrhov otázok, hárok pre legislatívca, konvertor a merací skript s prahmi → `docs/D9_EVAL_zlata_sada.md`, materiály v `eval/`. Chýbajú overené odpovede a § — to je otvorený bod E1.

### D10 — GDPR / audit / retencia 🔴 *(prierezové)*
**Otázka:** čo logovať v konverzáciách (PII), ako dlho držať, právo na výmaz, DPA so Sportnetom, audit prístupov.
**Odporúčanie:** minimalizovať PII v logoch; definovať retenčné lehoty; audit „kto/čo/kedy videl"; zmluvný rámec so Sportnetom na dáta osôb. Brand stojí na súkromí — toto musí byť explicitné.
**✅ Rozhodnuté (2026-06-26):** zväz = prevádzkovateľ, Contineo = sprostredkovateľ; minimalizácia PII, navrhnuté retenčné lehoty, audit, sub-procesori + DPA. Rámec v **`docs/GDPR_DATA_PROTECTION.md`**. *Lehoty, DPA a DPIA potvrdí právnik/DPO pred produkciou.*

### D11 — Helpdesk + qa_pairs governance 🟡
**Otázka:** SLA, kto rieši tickety per zväz, či `qa_pairs` dostávajú `accessLevel`/`companyCode`, či ich reconciliation preznačkuje pri zmene normy.
**Odporúčanie:** `qa_pairs` tagovať rovnako ako obsah (vrátane prístupu) a zahrnúť do reconciliation; SLA a smerovanie ticketov per zväz; kurované odpovede expirovať, keď sa zmení podkladová norma.
**✅ Rozhodnuté (2026-06-26):** `qa_pairs` tagované ako obsah (accessLevel/companyCode), súčasť reconciliation, expirácia pri zmene normy; SLA a smerovanie ticketov per zväz.

### D12 — Email politika 🟡
**Otázka:** smie bot auto-odoslať odpoveď, alebo vždy cez človeka?
**Odporúčanie:** **nikdy auto-odoslať** bez schválenia človekom; bot len pripraví návrh do ticketu (bezpečnostné pravidlo).
**✅ Rozhodnuté (2026-06-26):** nikdy auto-odoslať; bot pripraví návrh, odošle človek po schválení.

### D13 — Scheduler / freshness 🟡
**Otázka:** ako často crawlovať legislatívu SFZ a rozpisy, detekcia zmien, re-import.
**Odporúčanie:** denne hash-diff legislatívy + rozpisov; re-import len zmeneného (Fáza 6); nový ročník rozpisov ako nová verzia (D6).
**✅ Rozhodnuté (2026-06-26):** **manuálne / on-demand** — re-import spúšťa správca; bez automatického crawl-u (zatiaľ). Pri re-importe stále platí change-detection (hash) a verzovanie (D6). Automatizáciu možno doplniť neskôr.

### D14 — Widget / embedding 🟢
**Otázka:** konfigurácia embed widgetu (companyCode kontext), theming, ochrana proti zneužitiu anonymného prístupu.
**Odporúčanie:** embed kód nesie `companyCode` kontext (PRISTUPOVE_PRAVA kap. 3/10-5); rate-limiting a len `public` pre anonym.
**✅ Rozhodnuté (2026-06-26):** embed s `companyCode` kontextom (zúženie na zväz + globálne SFZ), rate-limiting, len `public` pre anonym.

### D15 — Modely / fallback / náklady 🟢
**Otázka:** kedy presne padá Ollama → Claude, sledovanie nákladov (Voyage tokeny, Claude), výber lokálnych modelov.
**Odporúčanie:** fallback na timeout/chybu/nízku kvalitu; monitoring nákladov (Fáza 7); priebežne testovať nové lokálne modely.
**✅ Rozhodnuté (2026-06-26):** Ollama llama3.2 primárny + Claude fallback (timeout/chyba/nízka kvalita); monitoring nákladov.

---

## Navrhnuté poradie (sprinty)

> **Stav 2026-06-26: všetkých 15 rozhodnutí (D1–D15) je uzavretých ✅.** D5 a D10 sú rozpracované do samostatných dokumentov (`PRECEDENCIA_NORIEM.md`, `GDPR_DATA_PROTECTION.md`); zostáva len **externé potvrdenie** — konkrétne § (legislatívec SFZ) a právne posúdenie lehôt/DPA/DPIA (právnik/DPO). Ďalej už ide o implementáciu podľa fáz.

**Sprint 1 — základy (teraz):** D1 chunking · D5 precedencia noriem · D2 query→filtre · D6 verzovanie. *Bez týchto nemá zmysel ladiť zvyšok.*

**Sprint 2 — kvalita a právny rámec:** D3 odpovedacia politika · D9 eval set (začať zbierať) · D10 GDPR baseline.

**Sprint 3 — identita a helpdesk (po CRM connectore):** D7 sync · D8 onboarding · D11 helpdesk/qa_pairs · D12 email politika.

**Priebežne / neskôr:** D4 ranking · D13 scheduler · D14 widget · D15 modely/náklady.

---

## Okruh 6 — Extrakcia z PDF (otvorené 2026-07-26)

Obe vznikli pri stavbe chunkera nad reálnymi predpismi SFZ. Prevod **PDF → Markdown → chunky**
je správny (text treba tak či tak, Markdown je verzovateľný a oddeľuje zlyhanie extrakcie od
zlyhania chunkovania — viď `INGESTION_zdroje_reconciliation.md`), ale niečo sa pritom stráca.

### D16 — Kotva citácie na stranu originálu 🟡

**Otázka:** má citácia obsahovať aj číslo strany v pôvodnom PDF, teda `čl. 8 ods. 15–23, s. 12`
namiesto len `čl. 8 ods. 15–23`?

**Prečo:** chunker odstraňuje čísla strán (`41/85`) ako opakujúci sa šum — inak by kazili embedding
aj fulltext. Pri právnom dokumente je však „strana 42" legitímny spôsob, ako niekoho nasmerovať
do originálu, najmä keď ho číta vytlačený alebo v prehliadači PDF.

**Odporúčanie:** zachytiť číslo strany **pred** čistením a uložiť ho na chunk ako `sourcePage`
(prípadne rozsah `sourcePageFrom/To`, keď chunk preteká cez stranu). Je to lacné a nemení
chunkovanie — len sa pridá pole. Do citácie sa zapojí až vtedy, ak sa ukáže, že to používatelia
chcú.

**Kedy rozhodnúť:** po prvom kole D9, podľa toho, či hodnotitelia budú citácie dohľadávať v PDF.
Import je idempotentný (verzia = hash obsahu), takže doplnenie znamená len opakovaný beh.

### D17 — Tabuľky pri extrakcii z PDF 🟡

**Otázka:** stačí `markitdown`, alebo treba extrakciu s vedomím rozloženia (`pdfplumber`, `PyMuPDF`)?

**Prečo:** hlavičky tabuliek prichádzajú rozpadnuté na samostatné riadky —
`do 1. do 2. do 3.…` a `ligy ligy ligy…` — ktoré oddelene nič neznamenajú. Dátové riadky sú
neporušené a samopopisné (`z 1. ligy 6.000 € 4.500 €…`), takže dnes to funguje. **Riziko je
v delení:** keby sa väčšia tabuľka rozdelila medzi dva chunky, druhá polovica by boli čísla
bez hlavičiek a otázka typu *„koľko je odstupné z 5. ligy do 3. ligy?"* by na nej zlyhala.

Overené na tabuľkách odstupného v RaPP (čl. 37b): momentálne sa zmestia do jedného chunku
aj s hlavičkou — ale je to zhoda okolností, nie vlastnosť návrhu.

**Možnosti:**

1. **Nechať tak** — sledovať cez D9, či otázky na tabuľky zlyhávajú.
2. **Chunker nikdy nerozdelí tabuľku** — lacná poistka, drží tabuľku pohromade aj za cenu
   väčšieho chunku.
3. **Extrakcia s rozložením** (`pdfplumber` / `PyMuPDF`) — zachová skutočnú štruktúru tabuliek
   aj čísla strán (rieši aj D16). Podstatne viac práce.
4. **Vision model na tabuľky** — najlepší výsledok, ale drahý, nedeterministický a pre
   air-gap by si vyžadoval lokálny VLM.

**✅ Rozhodnuté (2026-07-26) — možnosť 2 zavedená.** Chunker tabuľku **nikdy nedelí**, ani keď
presiahne cieľový limit. Tabuľku otvára popis (`Tabuľka č. N`) alebo markdownový riadok (`|`),
zatvára ju až štruktúrny prvok (článok, časť, príloha, nový odsek). Chunk s tabuľkou nesie
príznak `obsahujeTabulku`. Implementácia: `app/scripts/lib/chunker.mjs`, pokryté testami.

**Zostáva otvorené:** či siahnuť po extrakcii s rozložením (možnosť 3). Rozhodnúť **až keď D9
ukáže, že tabuľkové otázky zlyhávajú** — bez dôkazu by to bola predčasná optimalizácia.

**Súvisiace:** `app/scripts/lib/chunker.mjs`, `docs/INGESTION_zdroje_reconciliation.md`

