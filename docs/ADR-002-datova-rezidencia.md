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
| **O7** | Ktorý európsky poskytovateľ vie embedding a rerank so spracovaním v EÚ? | Jediné, čo ešte chýba k `eu-full` bez vlastného hardvéru. Generovanie už riešenie má (O6). **Priorita — viď dodatok 13.** Bedrock to formálne rieši (dodatok 12), ale nerieši izoláciu, takže cieľom je vlastná služba. |
| **O8** | Platí `mimo-eu` aj pre `$rankFusion` a `$vectorSearch`? | Predpokladáme, že nie — počíta ich `mongot` v clusteri. Zoznam subprocesorov spomína len *model hosting*, čo tomu zodpovedá, ale nie je to výslovné potvrdenie. |
| **O9** | Ako sa rezidencia prejaví v UI a v zmluvnej dokumentácii? | Zákazník musí vidieť, kam jeho text ide, bez čítania kódu. |
| **O11** | Fungujú Citations cez Bedrock rovnako ako cez priame API? | Ak nie, `eu-full` generovanie stráca hlavnú výhodu Claude a metrika D9 „presnosť citácie ≥ 85 %" sa naň nedá vzťahovať. Overiť pri prvom AWS účte — je to práca na hodinu a **Bedrock je jediná cesta ku Claude Citations mimo USA** (dodatok 13). |


## 9. Čo sa zmenilo v kóde

| Súbor | Zmena |
|---|---|
| `src/lib/residency.ts` | **nový** — tabuľky lokalít, `skontrolujRezidenciu()`, `prehladLokalit()` |
| `src/lib/providers/types.ts` | `DataResidency` rozšírený na päť hodnôt |
| `src/lib/tenantProfile.ts` | dve podmienky na air-gap nahradené všeobecnou kontrolou |
| `tests/residency.test.ts` | **nový** — 25 testov vrátane odvodenia lokality z URL |

---

## 10. Dodatok (2026-07-27) — druhá os: izolácia infraštruktúry

### Čo sa našlo

Pole `tier` (`T1` | `T2` | `T3`) existovalo od ADR-001, ale malo v celej aplikácii **tri výskyty**: definíciu typu, predvolenú hodnotu v profile a jeden testovací fixture. **Nikto ho nečítal.** Ani `residency.ts`, ani `validateProfile()`, ani ADR-002 — v pôvodnom texte tohto dokumentu sa slovo „tier" nevyskytovalo ani raz.

Typ nemal ani komentár, takže z kódu sa nedalo zistiť, čo mal znamenať. Jediné vysvetlenie bolo v komentári ukážky na marketingovom webe: `// T1 shared | T2 enclave | T3 air-gap`.

Príčina je pochopiteľná: ADR-002 zaviedlo presnejší mechanizmus pre otázku „kam text tečie" a starší, hrubší pojem prekrylo. Nikto ho nezrušil, ale ani nepremostil — ostal visieť ako deklarácia bez účinku.

### Prečo ho nezrušiť

Lebo `tier` a `dataResidency` **neodpovedajú na tú istú otázku**:

| Os | Otázka | Hodnoty |
|---|---|---|
| `dataResidency` | **Kde** text prebieha spracovaním? | `global` … `air-gap` |
| `tier` | **S kým** zdieľame výpočet? | `T1` … `T3` |

Sú nezávislé. Zdieľaná služba v EÚ je legitímna kombinácia (`T1` + `eu-full`) rovnako ako vyhradená inštancia kdekoľvek (`T2` + `global`). Zákazník, ktorý si platí vyhradené prostredie, sa nepýta len na krajinu — pýta sa, či jeho dotazy prechádzajú tým istým procesom ako dotazy niekoho iného. Na to `dataResidency` odpoveď nedá.

### Rozhodnutie

**`tier` sa oživuje ako samostatná os izolácie infraštruktúry** a vyhodnocuje sa rovnakým tabuľkovým mechanizmom ako rezidencia.

