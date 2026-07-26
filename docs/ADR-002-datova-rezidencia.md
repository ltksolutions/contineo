# ADR-002 — Dátová rezidencia ako vlastnosť tenanta

> **Stav:** ✅ prijaté · **Dátum:** 2026-07-26 · **Revízia:** 2026-07-26 (**O5 a O6 uzavreté** z verejných dokumentov, sekcia 8)
> **Nadväzuje na:** `docs/ADR-001-provider-adaptery.md` (tri adaptéry)
> **Súvisiace:** `docs/ATLAS_SETUP.md`, `docs/PRISTUPOVE_PRAVA.md`, `docs/D9_EVAL_zlata_sada.md`
> **Implementácia:** `app/src/lib/residency.ts`, validácia v `app/src/lib/tenantProfile.ts`, Bedrock adaptér v `app/src/lib/providers/generation/bedrock.ts` — 54 testov

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

Adaptér, o ktorom **nevieme**, kde počíta, sa v prísnom režime nepovolí. Nevedomosť nie je súhlas.

Je to nepohodlné zámerne — a hneď sa to vyplatilo. `atlas-auto` a `anthropic` sme pôvodne označili ako neznáme (O5, O6). Práve to nás donútilo lokalitu dohľadať, a ukázalo sa, že **obe sú mimo EÚ**. Pri opačnej predvoľbe by sme sa nespýtali a mali by sme v profile tichý únik.

---

## 4. Lokalita jednotlivých adaptérov

| Adaptér | `kind` | Lokalita | Dôkaz |
|---|---|---|---|
| Embedding | `atlas-auto` | **mimo EÚ (USA)** | zoznam subprocesorov MongoDB: *Google LLC — model hosting pre embedding a reranking — United States* |
| Embedding | `tei`, `infinity` | vlastná | beží u nás |
| Rerank | `atlas-stage` | **mimo EÚ (USA)** | Atlas Project Settings: GCP, US region; potvrdené aj zoznamom subprocesorov |
| Rerank | `tei`, `infinity`, `none` | vlastná | beží u nás |
| Generovanie | `anthropic` | **mimo EÚ (USA)** | priame Anthropic API spracúva v americkej infraštruktúre |
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

Po uzavretí O5 a O6 je obraz jasnejší — a čiastočne lepší, než sme čakali.

**Generovanie je vyriešené.** Claude cez AWS Bedrock vo Frankfurte beží v EÚ a adaptér je hotový (O10). Zostáva ho overiť proti skutočnému Bedrocku (**O11**).

**Embedding a rerank riešenie zatiaľ nemajú.** Atlas ich počíta v USA, takže v `eu-full` sa nedajú použiť. Zostávajú dve cesty:

1. **vlastná služba** (TEI / Infinity) — potrebuje stroj s GPU
2. **európsky poskytovateľ** volaný cez rovnaké HTTP rozhranie, aké už máme napísané a otestované (**O7**)

Druhá cesta je lacnejšia a rýchlejšia. Ak niektorý európsky poskytovateľ doloží spracovanie v EÚ, dostane lokalitu `eu` a `eu-full` bude dosiahnuteľné bez čakania na hardvér.

---

## 8. Otvorené otázky

### Uzavreté 2026-07-26 — z verejných dokumentov

**O5 — kde beží inferencia pre Atlas Automated Embedding?** ✅ **USA.**

[Zoznam subprocesorov MongoDB](https://www.mongodb.com/products/platform/trust/subprocessors), sekcia *AI Features & Products*, uvádza doslovne:

> **Google LLC** — *Model hosting services for the optional embedding and reranking model services included in the Cloud Services* — **United States**

Automated Embedding aj `$rerank` teda spracúvajú v USA. Nie je to teda „neznáma", ale doložene mimo EÚ. Týka sa to **každého dotazu**, nielen importu — text otázky sa musí zaembedovať.

**O10 — adaptér pre Bedrock?** ✅ **Postavený** (`app/src/lib/providers/generation/bedrock.ts`).

Profil s `kind: "bedrock"` a EU regiónom dostane lokalitu `eu`, takže **prejde režimom `eu-full`**. Región mimo EÚ dostane `mimo-eu` — cesta cez AWS sama o sebe nič nerieši.

Telo požiadavky zdieľa s priamym adaptérom (`messagesBody`), takže Citations aj prompt caching by mali fungovať rovnako. Líši sa autentifikácia (SigV4) a prenos streamu (binárne rámce namiesto SSE).

> ⚠️ **Integračne neoverené.** Bez AWS účtu adaptér nikdy nebežal proti skutočnému Bedrocku. SigV4 je overený proti oficiálnym testovacím vektorom AWS a parser rámcov proti syntetickým dátam (29 testov), ale to nenahrádza skutočné volanie. Otvorené zostáva najmä **O11**.

**O6 — vie Anthropic doložiť spracovanie v EÚ?** ✅ **Áno, ale nie cez priame API.**

Priame Anthropic API spracúva v americkej infraštruktúre. Cesta do EÚ existuje cez **AWS Bedrock** (`eu-central-1` Frankfurt, `eu-west-1` Írsko, `eu-west-3` Paríž, `eu-north-1` Štokholm) alebo **Google Vertex AI** v EU regiónoch.

To je pre nás dôležitejšie, než sa zdá: **generovanie sa dá dostať do `eu-full` bez vlastného GPU.** Chýba k tomu adaptér, ktorý ADR-001 odložilo ako okrajový (*„pre Bedrock/Vertex pridaj samostatný adaptér"*). Ukazuje sa, že okrajový nie je — viď **O10**.

### Otvorené

| # | Otázka | Prečo na nej záleží |
|---|---|---|
| **O7** | Ktorý európsky poskytovateľ vie embedding a rerank so spracovaním v EÚ? | Jediné, čo ešte chýba k `eu-full` bez vlastného hardvéru. Generovanie už riešenie má (O6). |
| **O8** | Platí `mimo-eu` aj pre `$rankFusion` a `$vectorSearch`? | Predpokladáme, že nie — počíta ich `mongot` v clusteri. Zoznam subprocesorov spomína len *model hosting*, čo tomu zodpovedá, ale nie je to výslovné potvrdenie. |
| **O9** | Ako sa rezidencia prejaví v UI a v zmluvnej dokumentácii? | Zákazník musí vidieť, kam jeho text ide, bez čítania kódu. |
| **O11** | Fungujú Citations cez Bedrock rovnako ako cez priame API? | Ak nie, `eu-full` generovanie stráca hlavnú výhodu Claude a metrika D9 „presnosť citácie ≥ 85 %" sa naň nedá vzťahovať. Overiť pri prvom AWS účte. |


## 9. Čo sa zmenilo v kóde

| Súbor | Zmena |
|---|---|
| `src/lib/residency.ts` | **nový** — tabuľky lokalít, `skontrolujRezidenciu()`, `prehladLokalit()` |
| `src/lib/providers/types.ts` | `DataResidency` rozšírený na päť hodnôt |
| `src/lib/tenantProfile.ts` | dve podmienky na air-gap nahradené všeobecnou kontrolou |
| `tests/residency.test.ts` | **nový** — 25 testov vrátane odvodenia lokality z URL |
