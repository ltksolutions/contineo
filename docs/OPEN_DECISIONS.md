# Otvorené rozhodnutia — backlog (Contineo)

> **Účel:** jeden zoznam vecí, ktoré treba zmapovať a rozhodnúť pred/počas implementácie. Každé rozhodnutie má návrh (odporúčanie), aby sa dalo rýchlo uzavrieť.
> **Stav:** založené 2026-06-26. Koncepčné návrhy (číselníky, ingescia, reconciliation, prístup, web) sú hotové — toto je ďalšia vrstva rozhodnutí.
> **Súvisiace:** `docs/CISELNIKY_governance.md`, `docs/INGESTION_zdroje_reconciliation.md`, `docs/PRISTUPOVE_PRAVA.md`, `docs/rag-architecture.md`, `docs/TODO.md`.
> **Legenda priority:** 🔴 vysoká (blokujúce / ovplyvňuje správnosť) · 🟡 stredná · 🟢 nízka. **Stav:** ⬜ otvorené · 🔄 rozpracované · ✅ rozhodnuté.
> **Číslovanie (2026-08-27):** `CMS_KONCEPCIA.md` avizuje prenos rozhodnutí D-CMS-1..6 „ako D16+", ale D16 a D17 medzitým obsadili rozhodnutia o extrakcii z PDF. **D18–D23 sú preto rezervované pre D-CMS-1..6** (prenos pri najbližšej revízii backlogu) a nové rozhodnutia pokračujú od **D24**. Otvorené body ADR (séria `O…`) sú vedené v samotných ADR — tu sa na ne len odkazuje.

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
| D18–D23 | *rezervované pre D-CMS-1..6* | CMS | — | 4 / CMS-Web | 🔒 rezervované |
| D24 | `acknowledgements` ako auditný záznam | Onboarding | 🔴 | 8 | ✅ |
| D25 | Potvrdenie viazané na `versionId` (`documents.versions[]`) | Onboarding | 🔴 | 8 | ✅ |
| D26 | Zoznam pozvaných z premennej do `persons` | Identita | 🔴 | 8 | ✅ |
| D27 | Nosič guided readingu (`onboarding_tracks`) | Onboarding | 🟡 | 8 | ✅ |
| D28 | Znenie potvrdzovacej formulky | Onboarding | 🔴 | 8 | ✅ |
| D29 | Rozlíšenie tenanta podľa hostiteľa | Nasadenie | 🟡 | 8 | ✅ |
| D30 | Čo je „podstatná zmena" (opätovné potvrdenie) | Onboarding | 🟢 | 9 | ✅ zrušené — nahradil `reason` pri pridelení |
| D31 | Produkčný Atlas tier a zálohy (M0 → M10+) | Prevádzka | 🔴 | 8 | ✅ |
| D32 | Viditeľnosť obsahu v hierarchii tenantov | Identita | 🔴 | 5/8 | ✅ |
| D33 | Rozsah HR dashboardu naprieč hierarchiou | Onboarding | 🟡 | 8 | ✅ |
| D34 | Model dodávky: SaaS vs. vlastné nasadenie | Produkt | 🟡 | prierezové | ✅ |
| D35 | Viacjazyčnosť: prostredie áno, obsah nie | Produkt | 🔴 | 8 | ✅ |
| D36 | Widget ukazuje „čo čaká na mňa", nie prehľad organizácie | Onboarding | 🟡 | 9 | ✅ |
| D37 | Úloha sa odvodzuje, pridelenie sa zaznamenáva | Onboarding | 🔴 | 9 | 🟡 návrh |
| D38 | `persons.groups` ako tretia dimenzia | Identita | 🟡 | 9 | 🟡 návrh |
| D39 | „Nové" sa počíta voči `lastLoginAt` | Onboarding | 🟢 | 9 | ✅ |
| D40 | Jednorazové systémové hlásenia v rozsahu A | Onboarding | 🔴 | 9 | ✅ |
| D41 | `platform-admin` vidí naprieč tenantmi (výnimka z D32) | Identita | 🔴 | 5b | ✅ |
| D42 | Správa tenantov beží len na doméne dodávateľa | Identita | 🔴 | 5b | ✅ |

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

> **Stav 2026-08-29: z D1–D34 sú otvorené už len dve.** ⬜ **D16** (kotva citácie na stranu
> originálu — rozhodnúť po prvom kole D9), 🔄 **D17** (tabuľky z PDF — možnosť 2 zavedená, extrakcia
> s rozložením otvorená). **D30** sa 2026-08-29 zrušila: definícia „podstatnej zmeny" neexistuje
> a nahradil ju povinný dôvod pri pridelení (D37). **D18–D23** sú rezervované pre prenos D-CMS-1..6 z `CMS_KONCEPCIA.md`.
> Otvorené body ADR (séria `O…`) sú vedené v samotných ADR: **O7** (vlastný embedding a rerank —
> odložené za Fázu 8), **O8, O9, O11** (ADR-002), **O13–O16** (ADR-003, čakajú na HR/DPO/právnika).
>
> *Pôvodné zhrnutie z 2026-06-26 ponechané nižšie — sprinty 1–3 sú odvtedy prekonané fázovým plánom
> v `Contineo_RAG_Projektovy_plan.md`, kde je aj Fáza 8 (onboarding), ktorá dnes beží ako prvá.*

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