Každý adaptér dostal druhú vlastnosť — **izoláciu**:

| Hodnota | Význam |
|---|---|
| `dedikovana` | inštancia beží len pre tohto tenanta |
| `zdielana` | cudzia multi-tenant služba; náš text ide cez tie isté procesy ako text iných zákazníkov dodávateľa |
| `neznama` | nevieme — rovnako ako pri lokalite sa berie ako to horšie |

| Adaptér | Izolácia | Prečo |
|---|---|---|
| `atlas-auto` | zdieľaná | Automated Embedding je služba MongoDB, nie náš proces |
| `atlas-stage` | zdieľaná | `$rerank` počíta na inferenčnej platforme MongoDB spoločnej pre všetkých |
| `anthropic` | zdieľaná | verejné API |
| `bedrock` | zdieľaná | **vyhradený účet nie je vyhradený hardvér** — model beží na infraštruktúre AWS spoločnej pre zákazníkov |
| `tei`, `infinity` | dedikovaná | vlastná inštancia |
| `openai` | podľa URL | interná adresa → dedikovaná; čokoľvek verejné → neznáma |

Pravidlo:

```
T1 → dedikovana | zdielana | neznama     (bez obmedzenia)
T2 → dedikovana
T3 → dedikovana  +  dataResidency musí byť "air-gap"
```

### Prekryv s air-gapom

`air-gap` bol v oboch osiach naraz — a to je presne stopa po tom, ako sa rozišli. Riešime to **pravidlom konzistencie, nie zlúčením**: `T3` vyžaduje `dataResidency: "air-gap"`, inak profil neprejde validáciou. Bez toho by sa dal nastaviť `T3` s konektivitou von — profil, ktorý vyzerá prísne a nie je.

### Dôsledok pre predaj

Toto je vec, ktorú sa štátny aj bankový zákazník spýta skôr než na krajinu: *„beží to len pre nás?"* Doteraz sme na ňu nemali odpoveď v produkte, len v prezentácii. Zároveň to zostruje obraz z kapitoly 7 — na `T2` neprejde ani Bedrock, takže **vyhradené prostredie potrebuje vlastný GPU rovnako ako `eu-full`**. Obe cesty vedú k tomu istému chýbajúcemu dielu (O7).

### Čo sa zmenilo v kóde

| Súbor | Zmena |
|---|---|
| `src/lib/residency.ts` | `Izolacia`, tabuľky izolácie, `skontrolujIzolaciu()`, `prehladIzolacie()`; spoločná pomôcka `jeVlastnaAdresa()` pre obe osi |
| `src/lib/providers/types.ts` | `Tier` konečne zdokumentovaný |
| `src/lib/tenantProfile.ts` | `validateProfile()` kontroluje aj izoláciu |
| `tests/residency.test.ts` | 22 nových testov (21 → 43) vrátane nezávislosti oboch osí |


---

## 11. Dodatok (2026-07-27) — testovacie prostredie na Verceli

Testovacie rozhranie pre hodnotiteľov beží na **Verceli** (`app.contineo.app`).
To pridáva do reťaze dvoch nových účastníkov, ktorých ADR-002 dovtedy neriešilo:

| Komponent | Poskytovateľ | Lokalita | Čo ním prechádza |
|---|---|---|---|
| Beh aplikácie | Vercel | podľa regiónu funkcie | otázky, odpovede, obsah noriem |
| Prihlasovacie e-maily | Ecomail (CZ) | EÚ | e-mailová adresa hodnotiteľa a jednorazový odkaz |

Ecomail je česká služba, takže z pohľadu rezidencie ide o spracovanie v EÚ.
**Neprechádza ním obsah noriem ani otázky** — len adresa a odkaz.

### Otvorený ústupok: Atlas Network Access `0.0.0.0/0`

Vercel na bezplatnom pláne nemá pevné IP adresy, takže cluster musí prijímať
spojenie odkiaľkoľvek. Prístup tak chráni **len meno a heslo databázového
používateľa**.

