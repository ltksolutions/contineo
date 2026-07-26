# ADR-002 — Dátová rezidencia ako vlastnosť tenanta

> **Stav:** ✅ prijaté · **Dátum:** 2026-07-26
> **Nadväzuje na:** `docs/ADR-001-provider-adaptery.md` (tri adaptéry)
> **Súvisiace:** `docs/ATLAS_SETUP.md`, `docs/PRISTUPOVE_PRAVA.md`, `docs/D9_EVAL_zlata_sada.md`
> **Implementácia:** `app/src/lib/residency.ts`, validácia v `app/src/lib/tenantProfile.ts`, 25 testov

> ⚠️ Tento dokument nie je právne posúdenie. Je to technický podklad, aby sa dali položiť správne otázky. Pri zákazníkovi z verejnej správy si závery daj potvrdiť odborníkom na ochranu osobných údajov.

---

## 1. Čo problém odhalilo

Pri zapínaní `$rerank` v Atlase sme narazili na vetu v projektovom nastavení:

> *Native Reranking uses reranking models, which incur usage-based costs. The model inference platform runs on MongoDB's infrastructure in **GCP cloud in a US region**.*

Cluster je vo Frankfurte. Dáta v pokoji teda v EÚ ležia — ale **pri každom dotaze sa text kandidátskych úryvkov aj samotná otázka používateľa posiela na spracovanie do USA**.

To nie je chyba MongoDB; je to jasne napísané. Chyba bola na našej strane: profil tenanta mal pole `dataResidency: "eu"`, ktoré **nič nevynucovalo**. Bol to popisný štítok. Kombinácia „rezidencia EÚ + `$rerank`" prešla validáciou bez slova.

### Prečo to nie je okrajová vec

Prvý reálny korpus (9 noriem SFZ) je verejný — je publikovaný na futbalsfz.sk. Ďalší krok sú ale **interné smernice**, ktoré takmer isto obsahujú mená: disciplinárne konania, rozhodnutia komôr, personálne rozhodnutia. Pri takom obsahu je odosielanie mimo EÚ vec, ktorú treba vedieť obhájiť — nie objaviť.

A dlhodobý cieľ Continea je on-prem pre verejnú správu a väčšie firmy. Tam je „nič neopustí perimeter" vstupná podmienka, nie prívlastok.

---

## 2. Tri úrovne, ktoré sa bežne miešajú

| Úroveň | Čo znamená | Kto to vyžaduje |
|---|---|---|
| **1. Dáta v pokoji v EÚ** | Cluster, indexy a zálohy sú v EÚ. Volanie modelov von je prijateľné pri DPA a SCC. | bežné komerčné firmy |
| **2. Nič neopustí EÚ** | Aj modely bežia v EÚ. Vrátane dotazov používateľov. | verejná správa, veľké firmy, tendre |
| **3. Nič neopustí perimeter** | Všetko na infraštruktúre zákazníka. | utajované skutočnosti, air-gap |

**Podstatný je rozdiel medzi 1 a 2.** Úroveň 1 je právne v poriadku — GDPR prenos mimo EÚ nezakazuje, len ho podmieňuje. Ale v súťažných podmienkach býva napísané „údaje nesmú opustiť EÚ", čo je organizačná požiadavka, ktorá sa papierom vyriešiť nedá. Kto vie ponúknuť len úroveň 1, býva vyradený formálne, nie vecne.

---

## 3. Rozhodnutie

Rezidencia prestáva byť štítok a stáva sa **pravidlom, z ktorého sa odvodzuje, ktoré adaptéry sú pre tenanta prípustné**.

```ts
type DataResidency = "global" | "eu-data" | "eu-full" | "on-prem" | "air-gap"
```

| Hodnota | Úroveň | Popis |
|---|---|---|
| `global` | — | bez obmedzenia |
| `eu-data` | 1 | dáta v pokoji v EÚ, spracovanie môže byť mimo |
| `eu-full` | 2 | žiadny text neopustí EÚ |
| `on-prem` | 3 | všetko na infraštruktúre zákazníka |
| `air-gap` | 3 | ako on-prem a bez konektivity von |

Pôvodná hodnota `"eu"` zaniká — bola nejednoznačná práve v tom mieste, kde na jednoznačnosti záleží.

### Mechanizmus

Namiesto série podmienok stojí kontrola na jednej myšlienke: **každý adaptér má známu lokalitu spracovania**, a rezidencia hovorí, ktoré lokality pripúšťa.

```
Lokalita: vlastna | eu | mimo-eu | neznama
```

| Rezidencia | Povolené lokality |
|---|---|
| `global`, `eu-data` | všetky |
| `eu-full` | `vlastna`, `eu` |
| `on-prem`, `air-gap` | `vlastna` |

Pribudnutie nového adaptéra znamená doplniť jeden riadok do tabuľky, nie hľadať všetky miesta, kde sa rozhoduje.

### Kľúčové pravidlo: neznáme sa správa ako zakázané

Adaptér, o ktorom **nevieme**, kde počíta, sa v prísnom režime nepovolí. Nevedomosť nie je súhlas. Prakticky to znamená, že `atlas-auto` a `anthropic` sú dnes v `eu-full` zakázané — nie preto, že by sme vedeli, že sú mimo EÚ, ale preto, že to nemáme potvrdené (O5, O6 nižšie).

Je to nepohodlné zámerne. Keby bola predvoľba opačná, otázky by sme si nikdy nepoložili.

---