---

## Okruh 7 — Onboarding a potvrdzovanie noriem (otvorené 2026-08-27)

> Vznikli pri zadaní SFZ: vyše sto ľudí má potvrdiť oboznámenie s novými smernicami,
> vrátane externistov bez licencie M365. Zaradenie rozhoduje
> **`docs/ADR-003-onboarding-a-potvrdzovanie.md`**, koncepcia je v
> **`docs/ONBOARDING_KONCEPCIA.md`**. Ide o **Fázu 8**, ktorá beží pred dokončením
> fáz 4 a 5 a berie si z nich minimálny výrez v cieľovom tvare.

### D24 — `acknowledgements` ako auditný záznam 🔴

**Otázka:** je potvrdenie príznak na dokumente, alebo samostatný záznam?

**Prečo:** rozdiel sa prejaví až pri spore — a vtedy sa už nedá napraviť.

**✅ Rozhodnuté (2026-08-27):** samostatná **append-only** kolekcia `acknowledgements`.
Nesie odtlačok údajov v čase potvrdenia (`email`, `fullName`, `documentTitle`,
`versionLabel`, `effectiveFrom`) a **doslovné znenie** formulky, nie odkaz naň. Nikdy sa
neprepisuje ani nemaže — odvolanie či oprava je nový záznam so `supersedes`. Unikátny
index nad `{ companyCode, personId, versionId }` (partial na `type: "acknowledgement"`)
odmietne dvojité potvrdenie na úrovni databázy.

**Súvisiace:** `ONBOARDING_KONCEPCIA.md` kap. 3.2, ADR-003 kap. 5.1.

### D25 — Potvrdenie viazané na verziu, nie na dokument 🔴

**Otázka:** na čo presne ukazuje záznam o potvrdení?

**Prečo:** otázka pri audite neznie „potvrdil to?", ale „potvrdil **to znenie**, ktoré
platilo v čase, keď podľa neho mal konať?". `documents` pritom dnes **nemá** `versions[]` —
schéma je plochá a verzovanie je zatiaľ len zámer v `CMS_KONCEPCIA.md` (A.3).

**✅ Rozhodnuté (2026-08-27):** záznam nesie `versionId`. **Onboarding zavádza
`documents.versions[]` skôr než CMS**, a to rovno v cieľovom tvare, ktorý CMS potrebuje
(`versionId`, `label`, `effectiveFrom/To`, `isActive`, `contentHash`, `changeNote`,
`requiresReacknowledgement`). Je to najmenší výrez z Fázy 4, bez ktorého je potvrdenie
právne bezcenné.

**Spresnenie (2026-08-27, potvrdené zadávateľom):** verzovanie **nie je potreba onboardingu**,
je to **povinnosť celého systému**. Dokumenty majú jedno spoločné úložisko (`documents`) bez
ohľadu na to, ktorým vstupným kanálom prišli (upload, MCP, web link, API — `CMS_KONCEPCIA.md`
časť C), a zneplatňovanie starých znení je vlastnosť **dokumentu**, nie kanála. Onboarding
túto povinnosť len **zviditeľnil a implementuje ju prvý**.

Z toho plynú dve pravidlá, ktoré platia pre všetky kanály:

1. **Zmena obsahu = nová verzia, nikdy prepis.** Keď kanál pri re-syncu zistí iný `contentHash`
   (`INGESTION_zdroje_reconciliation.md` kap. 4), založí **novú položku** vo `versions[]`.
   Predchádzajúca zostáva a dostane `effectiveTo`. Prepísaním by sa spätne zmenilo, čo bolo
   kedy platné — a tým aj to, čo ľudia potvrdili.
2. **Kanál nikdy nezneplatní platnú verziu sám.** Nová verzia z kanála prichádza ako
   `isActive: false` a čaká na kurátora, ktorý určí `effectiveFrom` a prípadné `effectiveTo`
   predchádzajúcej. Automat nevie posúdiť právnu platnosť — vie len, že sa zmenil súbor.
   Je to ten istý princíp ako **D-CMS-6** (kanál smie predvyplniť, publikuje človek).

**Súvisiace:** D6, D-CMS-6, `INGESTION_zdroje_reconciliation.md` kap. 4, `PRECEDENCIA_NORIEM.md`.

**Súvisiace:** D6 (verzovanie a platnosť), `PRECEDENCIA_NORIEM.md`, ADR-003 kap. 5.2.

### D26 — Zoznam pozvaných z premennej do databázy 🔴

**Otázka:** kto sa smie prihlásiť — `POVOLENE_EMAILY`, alebo kolekcia?