Pre dnešný stav je to prijateľné: korpus obsahuje verejné normy SFZ a ide
o testovacie prostredie. **Pred pridaním interných smerníc to prijateľné
prestane byť** a treba jedno z:

1. **Vercel Secure Compute** — vyhradené IP adresy, ktoré sa dajú v Atlase
   povoliť. Platený doplnok.
2. **Iné umiestnenie aplikácie** — vlastný server s pevnou IP, čo je aj tak
   cesta pre režimy `on-prem` a `air-gap`.

Rovnaká úvaha platí pre tier: aplikácia na zdieľanej infraštruktúre Vercelu
je z pohľadu kapitoly 10 **T1**, nech je databáza kdekoľvek.


---

## 12. Dodatok (2026-07-27) — Bedrock môže vyriešiť aj O7

Kapitola 7 tvrdila, že **embedding a rerank riešenie nemajú** a v `eu-full` sa
nedajú použiť, kým nebude vlastná služba s GPU. Overenie ponuky AWS Bedrock
v `eu-central-1` ukazuje, že to tak nemusí byť:

| Úloha | Model na Bedrocku vo Frankfurte |
|---|---|
| Generovanie | Claude Sonnet |
| Embedding | Amazon Titan Text Embeddings v2, Cohere Embed |
| Preradenie | Cohere Rerank 3.5 |

**Celá reťaz sa teda dá dostať do EÚ bez vlastného hardvéru.** Otvorený bod
**O7** má tým možnú odpoveď — nie potvrdenú, len možnú.

> **Pozor pri čítaní:** táto kapitola popisuje, čo je *technicky možné*.
> Rozhodnutie, či touto cestou ísť, je v **dodatku 13** — a znie, že nie:
> Bedrock nerieši izoláciu, teda to, kvôli čomu rezidenciu riešime.

### Čo to znamená v praxi

Nie je to zmena konfigurácie, ale zmena architektúry retrievalu:

1. **Embedding otázky sa presunie do našej aplikácie.** Dnes ho robí Atlas
   sám (`atlas-auto`), pri Bedrocku musíme vektor vypočítať a poslať do
   `$vectorSearch`. Pribudne krok a jedno sieťové volanie.
2. **`vectorPath` sa zmení** z textového poľa na pole s vektorom. Zámena
   týchto dvoch je tichá chyba — dotaz nespadne, len nikdy nič nenájde.
   `validateProfile()` ju už zachytáva.
3. **Celý korpus sa musí preindexovať.** Iný model = iný vektorový priestor.
4. **Rerank sa presunie z agregácie do aplikačnej vrstvy.** Adaptér na to
   existuje (ADR-001), len sa dnes používa len pre on-prem.
5. **Kvalita sa zmení a nevieme ako.** `voyage-4` je pre slovenčinu iný model
   než Titan či Cohere. Toto je presne prípad, na ktorý slúži zlatá sada:
   zmerať obe konfigurácie a porovnať hit@5 a presnosť citácií.

### Čo zostáva otvorené

- **O11** — Citations cez Bedrock nikdy nebežali proti skutočnému AWS.
  Adaptér je jednotkovo overený (SigV4 proti oficiálnym vektorom AWS, parser
  binárneho streamu vrátane rozdelených rámcov), ale integračne nie.
- **Hosting aplikácie.** Vercel je v hlavnej reťazi posledný komponent mimo
  našej kontroly. Pre `eu-full` treba overiť región funkcie alebo appku
  presunúť.
- **Cena.** Regionálne endpointy majú 10 % prirážku oproti globálnym.

### Čo Bedrock nerieši

**Izoláciu.** Vyhradený účet u poskytovateľa cloudu nie je vyhradený hardvér —
model vo Frankfurte obsluhuje aj ostatných zákazníkov AWS. Z pohľadu kapitoly
10 zostáva Bedrock **T1** a na `T2` neprejde. Kto chce vyhradené prostredie,
potrebuje vlastné inštancie tak či tak.