## 4. Lokalita jednotlivých adaptérov

| Adaptér | `kind` | Lokalita | Dôkaz |
|---|---|---|---|
| Embedding | `atlas-auto` | **neznáma** | MongoDB lokalitu inferencie neuvádza → **O5** |
| Embedding | `tei`, `infinity` | vlastná | beží u nás |
| Rerank | `atlas-stage` | **mimo EÚ** | text v Atlas Project Settings: GCP, US region |
| Rerank | `tei`, `infinity`, `none` | vlastná | beží u nás |
| Generovanie | `anthropic` | **neznáma** | regionálne spracovanie neoverené → **O6** |
| Generovanie | `openai` | podľa `url` | interná adresa = vlastná; verejná doména = neznáma |

Pri `openai` sa lokalita odvodzuje z hostiteľa v URL. Interná adresa (`localhost`, privátne rozsahy, meno služby bez domény) sa berie ako vlastná infraštruktúra; čokoľvek verejné je neznáme. Bez toho by stačilo nasmerovať `url` na cudzí cloud a kontrola by mlčala.

---

## 5. Čo to znamená pre profily

### SFZ dnes — verejné normy

```js
{ companyCode: "SFZ", dataResidency: "eu-data",
  providers: { embedding: { kind: "atlas-auto" },
               rerank:    { kind: "atlas-stage" },
               generation:{ kind: "anthropic" } } }
```

Prejde. Korpus je verejne publikovaný, takže sa von neposiela nič, čo tam už nie je.

### SFZ po pridaní interných smerníc

Rovnaký profil s `dataResidency: "eu-full"` sa **odmietne načítať** so zoznamom troch porušení. To je zámer: prechod na interný obsah si vyžiada vedomé rozhodnutie o tom, čím sa cloudové adaptéry nahradia.

### Verejná správa

```js
{ dataResidency: "on-prem",
  providers: { embedding: { kind: "tei", url: "http://tei:8080" },
               rerank:    { kind: "infinity", url: "http://infinity:7997" },
               generation:{ kind: "openai", url: "http://vllm:8000/v1" } } }
```

---

## 6. Dôsledok pre ADR-001

ADR-001 zaviedlo aplikačný rerank ako ústupok pre air-gapped nasadenie. **To bolo podcenenie.** Aplikačný rerank bude potrebovať **každý tenant na úrovni 2** — teda pravdepodobne väčšina cieľových zákazníkov, nielen tí s uzavretým perimetrom.

Rovnako sa mení pohľad na `voyage-4-nano`: nebol to len zaujímavý nález pre air-gap, ale **jediná dnes overená cesta k embeddingu bez odosielania textu von**, ktorá zároveň zachováva vektorový priestor (O1, zmerané a uzavreté).

Architektúra troch adaptérov sa nemení — potvrdzuje sa. Mení sa len odhad, ako často sa bude používať tá „on-prem" vetva.

---

## 7. Čo chýba

**Úroveň 2 sa dnes nedá poskladať bez vlastného hardvéru.** Jediné adaptéry s lokalitou `vlastna` sú TEI, Infinity a vLLM — a tie potrebujú stroj s GPU, ktorý zatiaľ nemáme.

Existuje ale tretia možnosť, ktorú sme doteraz nezvažovali: **európski poskytovatelia embeddingu a rerankingu**, volaní cez rovnaké HTTP rozhranie, aké už máme napísané. Ak niektorý z nich doloží spracovanie v EÚ, dostal by lokalitu `eu` a úroveň 2 by bola dosiahnuteľná bez čakania na hardvér. Viď **O7**.

---

## 8. Otvorené otázky

| # | Otázka | Prečo na nej záleží |
|---|---|---|
| **O5** | Kde beží inferencia pre Atlas Automated Embedding? | Rozhoduje, či `atlas-auto` môže byť `eu` alebo ostane `neznama`. Týka sa každého dotazu, nielen importu. |
| **O6** | Vie Anthropic doložiť spracovanie v EÚ, prípadne zero-retention? | Bez toho nie je Claude použiteľný na úrovni 2 ani pri verejnom korpuse. |
| **O7** | Ktorý európsky poskytovateľ vie embedding a rerank so spracovaním v EÚ? | Odomklo by úroveň 2 bez vlastného hardvéru. |
| **O8** | Platí `mimo-eu` aj pre `$rankFusion` a `$vectorSearch`? | Predpokladáme, že nie — tie počíta `mongot` v clusteri. Treba potvrdiť, lebo na tom stojí tvrdenie o prenositeľnosti jadra. |
| **O9** | Ako sa rezidencia prejaví v UI a v zmluvnej dokumentácii? | Zákazník musí vidieť, kam jeho text ide, bez čítania kódu. |

Kým O5 a O6 nie sú zodpovedané, `atlas-auto` a `anthropic` ostávajú `neznama`. To je bezpečná predvoľba, nie tvrdenie o týchto službách.

---

## 9. Čo sa zmenilo v kóde

| Súbor | Zmena |
|---|---|
| `src/lib/residency.ts` | **nový** — tabuľky lokalít, `skontrolujRezidenciu()`, `prehladLokalit()` |
| `src/lib/providers/types.ts` | `DataResidency` rozšírený na päť hodnôt |
| `src/lib/tenantProfile.ts` | dve podmienky na air-gap nahradené všeobecnou kontrolou |
| `tests/residency.test.ts` | **nový** — 25 testov vrátane odvodenia lokality z URL |