**Prečo:** `src/lib/auth.ts` dnes drží zoznam v premennej a v komentári to aj zdôvodňuje
(*„pri piatich až desiatich ľuďoch je zmena premennej jednoduchšia"*). Pri stovke ľudí
to prestáva platiť: zoznam sa nedá udržiavať, každá zmena znamená nasadenie a k adrese
treba priviazať meno, útvar, typ osoby a trasu — čo do reťazca oddeleného čiarkami nepatrí.

**✅ Rozhodnuté (2026-08-27):** kolekcia **`persons`** ako doménová vrstva nad existujúcou
technickou `auth_users`. `POVOLENE_EMAILY` **zostáva ako núdzová brzda pre správcov**,
nie ako hlavná cesta. `persons` vzniká v tvare, ktorý potrebuje Fáza 5 (vrátane prázdneho
`externalRef` pre Sportnet a Entra ID).

**Súvisiace:** D8 (onboarding tenanta), `PRISTUPOVE_PRAVA.md` kap. 4, ADR-003 kap. 5.3.

### D27 — Nosič guided readingu 🟡

**Otázka:** kde žije „prejdi týchto N dokumentov v tomto poradí" a kde stav dokončenia?

**Prečo:** hrozí paralelná štruktúra vedľa `navigation`/`categories`, alebo druhá kópia
pravdy o tom, čo má kto hotové.

**✅ Rozhodnuté (2026-08-27):** kolekcia **`onboarding_tracks`** s poľom `steps[]`
(typ kroku, `documentId`, `requiresAcknowledgement`). **Stav dokončenia sa neukladá** —
odvodzuje sa z prieniku krokov trasy a existujúcich `acknowledgements`. Samostatná
`onboarding_progress` by bola druhá kópia pravdy, ktorá by sa rozišla práve pri novej
verzii dokumentu, teda vtedy, keď na správnosti najviac záleží. Krok typu `page` je
v modeli od začiatku, ale použije sa až v rozsahu C.

**Súvisiace:** `CMS_KONCEPCIA.md` (navigation, categories), `ONBOARDING_KONCEPCIA.md` kap. 3.4–3.5.

### D28 — Znenie potvrdzovacej formulky 🔴

**Otázka:** „prečítal som a **súhlasím**", alebo „**oboznámil som sa** a zaväzujem sa dodržiavať"?

**Prečo:** pri vnútornom predpise je súhlas právne zvláštny — smernica zaväzuje bez ohľadu
na to, či s ňou niekto súhlasí, a formulácia cez súhlas otvára otázku, čo platí pri
nesúhlase. Nie je to technické rozhodnutie.

**Odporúčanie:** *„Potvrdzujem, že som sa oboznámil s dokumentom „{názov}", verzia {label},
platná od {dátum}, porozumel som jeho obsahu a zaväzujem sa ho dodržiavať."* Bez ohľadu na
zvolené znenie musí formulka obsahovať **názov, verziu aj dátum platnosti** — inak sa o rok
nedá povedať, čo bolo potvrdené.

**✅ Rozhodnuté (2026-08-27):** ide sa cestou **oboznámenia a záväzku**, nie súhlasu.
Kanonické znenie:

> *Potvrdzujem, že som sa oboznámil s dokumentom „{názov}", verzia {label}, platná od
> {dátum}, porozumel som jeho obsahu a zaväzujem sa ho dodržiavať.*

Znenie sa ukladá **doslovne** do `acknowledgements.statementText` (D24), takže neskoršia úprava
formulácie nemení staré záznamy. Formálne posúdenie právnikom SFZ sa tým nevylučuje — ak
navrhne úpravu, zmení sa znenie pre **nové** potvrdenia a staré zostávajú platné v pôvodnom
tvare. Presne na to je `statementText` doslovný.

### D29 — Rozlíšenie tenanta podľa hostiteľa 🟡

**Otázka:** `intranet.futbalsfz.sk` — samostatné nasadenie, alebo doména nad jedným?

**✅ Rozhodnuté (2026-08-27):** **doména nad jedným nasadením.** `tenantProfile.ts` prestane
vracať `defaultProfile()` a začne profil vyberať podľa hostiteľa (`companyCode`, vzhľad,
rozsah obsahu). Platí pravidlo z ADR-002: **neznámy hostiteľ sa správa ako zakázaný**, nie
ako predvolený tenant. Nemení to nič z ADR-001 ani ADR-002 — mení sa len zdroj profilu.

**Súvisiace:** ADR-002 (profily, izolácia), `PRISTUPOVE_PRAVA.md` kap. 8, ADR-003 kap. 3.2 a 5.4.

**Implementované 2026-08-28** — `app/src/lib/tenants.ts` + kolekcia `tenants` (hostiteľ → `companyCode`,
vzhľad, jazyky), `onboardingContext()` v `session.ts`, uplatnené na `/dokumenty`, `/dokumenty/[documentId]`
a `POST /api/acknowledgements`. Neznámy hostiteľ dostane **404**, nie vysvetľujúcu hlášku: kto si nasmeruje
vlastnú doménu na naše nasadenie, sa nemá dozvedieť ani to, že tu niečo beží.

Profil poskytovateľov (`tenantProfile.ts`, ADR-001) zostal **samostatný**. Odpovedá na inú otázku — „ktorý
model a kde počíta" vs. „ktorá organizácia" — a keby boli v jednom zázname, neznámy hostiteľ by si so sebou
priniesol aj nastavenie poskytovateľov.

**Vedomé obmedzenie:** kontrola beží v serverových komponentoch a route handleroch, **nie v middleware**.
Middleware beží na hrane, kde Mongo klient nie je, a presunúť ho do Node runtime kvôli jednému dotazu by
znamenalo databázu v ceste každej požiadavky vrátane prihlasovacej stránky. Dôsledok: staršie plochy
(`/`, `/sada`, `/api/chat`) sú chránené prihlásením, ale nie tenantom. Doplniť pri Fáze 5.

**Druhé vedomé obmedzenie:** `app.contineo.app` je dnes tiež namapovaná na tenanta `SFZ`. Je to pravdivý
opis stavu — iný tenant neexistuje — nie cieľový tvar. Keď pribudne druhý zákazník, `app.contineo.app`
prestane byť SFZ.

### D30 — Čo je „podstatná zmena" 🟢

**Otázka:** ktorá novelizácia smernice vyžaduje, aby ľudia potvrdzovali znova?

**Prečo:** bez odpovede buď zaťažíme sto ľudí potvrdzovaním opravených preklepov, alebo
prehliadneme zmenu povinnosti. Oprava preklepu a nová povinnosť vyzerajú v diffe podobne —
**systém to rozhodnúť nevie a nemá.**

**✅ Rozhodnuté (2026-08-29): otázka sa nezodpovedá, ruší sa.**

Hľadala sa definícia „podstatnej zmeny" — kritérium, ktoré by niekto raz napísal a systém
by ho potom uplatňoval. Také kritérium neexistuje a existovať nemôže: rovnaká zmena je
v jednej norme preklep a v druhej nová povinnosť. Každá jeho verzia by bola buď taká
široká, že nerozhoduje o ničom, alebo taká úzka, že rozhodne zle.

Namiesto definície je **udalosť**: pridelenie (`assignments`, D37) s **povinným
`reason`**. Kto chce, aby sto ľudí niečo potvrdilo znova, to musí prideliť a napísať
prečo. Nie je to slabšia odpoveď — je to jediná, ktorá o rok niečo znamená: „lebo
kritérium C sa naplnilo" sa nedá overiť, „novela čl. 12 mení lehotu na odvolanie"
áno.

Pole `requiresReacknowledgement` na verzii zostáva v modeli pre CMS, ale onboarding
o ňom nerozhoduje. **Vedené ako O13 v ADR-003 — tam sa uzatvára rovnako.**

### D31 — Produkčný Atlas tier a zálohy 🔴

**Otázka:** stačí na produkciu cluster M0 (Free)?

**Prečo:** `ATLAS_SETUP.md` kap. 1 hovorí, že M0 **nemá zálohy**. Kým išlo o deväť verejných noriem,
bolo to jedno — korpus sa dá znovu naimportovať z originálov. Pri `acknowledgements` to jedno nie je:
**auditný záznam bez zálohy nie je auditný záznam.** Keby sa cluster stratil, neexistuje spôsob, ako
doložiť, že sto ľudí niečo potvrdilo. A na rozdiel od otvoreného allowlistu (O12), ktorý niekto musí
zneužiť, strata dát nepotrebuje útočníka.

**✅ Rozhodnuté (2026-08-27):** prechod na **M10+ pred prvým ostrým potvrdením**. Ultra-MVP sa smie
dovyvinúť na M0, ale skutočný človek nepotvrdí nič, kým nie sú zálohy. Pri prechode zapnúť
**auto-scaling úložiska aj tieru** so stropom aspoň M30 — Automated Embedding to vyžaduje na prvotné
vybudovanie indexu (`ATLAS_SETUP.md` kap. 1).

**Vedľajší dôsledok:** privátny endpoint (PrivateLink) je v Atlase len na dedikovaných clusteroch,
teda M10+. Na M0 tá možnosť technicky neexistuje — čo bolo aj dôvodom, prečo pri O12 neprichádzali
do úvahy cesty založené na privátnom endpointe.

**Súvisiace:** O12, D10 (retencia), `ATLAS_SETUP.md`, `NASADENIE_app.md`.

### D32 — Viditeľnosť obsahu v hierarchii tenantov 🔴

**Otázka:** vidí dcérska spoločnosť interný obsah materskej, keď je jej potomkom
v `companyCode.parent`?

**Prečo:** hierarchia je v návrhu od začiatku (`PRISTUPOVE_PRAVA.md` kap. 8: SFZ → regionálny →
oblastný, teda aj centrála → dcéry → prevádzky), ale **smer dedenia nikde rozhodnutý nebol**.

**✅ Rozhodnuté (2026-08-27): každý `companyCode` vidí len svoje záznamy a svoj obsah.
Cudzie nie — pokiaľ nie je explicitne zdieľané s konkrétnym `companyCode`.**

Viditeľnosť má presne tri zdroje a žiadny ďalší:

| Zdroj | Význam |
|---|---|
| zhoda `companyCode` | vlastný obsah tenanta |
| `sharedWithCompanyCodes[]` obsahuje môj kód | niekto ho **menovite** zdieľal |
| `accessLevel: public` | zverejnené pre všetkých — iná os, nie zdieľanie |

**`parent` neudeľuje prístup.** Slúži na relevanciu (ktorý rozpis je pre moju súťaž ten pravý)
a na precedenciu noriem (`PRECEDENCIA_NORIEM.md` R4), nie na oprávnenie. Príbuznosť v strome je
kontext, nie kľúč.

> **Oprava predchádzajúceho znenia (v ten istý deň).** Prvá verzia tohto rozhodnutia tvrdila, že
> `scope: global` sprístupní obsah celej skupine. To bolo **zmiešanie dvoch osí**, pred ktorým
> `DATA_MODEL_konzistencia.md` výslovne varuje: `scope` (`global`/`company`/`region`) hovorí, **na
> koho sa norma vzťahuje**; `accessLevel` + `companyCode` hovoria, **kto ju smie vidieť**. Sú
> ortogonálne. Keby sa `scope` použil ako oprávnenie, vznikla by presne tá tichá chyba, pred ktorou
> to rozhodnutie malo chrániť.

**Prečo takto:** dedenie cez strom by znamenalo, že personálna smernica centrály sa objaví
brigádnikovi v dcérskej prevádzke. Taká chyba je **tichá** — nikto sa nedozvie, že videl niečo, čo
nemal. Opačná chyba (obsah sa nezobrazí tomu, kto naň má nárok) je **hlučná** — do hodiny sa niekto
ozve. Pri prístupových právach vyberáme tú chybu, ktorá je hlučná.

**Implementačná poznámka (nemení pravidlo).** Keď bude centrála zdieľať interný dokument so
štyridsiatimi ôsmimi jednotkami, vypisovať ich po jednej je pozvánka na chybu — na novú jednotku sa
zabudne. Riešením je **skratka pri publikovaní**, ktorá sa hneď rozvinie do menovitého zoznamu
v `sharedWithCompanyCodes[]` (napr. „zdieľať s celým podstromom" → uloží konkrétne kódy). Záznam
tak zostáva explicitný a auditovateľný; skratka šetrí klikanie, nie prísnosť. Zoznam sa pri
pribudnutí novej jednotky **neaktualizuje sám** — to je vedomá cena za to, že zdieľanie je vždy
zaznamenaný úkon.

**Súvisiace:** D8, D33, `PRISTUPOVE_PRAVA.md` kap. 8, `DATA_MODEL_konzistencia.md` (ortogonalita
`accessLevel` × `scope`), `PRECEDENCIA_NORIEM.md` R4.

### D33 — Rozsah HR dashboardu naprieč hierarchiou 🟡

**Otázka:** vidí HR materskej spoločnosti potvrdenia zamestnancov dcéry? A naopak?

**Prečo:** rola HR je v `ONBOARDING_KONCEPCIA.md` kap. 6 definovaná bez ohľadu na hierarchiu.
Zoznam „kto nepotvrdil" je podklad k personálnemu opatreniu — citlivejší než samotné smernice.

**✅ Rozhodnuté (2026-08-27): HR vidí potvrdenia len svojho `companyCode`.** Nie potomkov, nie
nadradenú jednotku, nie sesterské. Rovnaké pravidlo ako pri obsahu (D32) — hierarchia neudeľuje
prístup.

- Ak má centrála vidieť potvrdenia dcéry, potrebuje **explicitné oprávnenie**, ktoré sa zaznamená.
  Nevyplýva z toho, že je centrála.
- Osoba môže patriť do viacerých jednotiek (`person_memberships` je pole), ale **záznam
  o potvrdení patrí jednej** — tej, ktorej trasa ho vyvolala (`acknowledgements.companyCode`).
  Objaví sa teda v dashboarde tejto jednotky, nie vo viacerých.

**Súvisiace:** D24, D32, `ONBOARDING_KONCEPCIA.md` kap. 6.

### D34 — Model dodávky pre malé a veľké organizácie 🟡

**Otázka:** dostane veľká firma fork platformy, alebo vlastné nasadenie tej istej platformy?

**✅ Rozhodnuté (2026-08-27):**

- **Primárne: `contineo.app` ako SaaS** — multi-tenant, malé a stredné firmy. To je hlavný produkt.
- **Veľké organizácie: vlastné nasadenie tej istej platformy** — rovnaké repo, vlastná
  infraštruktúra a databáza, správanie určené profilom tenanta (ADR-001 adaptéry, ADR-002
  `dataResidency` a `tier`). **Nie fork zdrojáku.**

**Prečo nie fork:** forknutá kópia sa začne rozchádzať. Bezpečnostnú opravu jej nevieš doručiť —
zákazník si ju musí zaniesť sám, alebo ju nemá. Po pár zákazníkoch máš N nekompatibilných Continei
a údržba rastie lineárne s počtom predajov. To nie je obchodný model, ale záväzok.

**Prečo vlastné nasadenie stačí:** zákazník dostane presne to, o čo mu ide — nič nezdieľa, všetko
je jeho — a opravy dostáva ďalej, kým ty máš stále jeden produkt. Celá architektúra je na to
postavená; veta v diagrame *„Jadro je v oboch režimoch identické — líšia sa len tri adaptéry"*
je presne toto.

**Ak by niekedy fork zdrojáku predsa prišiel** (štát, banka, podmienka v tendri), je to
**licenčné rozhodnutie**, nie technické — repo už má `LICENSE`, `LICENSES/` a `REUSE.toml`.
Vtedy treba dopredu pomenovať, či a ako podporujeme rozsypané verzie.

**Súvisiace:** ADR-001, ADR-002 (dodatok 10 — `tier`), `WEB_UNIVERZALNY_POZICIONING_PLAN.md`.

### D35 — Viacjazyčnosť: prostredie áno, obsah nie 🔴

**Otázka:** čo presne znamená „multijazyčná verzia" (SK · CS · EN)?

**✅ Rozhodnuté (2026-08-27): viacjazyčné je len prostredie, nie obsah.**

| Vrstva | Viacjazyčná? | Riadi |
|---|---|---|
| **Prostredie** — rozhranie, e-maily, znenie potvrdzovacej formulky | **áno**, SK · CS · EN | `persons.language`, zoznam v `app/src/lib/i18n.ts` |
| **Obsah** — samotné smernice a normy | **nie**, neprekladáme | `documents.language` z číselníka `language` |

**Dokument má určený základný jazyk, v ktorom je napísaný.** Dokument v inom
jazyku je **samostatný dokument** (vlastné `documentId`), nie preklad. Neriešime
teda, ktoré jazykové znenie je záväzné — každý dokument je sám sebou.

**Dôsledok pre záznam o potvrdení (D24):** formulka sa skladá v jazyku **človeka**,
kým dokument si nesie svoj vlastný. Záznam preto ukladá **oboje** — `language`
(v čom človek formulku videl a potvrdil) aj `documentLanguage` (v čom je smernica).
Bez toho sa pri audite nedá odpovedať na otázku, či český rozhodca potvrdzoval
slovenský text — a to je otázka, ktorá príde.

**Jazyk v `app/` sa berie z profilu osoby, bez prefixu v URL.** Na rozdiel od
marketingového webu, ktorý má `[lang]` routing. Dôvod je bezpečnostný: interný
portál je celý za prihlásením a `middleware.ts` je definovaný ako „všetko okrem",
aby bola nová stránka chránená automaticky. Pridať do matchera jazykový segment
znamená hrabať sa v jedinom mieste, ktoré stojí medzi internými smernicami
a internetom. Za pohodlie zdieľateľného odkazu to nestojí.

**Pre SFZ je prvá vlna len po slovensky.** Schéma a kód s jazykom rátajú od
začiatku; prekladá sa až rozhranie, keď bude.

> **Zostáva rozhodnúť (HR + právnik):** má formulka pomenovať jazyk dokumentu,
> keď sa líši od jazyka prostredia? Napr. *„…s dokumentom „X" (v slovenčine),
> verzia…"*. Dnes to formulka nerobí — človek v českom rozhraní potvrdzuje
> slovenský text a v zázname je to dohľadateľné, ale v samotnom znení nie.
> Nie je to technická otázka; systém uloží akékoľvek znenie.

**Súvisiace:** D24, D28, `app/src/lib/i18n.ts`, `docs/CMS_KONCEPCIA.md` B.4
(i18n web obsahu — tam ide o kurátorské články, nie o normy).

---

## Okruh 7 — Prihlásenie kontom a správa osôb

> **Koncepcia:** `docs/PRIHLASENIE_A_SPRAVA_OSOB.md` — tam je celé odôvodnenie,
> dátový model aj fázovanie. Tu je len rozhodovacia časť.

| # | Otázka | Stav |
|---|---|---|
| **D43** | Vlastná Entra/Google aplikácia zákazníka, nie jedna naša | ✅ 2026-08-29 |
| **D44** | Poskytovatelia sa skladajú podľa hostiteľa, nie pri štarte | ✅ 2026-08-29 |
| **D45** | Konto overuje adresu, vstup povoľuje `persons` | ✅ 2026-08-29 |
| **D46** | Správa osôb má vlastnú rolu `people-admin`, oddelenú od `hr` | ✅ 2026-08-29 |

**D43** rozhoduje druhý a tretí riadok porovnania: zväz, ktorý dá do systému
vlastné predpisy, má vedieť **sám odvolať prístup** a **sám vidieť, kto sa
prihlasoval** — a nemá sa o to prosiť dodávateľa. Cena (šifrovanie tajomstiev
a obrazovka na ich zadanie) je jednorazová, tá výhoda trvá.

**D45** je to, na čom celé prihlásenie kontom stojí: konto hovorí „toto je
naozaj tá adresa", nie „ten človek sem patrí". Bez tohto rozlíšenia by prvá
zle nastavená Entra aplikácia otvorila interné smernice komukoľvek s pracovným
kontom na svete.

**D46** oddeľuje prístup od obsahu. `hr` prideľuje normy a vidí, kto ich
nepotvrdil; `people-admin` zakladá a vyraďuje ľudí. Spojiť ich znamená, že IT
správca zároveň uvidí, kto si neprečítal disciplinárny poriadok.

---

## Okruh 6 — Udalosti a upozornenia (Fáza 9)

> **Koncepcia:** `docs/UDALOSTI_A_UPOZORNENIA_KONCEPCIA.md` — tam je celé
> odôvodnenie, dátový model aj fázovanie. Tu je len rozhodovacia časť.

Zadanie (2026-08-28): na úvodnej strane widget „Nevybavené žiadosti" a interný
systém upozornení. Pri rozbore vyšlo najavo, že to nie je len zobrazovacia
úloha — dnes je **rozposlanie úlohy tiché**: keď pribudne nová verzia normy,
`trackProgress()` ju začne rátať ako nepotvrdenú všetkým, koho sa trasa týka,
bez toho, aby to niekto rozhodol a bez stopy, kedy sa to stalo.

### D36 — Widget ukazuje „čo čaká na mňa" 🟡

**✅ Rozhodnuté (2026-08-28): osobná schránka, nie prehľad organizácie.**

Bežný člen zväzu nemá vidieť, kto zo sto ľudí ešte nepotvrdil — to je iná
obrazovka s inými právami (rozsah B, rola `hr`). Zdroje položiek sú rôzne
(nepotvrdené normy, kurácia, helpdesk), tvar je jeden — `PendingItem` —
a widget sa pýta registra zdrojov, nie jednotlivých modulov.

**Súvisiace:** D32 (viditeľnosť per `companyCode`), D33 (rozsah HR dashboardu).

### D37 — Úloha sa odvodzuje, pridelenie sa zaznamenáva 🟢

**✅ Rozhodnuté a postavené (2026-08-29):** `lib/assignments.ts`, kolekcia `assignments`.
Záznam sa nemení a nemaže — odvolanie je `revokedAt`, nie `deleteOne`, inak by
z histórie zmizlo, že niekto niekomu niečo uložil. Widget odvtedy vie povedať
„čaká od" a „nové" (D39), lebo má odkiaľ.

**Otázka:** ak progres nikdy neukladáme (D27), kde sa vezme informácia, že sa
norma má potvrdiť **znova**?

**Návrh:** dve pravdy s rôznym pôvodom.

| Vec | Odkiaľ | Prečo |
|---|---|---|
| Čo mám urobiť | odvodí sa (trasa × platná verzia − potvrdenia) | druhá kópia sa rozíde práve pri novej verzii (D27) |
| Že sa to má urobiť znova | **záznam** `assignments` | ľudské rozhodnutie, nie výpočet — systém nevie odlíšiť opravu preklepu od novej povinnosti (D30) |
| Kedy a komu bolo pridelené | **záznam** | bez neho sa po roku nedá povedať, či človek úlohu dostal |

Rovnaký vzor ako `acknowledgements`: záznam, nie príznak. **Rozsah B tým
uzatvára D30** — „podstatná zmena" prestane byť definíciou a stane sa dôvodom,
ktorý pri prideľovaní vyplní človek (`reason`).

**Súvisiace:** D24, D25, D27, D30/O13.

### D38 — `persons.groups` ako tretia dimenzia 🟢

**✅ Rozhodnuté a postavené (2026-08-29):** `persons.groups: string[]`, vždy malými
písmenami. Zoznam skupín sa **neudržiava v číselníku, odvodzuje sa z ľudí** — číselník
by bol druhá pravda a prideliť niečo prázdnej skupine je tichý spôsob, ako neprideliť
nikomu.

Dnes existuje `persons.tracks` (čo mám prejsť) a `persons.department` (kam
patrím v štruktúre). Ani jedno nie je skupina na prideľovanie: trasa je obsah,
útvar je štruktúra. Zlúčiť skupiny s trasami by znamenalo, že jednorazovú
úlohu nemožno prideliť bez toho, aby vznikla umelá trasa.

**Súvisiace:** D26, `PRISTUPOVE_PRAVA.md` (ortogonalita atribútov).

### D39 — „Nové" sa počíta voči `lastLoginAt` 🟢

**✅ Rozhodnuté (2026-08-28): upozornenia sa odvodzujú, vlastná kolekcia sa nerobí.**
Úloha je „nová", keď je jej pridelenie novšie než `persons.lastLoginAt`.

Cena, aby bola vidno dopredu: **nedá sa označiť ako prečítané** (príznak zmizne
pri ďalšom prihlásení, nie kliknutím) a kto sa prihlási dvakrát rýchlo za sebou,
o príznak príde. Za to sa nezakladá kolekcia s osobnými údajmi o správaní, ktorú
by bolo treba odôvodniť a mazať (O15, O16).

### D40 — Jednorazové systémové hlásenia 🔴

**Otázka:** zadanie žiada aj „interné hlásenia systému". Časť z nich sa
odvodiť **nedá** — „Import zlyhal 3. 9. o 4:00" je udalosť, ktorá nezanechala
stav, z ktorého by sa dalo dopočítať.

| Možnosť | Čo znamená | Cena |
|---|---|---|
| **(a)** | rozsah A ich nemá vôbec, widget ukazuje len úlohy | čisté, ale „systém notifikácií" to ešte nie je |
| **(b)** | pribudne malá kolekcia `notifications` so stavom prečítané a retenciou | úplné, ale zatiaľ do nej nemá čo písať |

**✅ Rozhodnuté (2026-08-28): (a).** Rozsah A jednorazové hlásenia nemá,
widget ukazuje výhradne úlohy. Kolekcia `notifications` vznikne až vtedy, keď
bude existovať prvý skutočný odosielateľ takých správ (kurácia alebo helpdesk)
— inak by vznikla kolekcia bez odosielateľa a s ňou aj povinnosť odôvodniť ju
v O15/O16.

**Dôsledok pre pomenovanie v rozhraní:** to, čo v rozsahu A vzniká, je zoznam
úloh, nie „systém notifikácií". Widget sa preto volá **„Nevybavené žiadosti"**
podľa zadania a nie „Upozornenia" — inak by človek čakal aj hlásenia, ktoré
tam nebudú.

**Súvisiace:** D25 (kurácia), Fáza 4b (helpdesk), O15, O16.

---

---

## Okruh 7 — Správa tenantov (Fáza 5b)

> **Koncepcia:** `docs/SPRAVA_TENANTOV.md`. Tu je len rozhodovacia časť.

### D41 — `platform-admin` vidí naprieč tenantmi 🔴

**Otázka:** D32 hovorí, že viditeľnosť je per `companyCode` a hierarchia
neudeľuje nič. Správca platformy ale musí vidieť všetkých.

**✅ Rozhodnuté (2026-08-28): rola `platform-admin` v `persons`, nie premenná.**

Záznam pod tenantom `LTK` s `roles: ["platform-admin"]`. Ide overenou cestou
prihlásenia cez `persons` (I1c) vrátane evidencie a odhlásenia; odobratie práv
je zmena jedného záznamu, nie premennej a nasadenia.

**Je to výslovná výnimka z D32, nie jej ohnutie.** Rola neruší `companyCode`
ostatných — otvára samostatnú obrazovku, ktorá číta **prehľadové údaje**.
Neotvára obsah: na dokumenty a potvrdenia cudzej organizácie správca platformy
nevidí a vidieť nemá. Toto oddelenie musí prežiť aj pri dvadsiatich
zákazníkoch. Keby raz bolo treba nahliadnuť do obsahu (podpora), je to
samostatné rozhodnutie so záznamom o každom nahliadnutí, nie vlastnosť roly.

Zvažovaná bola premenná so zoznamom správcov (ako `POVOLENE_EMAILY`).
**Zamietnuté:** presne taká premenná dnes skrývala, že sa cesta cez `persons`
nikdy netestovala (I1c).

**Súvisiace:** D32, D26, I1c.

### D42 — Správa beží len na doméne dodávateľa 🔴

**✅ Rozhodnuté (2026-08-28):** `/admin` odpovie len vtedy, keď hostiteľ patrí
tenantovi `LTK` (`app.contineo.app`). Na doméne zákazníka **neexistuje** —
`notFound()`, nie „nemáte prístup".

Dôvod je ten istý ako pri značke: na doméne zväzu nemá byť nič, čo patrí
dodávateľovi. A druhý, praktickejší: keby obrazovka odpovedala všade, stačila
by jediná chyba v kontrole roly na to, aby ju uvidel niekto zo zákazníka.
Takto musia zlyhať **dve nezávislé podmienky naraz** — a preto sa kontroluje
oboje, rola aj hostiteľ.

**Súvisiace:** D29, D41.

---

## Otvorené body vedené v ADR-003

Nie sú to rozhodnutia backlogu, ale otvorené otázky konkrétneho ADR. Uvedené tu kvôli
prehľadu:

| # | Otázka | Poznámka |
|---|---|---|
| ~~**O12**~~ | ~~`0.0.0.0/0` v Atlase~~ | ✅ **Uzavreté 2026-08-27: Vercel Static IPs** (100 $/mes. na projekt, plán Pro), zapnúť pred prvým ostrým potvrdením. Preverené aj Render, Railway, vlastný stroj v EÚ a SOCKS5 proxy — analýza a dôvody v **ADR-003 kap. 6.1**. Presun aplikácie z Vercelu zostáva dlhodobým smerom (ADR-002, dodatky 10 a 11). |
| **O14** | Meriame čas nad dokumentom alebo doskrolovanie na koniec? | Zvyšuje dôkaznú hodnotu, ale je to sledovanie správania zamestnanca. Rozhodnúť **pred** implementáciou. |
| **O15** | Právny základ spracúvania `acknowledgements` | Návrh: oprávnený záujem / plnenie zmluvy, **nie súhlas** (odvolateľný dôkaz o oboznámení je protirečenie). Rozširuje D10. |
| **O16** | Retencia auditného záznamu po skončení pracovného pomeru | Iná lehota než pri konverzáciách (D10). |