---

## 13. Rozhodnutie (2026-07-27) — Bedrock je poistka, nie cieľová architektúra

Dodatok 12 ukázal, že cez Bedrock vo Frankfurte sa dá postaviť celá reťaz
v EÚ. **Napriek tomu doň ďalej neinvestujeme.** Dôvody sú tri a prvý z nich
je najsilnejší.

### 1. Nerieši izoláciu, teda to, kvôli čomu rezidenciu vôbec riešime

Cieľový segment — štátna správa, banky, väčšie firmy — sa nepýta len „kde to
beží", ale **„beží to len pre nás"**. Bedrock je z pohľadu kapitoly 10
**T1**: vyhradený účet u poskytovateľa cloudu nie je vyhradený hardvér, model
vo Frankfurte obsluhuje aj ostatných zákazníkov AWS.

Pre tých zákazníkov, kvôli ktorým celú rezidenciu riešime, teda Bedrock
**nestačí ani vtedy, keď je geograficky v poriadku**. To je podstatný rozdiel
oproti tomu, ako sa na Bedrock pozeralo v dodatku 12.

### 2. Je to slepá vetva vzhľadom na to, čo musíme postaviť tak či tak

Pre `on-prem` a `air-gap` potrebujeme vlastný embedding a rerank (TEI /
Infinity) bez ohľadu na Bedrock. Bedrock by bola **tretia konfigurácia**,
ktorú treba udržiavať, merať zlatou sadou a vysvetľovať zákazníkom.

Vlastný embedding pritom rieši `eu-full` **aj** `on-prem` **aj** `air-gap`
**aj** T2 — jednou investíciou. To je lepší pomer.

### 3. Cena prechodu je vysoká a zisk neistý

Prechod znamená preindexovať celý korpus, presunúť embedding do aplikácie,
pridať sieťové volanie do reťaze (latencia je už dnes nad prahom) a **prijať
neznámu zmenu kvality vyhľadávania** — `voyage-4` je pre slovenčinu iný model
než Titan alebo Cohere.

---

## Prečo Bedrock napriek tomu nezahadzujeme

**Citations API.** Celá dôveryhodnosť systému stojí na tom, že model vracia
doslovné citácie viazané na konkrétny dokument a nevymýšľa si ich. To je
funkcia Anthropic API, nie vlastnosť RAG všeobecne.

Pri prechode na vlastný model (Qwen3, EuroLLM) sa z „model vybral tento
úryvok z čl. 78" stane „model tvrdí, že to je v čl. 78". V normatívnej doméne
je to rozdiel medzi nástrojom na rozhodovanie a nástrojom na inšpiráciu.

**Bedrock je dnes jediná cesta, ako mať Claude Citations mimo USA.**

O koľko sa kvalita citácií bez Citations API zhorší, **nevieme** — a je to
jedna z otázok, na ktoré má odpovedať zlatá sada (D9, kapitola 5). Kým to
číslo nemáme, odpísať Bedrock by bolo rozhodnutie naslepo.

### Čo z toho plynie prakticky

| | |
|---|---|
| **Adaptér `bedrock.ts`** | ponechať, neinvestovať doň ďalej |
| **O11** (Citations cez Bedrock) | zostáva otvorený; overiť, keď bude AWS účet — je to práca na hodinu |
| **O7** (európsky embedding a rerank) | **priorita**; vlastná služba, nie Bedrock |
| **Voľba modelu na generovanie** | **odložiť za zlatú sadu** — rozhodne číslo o citáciách, nie dojem |

Náklad na adaptér je už utopený: je napísaný a jednotkovo overený (SigV4
proti oficiálnym testovacím vektorom AWS, parser binárneho streamu vrátane
rozdelených rámcov). Otázka teda neznie „robiť Bedrock?", ale „investovať doň
ďalej?" — a odpoveď je nie, kým nepríde zákazník, ktorý ho výslovne chce.
